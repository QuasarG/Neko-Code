import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BUILTIN_MODEL_PROVIDER_IDS, encodeCustomModelValue, generateTraceId } from "@zcode/shared";
import { createWorkerSelectionIntegration } from "../helpers/worker-selection-integration.js";
import { clearAppData, getE2EAppDataPaths } from "../helpers/desktop-app.js";
import {
  restartIntoWorkspace,
  seedBigModelConnectionSelection,
  seedBigModelOAuthCredential,
  E2E_PLAN_NON_DEFAULT_MODEL,
} from "../helpers/model-provider-restart.js";
import {
  UPSTREAM_MODEL,
  UPSTREAM_PROVIDER_ID,
  UPSTREAM_THOUGHT_LEVEL,
} from "../helpers/upstream-provider.js";
import {
  prepareV4ConversationE2E,
  sendV4PromptAndWaitAccepted,
  switchV4Model,
  waitForV4AssistantMessageContaining,
} from "../helpers/v4-conversation.js";

const profileName = "e2e-worker-account-reviewer";
const parentMarker = "E2E_W99_EXPLICIT_PARENT";
const childMarker = "E2E_W99_EXPLICIT_CHILD";
const finalMarker = "E2E_W99_PARENT_DONE";

describe("Todo99 Worker 有效选择真实执行", () => {
  after(async () => {
    await browser.electron.restoreAllMocks();
    await clearAppData();
  });

  it("W99-E01: 显式子代理按 Worker 当前 Team 执行，原 profile 和父模型不变", async function () {
    this.timeout(180000);
    const paths = getE2EAppDataPaths();
    const profilePath = join(paths.storageRoot, "agents", `${profileName}.md`);
    const originalProfile = [
      "---",
      `name: ${profileName}`,
      "description: Review the requested marker with the configured account model.",
      `model: ${encodeCustomModelValue(BUILTIN_MODEL_PROVIDER_IDS.bigmodelIndividualCodingPlan, E2E_PLAN_NON_DEFAULT_MODEL)}`,
      "thoughtLevel: high",
      "tools: Read",
      "maxTurns: 1",
      "---",
      "Reply only with the requested marker.",
      "",
    ].join("\n");
    await prepareV4ConversationE2E();
    await restartIntoWorkspace({
      afterElectronProcessExit: async () => {
        await seedBigModelConnectionSelection({
          kind: "team-coding-plan",
          productId: "product-team-a",
          organizationId: "org-team-a",
          projectId: "proj-team-a",
        });
        await seedBigModelOAuthCredential();
        await mkdir(join(paths.storageRoot, "agents"), { recursive: true });
        await writeFile(profilePath, originalProfile, "utf8");
      },
    });
    await switchV4Model(UPSTREAM_PROVIDER_ID, UPSTREAM_MODEL, UPSTREAM_THOUGHT_LEVEL);
    await sendV4PromptAndWaitAccepted(
      `${parentMarker}: Use Agent with subagent_type ${profileName}, then report the result.`,
      parentMarker,
      "父会话没有接纳输入",
    );
    await waitForV4AssistantMessageContaining(finalMarker);

    // 读取真正 adapter 写出的 model-io，不用 helper 返回值冒充 child 请求。
    const records = await readModelIoRecords();
    const child = records.find(
      (record) =>
        record.querySource === "subagent" && JSON.stringify(record.request).includes(childMarker),
    );
    expect(child?.model).toEqual({
      providerId: BUILTIN_MODEL_PROVIDER_IDS.bigmodelTeamCodingPlan,
      modelId: E2E_PLAN_NON_DEFAULT_MODEL,
    });
    expect(child?.request.body).toMatchObject({
      model: E2E_PLAN_NON_DEFAULT_MODEL,
      output_config: { effort: "high" },
    });
    expect(child?.error).toBeUndefined();
    const parent = records.filter(
      (record) =>
        record.querySource === "main_turn" && JSON.stringify(record.request).includes(parentMarker),
    );
    expect(parent.length).toBeGreaterThanOrEqual(2);
    expect(parent.every((record) => record.model.providerId === UPSTREAM_PROVIDER_ID)).toBe(true);
    expect(await readFile(profilePath, "utf8")).toBe(originalProfile);
  });

  it("W99-E04: Worker 保留完整旧状态时明确拒绝新选择，交付后新提交可执行", async function () {
    this.timeout(90000);
    const host = await createWorkerSelectionIntegration();
    try {
      const original = {
        providerId: BUILTIN_MODEL_PROVIDER_IDS.bigmodelIndividualCodingPlan,
        modelId: E2E_PLAN_NON_DEFAULT_MODEL,
        options: { reasoningLevel: "high" },
      };
      const effective = {
        ...original,
        providerId: BUILTIN_MODEL_PROVIDER_IDS.bigmodelTeamCodingPlan,
      };
      const created = await host.task.createTask({
        workspacePath: host.workspacePath,
        modelSelection: original,
        deferPersistenceUntilFirstPrompt: true,
      });
      const target = { workspacePath: host.workspacePath, sessionId: created.taskId };
      await host.task.sendPrompt({
        taskId: created.taskId,
        content: "E2E_W99_LAG_INITIAL",
        traceId: generateTraceId("w99"),
        modelSelection: original,
      });
      await browser
        .waitUntil(
          async () => {
            const snapshot = await host.agent.readSession(target);
            return snapshot.session.status === "idle" && snapshot.messages.length > 0;
          },
          { timeout: 30000, timeoutMsg: "旧状态初始执行未完成" },
        )
        .catch(async (error) => {
          await logWorkerFailure(host, target, "E2E_W99_LAG_INITIAL");
          throw error;
        });
      await host.setDeliveryPaused(true);
      await host.selectAccount(effective.providerId);
      expect(
        (await host.modelSelectionService.getView({ selection: original })).effectiveSelection,
      ).toEqual(effective);
      const beforeRejected = await host.agent.readSession(target);
      // 当前模型准入先于 turn 创建。旧用例等待 turn.failed，会把正确的拒绝 ACK
      // 当作缺失终态；这里验证准入根因、无新回合，并保留后续完整交付和显式新提交。
      await expect(
        host.task.sendPrompt({
          taskId: created.taskId,
          content: "E2E_W99_LAG_REJECT",
          traceId: generateTraceId("w99"),
          modelSelection: effective,
        }),
      ).rejects.toMatchObject({
        name: "NekodeV4CommandRejectedError",
        ack: { status: "failed", reasonCode: "modelUnavailable" },
      });
      const afterRejected = await host.agent.readSession(target);
      expect(afterRejected.session.status).toBe("idle");
      expect(afterRejected.messages).toEqual(beforeRejected.messages);
      expect(
        (await readModelIoRecords(join(host.home, ".nekode/cli/debug"))).some((record) =>
          JSON.stringify(record.request).includes("E2E_W99_LAG_REJECT"),
        ),
      ).toBe(false);
      expect(await host.task.getTaskModelSelection({ taskId: created.taskId })).toEqual(original);
      await host.setDeliveryPaused(false);
      // 复用既有读取同步检查确认交付后再作新提交；没有给普通发送加等待机制。
      await host.agent.readSession(target);
      await host.task.sendPrompt({
        taskId: created.taskId,
        content: "E2E_W99_LAG_RECOVERED",
        traceId: generateTraceId("w99"),
        modelSelection: effective,
      });
      let records: ModelIoRecord[] = [];
      await browser.waitUntil(
        async () => {
          records = await readModelIoRecords(join(host.home, ".nekode/cli/debug"));
          return records.some(
            (record) =>
              record.querySource === "main_turn" &&
              JSON.stringify(record.request).includes("E2E_W99_LAG_RECOVERED") &&
              record.model.providerId === effective.providerId &&
              !record.error,
          );
        },
        { timeout: 30000, timeoutMsg: "重新提交没有发出 Team 请求" },
      );
    } finally {
      await host.dispose();
    }
  });
});

type ModelIoRecord = {
  querySource?: string;
  model: { providerId: string; modelId: string };
  request: { body?: unknown };
  error?: unknown;
};

async function logWorkerFailure(
  host: Awaited<ReturnType<typeof createWorkerSelectionIntegration>>,
  target: { workspacePath: string; sessionId: string },
  marker: string,
) {
  const snapshot = await host.agent.readSession(target);
  const events = await host.agent.readSessionEvents(target);
  const records = await readModelIoRecords(join(host.home, ".nekode/cli/debug"));
  console.log(
    "E2E_WORKER_FAILURE",
    JSON.stringify({
      marker,
      status: snapshot.session.status,
      messageCount: snapshot.messages.length,
      failures: events.filter((event) => event.type === "turn.failed"),
      requests: records
        .filter((record) => JSON.stringify(record.request).includes(marker))
        .map((record) => ({ model: record.model, error: record.error })),
    }),
  );
}

async function readModelIoRecords(
  debugDir = join(getE2EAppDataPaths().storageRoot, "cli", "debug"),
): Promise<ModelIoRecord[]> {
  const records: ModelIoRecord[] = [];
  for (const file of await readdir(debugDir).catch(() => [])) {
    if (!file.startsWith("model-io-") || !file.endsWith(".jsonl")) continue;
    for (const line of (await readFile(join(debugDir, file), "utf8")).split("\n")) {
      if (line.trim()) records.push(JSON.parse(line) as ModelIoRecord);
    }
  }
  return records;
}
