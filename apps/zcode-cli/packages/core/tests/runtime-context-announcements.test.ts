import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CompactTrigger,
  createRootTraceContext,
  createSessionId,
  createToolCallId,
  ModelErrorCode,
  type ContextSourcePort,
  type ContextSourceRequest,
  type ModelRequest,
  type ModelResult,
  type SkillPort,
} from "@zcode/contracts";
import { createTestAgentRuntime } from "./test-agent-runtime.js";
import { createTestModelSelection } from "./test-model-selection.js";
import { createTestSessionEventStore } from "./test-event-store.js";
import { createTestModelFactory } from "./test-runtime-model.js";
import { createRecordingMessageStore } from "./runtime-output-token-continuation-test-helpers.js";
import { createToolRegistry } from "../src/tool/registry.js";
import { createReadFileStatePathKey } from "../src/tool/read-file-state.js";
import { MemoryFileSystem } from "./memory-test-utils.js";
import type { AgentDefinitionsSnapshot } from "../src/subagent/definitions.js";
import { buildProviderRequestMessages } from "../src/runtime/helpers/provider-request-messages.js";
import { systemReminderAttachmentEntry } from "../src/agent/message-history.js";
import type { AgentRuntimeInternal } from "../src/runtime/internal.js";
import {
  buildCompactLeadingAnnouncements,
  buildRequestAnnouncements,
  restateContextAfterCompact,
} from "../src/runtime/methods/context-refresh.js";
import type { AgentRuntimeConfig, AgentRuntimeDeps } from "../src/runtime/types.js";
import { formatWorkflowStallNotification } from "../src/runtime-task/workflow-notification-copy.js";

const snapshot = (...names: string[]): AgentDefinitionsSnapshot => ({
  activeAgents: names.map((name) => ({
    name,
    description: `Description ${name}`,
    source: "user",
    systemPrompt: "private",
  })),
});
const result = {
  finishReason: "stop" as const,
  text: "Summary of current work.",
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
};
let sessionId: ReturnType<typeof createSessionId>;
let store: ReturnType<typeof createRecordingMessageStore>;
let requests: ModelRequest[];
const definitions = vi.fn(() => snapshot("A"));
const respond = vi.fn<(request: ModelRequest) => Promise<ModelResult>>();
let runtime: ReturnType<typeof createTestAgentRuntime>;

function createRuntime(
  deps: Partial<AgentRuntimeDeps> = {},
  config: Partial<AgentRuntimeConfig> = {},
  { mcs = true, fold = false }: { mcs?: boolean; fold?: boolean } = {},
) {
  const modelFactory = createTestModelFactory({
    properties: { supportsMidConversationSystem: mcs },
    generateText: async (request) => {
      requests.push(request);
      return respond(request);
    },
  });
  return createTestAgentRuntime(
    sessionId,
    { mode: "yolo", compact: { enabled: false }, titleGeneration: { enabled: false }, ...config },
    {
      eventStore: createTestSessionEventStore(),
      sessionStore: store as never,
      getAgentDefinitions: definitions,
      modelFactory: fold
        ? (input) => ({
            ...modelFactory(input),
            requestCapabilities: { foldRemindersIntoToolResults: true },
          })
        : modelFactory,
      ...deps,
    },
  );
}
const entries = () =>
  (runtime as unknown as AgentRuntimeInternal).messageHistory.toRuntimeEntries();
const compact = (value: ReturnType<typeof createTestAgentRuntime>, trigger?: CompactTrigger) =>
  (value as unknown as AgentRuntimeInternal).compactActiveConversation(
    undefined,
    createRootTraceContext({ sessionId }),
    [],
    { trigger },
  );

beforeEach(() => {
  sessionId = createSessionId();
  store = createRecordingMessageStore();
  requests = [];
  definitions.mockReset().mockImplementation(() => snapshot("A"));
  respond.mockReset().mockResolvedValue(result);
  runtime = createRuntime();
});

const skillPort: SkillPort = {
  async discoverSkills() {
    return {
      skills: [
        {
          name: "search",
          description: "search things",
          path: "/workspace/.agents/skills/search/SKILL.md",
          directory: "/workspace/.agents/skills/search",
          rootPath: "/workspace/.agents/skills",
          scope: "project" as const,
          source: "agents" as const,
          safeToAutoLoad: true,
          frontmatterKeys: [],
        },
      ],
      diagnostics: [],
      totalDiscovered: 1,
    };
  },
  async loadSkill() {
    throw new Error("not needed");
  },
};

describe("runtime context announcements", () => {
  // 顺序即宣告顺序：environment → model → (agent listing) → skills → instructions → git → date。
  const sources = new Set([
    "environment",
    "model",
    "skills_listing",
    "context_prefix",
    "session_context",
    "date",
    "current_time",
  ]);
  // 动态公告按隐藏提醒落盘：类型只记在 runtimeMessage.source，不写顶层 source。
  const runtimeSourceOf = (message: { metadata?: Record<string, unknown> }) =>
    (message.metadata?.runtimeMessage as { source?: string } | undefined)?.source;
  const isAnnouncementRecord = (message: {
    semantics?: { kind?: string };
    metadata?: Record<string, unknown>;
  }) =>
    message.semantics?.kind === "system_reminder" && sources.has(runtimeSourceOf(message) ?? "");
  const contextEntries = (value: ReturnType<typeof createTestAgentRuntime>) =>
    (value as unknown as AgentRuntimeInternal).messageHistory
      .toRuntimeEntries()
      .filter(
        (entry) =>
          entry.kind === "attachment" &&
          sources.has(entry.metadata.source) &&
          // 时间每轮持久化一条、数量随轮增长；这里对比"不重复的稳定公告"，时间在专门用例断言。
          entry.metadata.source !== "current_time",
      );
  const config: Partial<AgentRuntimeConfig> = {
    workingDirectory: "/workspace",
    currentDate: "2026-10-14",
    envInfo: {
      cwd: "/workspace",
      platform: "linux",
      shell: "bash",
      osVersion: "Linux",
      nodeVersion: "24",
      isGitRepository: true,
      gitStatus: "clean",
      gitBranch: "original",
    },
  };
  const now = () => new Date(2026, 9, 14, 12);
  const instructionsPort = (): ContextSourcePort => ({
    async resolveEnvironment() {
      return config.envInfo!;
    },
    async resolveGitContext() {
      return config.envInfo!;
    },
    async resolveContextSources() {
      return {
        workingDirectory: "/workspace",
        envInfo: config.envInfo!,
        userInstructions: {
          filePath: "/workspace/AGENTS.md",
          fileName: "AGENTS.md",
          content: "Project rule.",
          bytesRead: 13,
          sizeBytes: 13,
          truncated: false,
        },
        diagnostics: [],
      };
    },
  });
  const environmentPort = () =>
    ({
      async resolveContextSources() {
        return { workingDirectory: "/workspace", envInfo: config.envInfo!, diagnostics: [] };
      },
      resolveEnvironment: vi.fn(
        async ({
          workingDirectory,
          effectiveShellDisplayName,
        }: Pick<ContextSourceRequest, "workingDirectory" | "effectiveShellDisplayName">) => ({
          ...config.envInfo!,
          cwd: workingDirectory,
          shell: effectiveShellDisplayName ?? config.envInfo!.shell,
          isGitRepository: workingDirectory.startsWith("/workspace"),
        }),
      ),
    }) satisfies ContextSourcePort;

  // 把当前 store 复制成独立的冷存储，再从中恢复一个新 runtime。
  const coldRuntimeWith = async (
    port: SkillPort = skillPort,
    coldConfig: Partial<AgentRuntimeConfig> = config,
    coldDeps: Partial<AgentRuntimeDeps> = {},
  ) => {
    const recording = createRecordingMessageStore();
    // rewind 只需把分支信息写回会话；录制 store 没有 setRevert，用 updateSession 承接。
    const coldStore = Object.assign(recording, {
      async setRevert(input: { sessionID: string; revert: unknown }) {
        await recording.updateSession({ id: input.sessionID, revert: input.revert });
      },
    });
    await coldStore.createSession(await store.getSession(sessionId));
    coldStore.savedMessages.push(...structuredClone(store.savedMessages));
    coldStore.savedParts.push(...structuredClone(store.savedParts));
    const cold = createRuntime(
      {
        now,
        skillPort: port,
        contextSourcePort: instructionsPort(),
        sessionStore: coldStore as never,
        ...coldDeps,
      },
      coldConfig,
    );
    await cold.resumeFromStore();
    return { cold, coldStore };
  };

  it("keeps harness context in the system prompt before the first user turn", async () => {
    runtime = createRuntime(
      { now, skillPort, contextSourcePort: instructionsPort() },
      config,
    );
    await runtime.executeTurn("first task");

    // 环境、模型、Agent 名单、skills、指令与 Git 不再作为用户侧公告逐轮注入。
    const attached = contextEntries(runtime).map((entry) => entry.metadata?.source);
    for (const source of [
      "environment",
      "model",
      "agent_listing_delta",
      "skills_listing",
      "context_prefix",
      "session_context",
    ]) {
      expect(attached).not.toContain(source);
    }
    const events = await (runtime as unknown as {
      eventStore: { getEvents: (id: unknown) => Promise<{ type: string; payload: unknown }[]> };
    }).eventStore.getEvents(sessionId);
    // 本轮只发一次注入事件。
    const timeEvents = events.filter(
      (event) =>
        event.type === "context_injected" &&
        (event.payload as { source?: string }).source === "current_time",
    );
    expect(timeEvents).toHaveLength(1);
    expect((timeEvents[0]!.payload as { text: string }).text).toContain(
      "Current time: 2026-",
    );
    expect(attached).toContain("date");
    // 时间也走持久化公告通道，但每轮一条，不进这个"稳定公告"对比（见专门用例）。
    expect(attached).not.toContain("current_time");
    expect(
      requests[0]!.messages
        .map((message) => JSON.stringify(message.content))
        .join("\n"),
    ).toContain("Current time:");

    const systemText = requests[0]!
      .messages.filter((message) => message.role === "system")
      .map((message) => String(message.content))
      .join("\n");
    for (const marker of [
      "# Environment",
      "You are powered by",
      "Available agent types",
      "The following skills",
      "Codebase and user instructions",
      "As you answer",
    ]) {
      expect(systemText).toContain(marker);
    }
  });

  it("injects Beijing time on every user query and persists one record per turn", async () => {
    runtime = createRuntime({ now: () => new Date("2026-11-03T02:34:56Z") }, config);
    await runtime.executeTurn("first");
    await runtime.executeTurn("second");

    for (const request of requests.slice(0, 2)) {
      const text = request.messages
        .map((message) => JSON.stringify(message.content))
        .join("\n");
      expect(text).toContain("Current time: 2026-11-03 10:34:56 (Asia/Shanghai, UTC+8).");
    }
    // 与记忆/衣橱同一持久化合同：隐藏提醒落库，重开会话后注入面板可从 transcript 合成按钮。
    expect(
      store.savedParts.filter(
        (part) => part.metadata?.runtimeMessage?.source === "current_time",
      ),
    ).toHaveLength(2);
  });

  it("ends only the block right before the first input with a newline when the model merges adjacent user content", async () => {
    // 声明合并相邻 user 内容（foldRemindersIntoToolResults）时，紧挨输入的那一块以换行结尾，其余块不补。
    runtime = createRuntime({ now, skillPort, contextSourcePort: instructionsPort() }, config, {
      mcs: false,
      fold: true,
    });
    await runtime.executeTurn("first");
    const userTexts = requests[0]!.messages
      .filter((message) => message.role !== "system")
      .map((message) => String(message.content));
    const promptIndex = userTexts.indexOf("first");
    expect(promptIndex).toBeGreaterThan(1);
    expect(userTexts[promptIndex - 1]).toMatch(/<\/system-reminder>\n$/u);
    expect(userTexts.slice(0, promptIndex - 1).every((text) => !text.endsWith("\n"))).toBe(true);
  });

  describe("turns started by a notification", () => {
    const marker = "NOTIFICATION_MARKER";
    const startTurn = {
      task_notification: () =>
        (runtime as any).enqueueBackgroundTaskNotification({
          text: `<task-notification><task-id>${marker}</task-id><status>completed</status></task-notification>`,
          traceContext: createRootTraceContext({ sessionId }),
        }),
      subagent_reply: () =>
        (runtime as any).enqueueSubagentMessage({
          responseId: "response",
          agentId: "agent",
          agentType: "general-purpose",
          childSessionId: createSessionId(),
          childToolCallId: "child-call",
          summary: "progress",
          message: marker,
          traceContext: createRootTraceContext({ sessionId }),
        }),
    };
    const contextMarkers = [
      "# Environment",
      "You are powered by",
      "Available agent types",
      "The following skills",
      "Codebase and user instructions",
      "Today's date is",
    ];
    const waitForRequests = (count: number) =>
      vi.waitFor(() => expect(requests.length).toBeGreaterThanOrEqual(count));
    const requestText = (request: ModelRequest) =>
      request.messages.map((message) => JSON.stringify(message.content)).join("\n");
    const createNotifiedRuntime = (mcs: boolean, deps: Partial<AgentRuntimeDeps> = {}) =>
      createRuntime({ now, skillPort, contextSourcePort: instructionsPort(), ...deps }, config, {
        mcs,
      });

    it.each([
      ["task_notification", false],
      ["task_notification", true],
      ["subagent_reply", false],
      ["subagent_reply", true],
    ] as const)(
      "skips input attachments but keeps request announcements on the first %s request (MCS=%s)",
      async (input, mcs) => {
        runtime = createNotifiedRuntime(mcs);
        await runtime.ensureSessionPersistedForExternalActivity("initial session");
        startTurn[input]();
        await waitForRequests(1);

        const messages = requests[0]!.messages;
        const indexOf = (text: string) =>
          messages.findIndex((message) => JSON.stringify(message.content).includes(text));
        const notificationIndex = indexOf(marker);
        expect(messages[notificationIndex]!.role).toBe("user");
        // harness 信息在 system prompt；跳过附件只影响用户侧公告。
        const systemText = messages
          .filter((message) => message.role === "system")
          .map((message) => String(message.content))
          .join("\n");
        for (const contextMarker of contextMarkers.slice(0, 4)) {
          expect(systemText).toContain(contextMarker);
        }
        // 公告冒泡到通知之前；MCS 文本落在 user run 末尾。
        expect(indexOf("Codebase and user instructions")).toBeLessThan(notificationIndex);
        if (mcs) {
          expect(messages.at(-1)!.role).toBe("system");
          expect(indexOf("Today's date is")).toBe(messages.length - 1);
        } else {
          expect(indexOf("Today's date is")).toBeLessThan(notificationIndex);
          expect(notificationIndex).toBe(messages.length - 1);
        }
        expect(contextEntries(runtime).map((entry) => entry.metadata.source)).toEqual(
          expect.arrayContaining(["date"]),
        );
        expect(
          contextEntries(runtime).some((entry) =>
            ["environment", "model", "skills_listing"].includes(entry.metadata.source),
          ),
        ).toBe(false);
      },
    );

    // 修复原因：空闲整批原来存成一个 "\n\n" 连接的字符串，投影时再按 <task-notification> 开头猜边界；
    // workflow 运行中通知不以它开头，被并进前一条通知的包装。现在每条通知是同一条消息的一个文本块，
    // 整条消息一个事务写入，冷恢复保留这些块，live 与冷恢复发出的块逐字节相同。
    it.each([true, false])(
      "keeps each notification of an idle batch in its own block live and after a cold resume (MCS=%s)",
      async (mcs) => {
        const bundles: { messages: { info: { source?: string }; parts: unknown[] }[] }[] = [];
        Object.assign(store, {
          async commitMessageBundle(bundle: (typeof bundles)[number]) {
            bundles.push(structuredClone(bundle));
            for (const message of bundle.messages) {
              store.savedMessages.push(message.info);
              store.savedParts.push(...message.parts);
            }
          },
        });
        let releaseFirst!: () => void;
        const firstHeld = new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
        respond.mockImplementationOnce(async () => {
          await firstHeld;
          return result;
        });
        runtime = createNotifiedRuntime(mcs);
        await runtime.ensureSessionPersistedForExternalActivity("initial session");
        const enqueue = (text: string) =>
          (runtime as any).enqueueBackgroundTaskNotification({
            text,
            traceContext: createRootTraceContext({ sessionId }),
          });
        const stall = formatWorkflowStallNotification({
          runLabel: "wf",
          runId: "run_1",
          sinceMs: 600000,
        });
        enqueue("<task-notification><task-id>first</task-id></task-notification>");
        await waitForRequests(1);
        // 第一条通知的请求进行中到达的两条，在下一次空闲时成为同一批。
        enqueue("<task-notification><task-id>bash-1</task-id></task-notification>");
        enqueue(stall);
        releaseFirst();
        await waitForRequests(2);
        await vi.waitFor(() => expect(runtime.getActiveTurnInfo()).toBeUndefined());

        const batchMessage = (request: ModelRequest) =>
          request.messages.find(
            (message) =>
              message.role === "user" &&
              Array.isArray(message.content) &&
              JSON.stringify(message.content).includes("bash-1"),
          );
        const live = batchMessage(requests[1]!)!;
        const blocks = live.content as { type: string; text: string }[];
        expect(blocks.map((block) => block.type)).toEqual(["text", "text"]);
        expect(blocks[0]!.text).toMatch(
          /^<system-reminder>\n\[SYSTEM NOTIFICATION - NOT USER INPUT\]/u,
        );
        expect(blocks[0]!.text).toContain("bash-1");
        expect(blocks[0]!.text).not.toContain("workflow-stall");
        expect(blocks[0]!.text.endsWith("</system-reminder>\n")).toBe(true);
        expect(blocks[1]!.text).toContain("<workflow-stall>");
        expect(blocks[1]!.text.endsWith("</system-reminder>")).toBe(true);
        // 一个事务写入一条消息、两个 part。
        const batchBundles = bundles.filter((bundle) =>
          bundle.messages.some((message) => message.info.source === "background_task"),
        );
        expect(batchBundles.map((bundle) => bundle.messages.map((m) => m.parts.length))).toEqual([
          [2],
        ]);

        const coldStore = createRecordingMessageStore();
        await coldStore.createSession(await store.getSession(sessionId));
        coldStore.savedMessages.push(...structuredClone(store.savedMessages));
        coldStore.savedParts.push(...structuredClone(store.savedParts));
        const cold = createRuntime(
          {
            now,
            skillPort,
            contextSourcePort: instructionsPort(),
            sessionStore: coldStore as never,
          },
          config,
          { mcs },
        );
        await cold.resumeFromStore();
        await cold.executeTurn("after resume");
        expect(batchMessage(requests.at(-1)!)?.content).toEqual(live.content);
      },
    );

    it("collects the skipped context after a tool result in the same turn", async () => {
      const registry = createToolRegistry();
      registry.register({
        inputSchema: {},
        metadata: {
          name: "Probe",
          concurrentSafe: true,
          destructive: false,
          needsApproval: false,
          readOnly: true,
          riskLevel: "low",
          sideEffectScope: "none",
        },
        handler: async () => "probed",
      });
      runtime = createNotifiedRuntime(false, { toolRegistry: registry });
      respond.mockResolvedValueOnce({
        ...result,
        text: "",
        finishReason: "tool-calls",
        toolCalls: [{ id: "probe", name: "Probe", input: {} }],
      });
      await runtime.ensureSessionPersistedForExternalActivity("initial session");
      startTurn.task_notification();
      await waitForRequests(2);

      const texts = requests[1]!.messages.map((message) => JSON.stringify(message.content));
      const notificationIndex = texts.findIndex((text) => text.includes(marker));
      const toolIndex = requests[1]!.messages.findIndex((message) => message.role === "tool");
      const timeIndex = texts.findIndex((text) => text.includes("Current time:"));
      expect(notificationIndex).toBeLessThan(toolIndex);
      expect(timeIndex).toBeGreaterThan(toolIndex);
    });

    it("keeps the plan-mode exit reminder pending for the next collected request", async () => {
      runtime = createNotifiedRuntime(false);
      (runtime as unknown as AgentRuntimeInternal).needsPlanModeExitReminder = true;
      await runtime.ensureSessionPersistedForExternalActivity("initial session");
      startTurn.task_notification();
      await waitForRequests(1);
      await vi.waitFor(() => expect(runtime.getActiveTurnInfo()).toBeUndefined());

      const planExit = () =>
        entries().filter((entry) => entry.metadata?.source === "plan_mode_exit");
      expect(planExit()).toHaveLength(0);
      expect((runtime as unknown as AgentRuntimeInternal).needsPlanModeExitReminder).toBe(true);

      await runtime.executeTurn("next");
      expect((runtime as unknown as AgentRuntimeInternal).needsPlanModeExitReminder).toBe(false);
      expect(planExit()).toHaveLength(1);
    });
  });

  it("announces output style instructions after the model once per change and resets when cleared", async () => {
    runtime = createRuntime(
      { now, skillPort },
      { ...config, outputStyle: { name: "Learning", prompt: "Explain tradeoffs.\n" } },
    );
    await runtime.executeTurn("first");
    await runtime.executeTurn("second");
    runtime.updateConfig({ outputStyle: { name: "Learning", prompt: "Explain briefly." } });
    await runtime.executeTurn("third");
    runtime.updateConfig({ outputStyle: undefined });
    await runtime.executeTurn("fourth");
    await runtime.executeTurn("fifth");
    const attachments = entries().filter((entry) => entry.kind === "attachment");
    expect(
      attachments
        .filter((entry) => entry.metadata.source === "output_style_instructions")
        .map((entry) => entry.content),
    ).toEqual([
      "# Output Style: Learning\nExplain tradeoffs.",
      "# Output Style: Learning\nExplain briefly.",
      "The output style was reset to the default. Respond in your usual style.",
    ]);
    // environment/model 已进 system prompt；用户侧只留 output style 指令。
    const order = attachments.map((entry) => entry.metadata.source);
    expect(order).toContain("output_style_instructions");
    expect(order).not.toContain("environment");
    expect(order).not.toContain("model");
    // system 不再携带 output style 指令。
    expect(
      JSON.stringify(requests[0]!.messages.slice(0, 3).map((message) => message.content)),
    ).not.toContain("# Output Style");
  });

  it("restates the latest output style after compact unless the kept tail has one or it was reset", () => {
    runtime = createRuntime({ now, skillPort }, config);
    const internal = runtime as unknown as AgentRuntimeInternal;
    // output style 的重述不受 env_info 门控。
    internal.latestContextBuildResult = { sections: [] } as never;
    const style = systemReminderAttachmentEntry(
      "output_style_instructions",
      "# Output Style: Learning\nExplain tradeoffs.",
    );
    const reset = systemReminderAttachmentEntry(
      "output_style_instructions",
      "The output style was reset to the default. Respond in your usual style.",
    );
    expect(restateContextAfterCompact(internal, [style], []).map((entry) => entry.content)).toEqual(
      [style.content],
    );
    expect(restateContextAfterCompact(internal, [style], [style])).toEqual([]);
    expect(restateContextAfterCompact(internal, [style, reset], [])).toEqual([]);
  });

  it("derives the plan-mode exit reminder from history after resume", async () => {
    runtime = createRuntime({ now, skillPort, contextSourcePort: instructionsPort() }, config);
    const internal = runtime as unknown as AgentRuntimeInternal;
    await runtime.executeTurn("planned");
    internal.messageHistory.addEntries([
      systemReminderAttachmentEntry("runtime_mode", "Plan mode is active."),
      { message: { role: "assistant", content: "plan ready" } },
    ]);
    // 冷恢复后内存标记为 false；按历史中最近的 plan 提醒判断。
    internal.needsPlanModeExitReminder = false;
    await runtime.executeTurn("build it");
    await runtime.executeTurn("again");
    const planExit = entries().filter((entry) => entry.metadata?.source === "plan_mode_exit");
    expect(planExit).toHaveLength(1);
  });

  it.each([undefined, CompactTrigger.Manual, CompactTrigger.Reactive])(
    "restores context without duplicate announcements after compact=%s",
    async (trigger) => {
      runtime = createRuntime({ now, skillPort, contextSourcePort: instructionsPort() }, config);
      await runtime.executeTurn("first");
      const initialContext = contextEntries(runtime);
      expect(initialContext.map((entry) => entry.metadata?.source)).toEqual(["date"]);
      await runtime.executeTurn("second");
      expect(contextEntries(runtime)).toEqual(initialContext);
      const announcements = store.savedMessages.filter(isAnnouncementRecord);
      const announcementSources = announcements.map((item) => runtimeSourceOf(item));
      expect(announcementSources.filter((source) => source !== "current_time")).toEqual([
        "date",
      ]);
      // 时间每轮持久化一条：两轮两条。
      expect(announcementSources.filter((source) => source === "current_time")).toHaveLength(2);
      for (const announcement of announcements) {
        // 顶层 source 不写新值：旧版本 App 按封闭列表校验，会拒绝整个会话。
        expect(announcement.source).toBeUndefined();
        expect(announcement.semantics?.source).toBe(runtimeSourceOf(announcement));
        expect(announcement).toMatchObject({
          semantics: {
            uiVisibility: "hidden",
            transcriptVisibility: "hidden",
            providerVisibility: "visible",
          },
        });
      }
      if (trigger) {
        const compacted = await compact(runtime, trigger);
        expect(compacted.outcome).toBe("compacted");
        await runtime.executeTurn("continue after compact");
        // 日期仍只宣告一次；时间每轮一条，compact 边界照常保留。
        expect(contextEntries(runtime)).toEqual(initialContext);
      }
      const liveContext = contextEntries(runtime);
      const { cold, coldStore } = await coldRuntimeWith(skillPort, {
        ...config,
        envInfo: { ...config.envInfo!, gitBranch: "new-probe-must-not-replace-history" },
      });
      const coldAnnouncements = () => coldStore.savedMessages.filter(isAnnouncementRecord);
      const beforeStable = coldAnnouncements().filter(
        (item) => runtimeSourceOf(item) !== "current_time",
      ).length;
      const beforeTime = coldAnnouncements().filter(
        (item) => runtimeSourceOf(item) === "current_time",
      ).length;
      await cold.executeTurn("resumed");
      expect(contextEntries(cold)).toEqual(liveContext);
      // 稳定公告不重复；时间只新增本轮一条。
      expect(
        coldAnnouncements().filter((item) => runtimeSourceOf(item) !== "current_time"),
      ).toHaveLength(beforeStable);
      expect(
        coldAnnouncements().filter((item) => runtimeSourceOf(item) === "current_time"),
      ).toHaveLength(beforeTime + 1);
    },
  );

  const withSkills = (
    skills: (base: Awaited<ReturnType<SkillPort["discoverSkills"]>>["skills"]) => typeof base,
  ): SkillPort => ({
    ...skillPort,
    async discoverSkills(request, options) {
      const outcome = await skillPort.discoverSkills(request, options);
      const next = skills(outcome.skills);
      return { ...outcome, skills: next, totalDiscovered: next.length };
    },
  });
  const withReviewSkill = withSkills((base) => [
    ...base,
    {
      ...base[0]!,
      name: "review",
      description: "review things",
      path: "/workspace/.agents/skills/review/SKILL.md",
      directory: "/workspace/.agents/skills/review",
    },
  ]);
  const skillsListingRecordTexts = (value: ReturnType<typeof createRecordingMessageStore>) =>
    value.savedParts
      .filter((part) => part.metadata?.runtimeMessage?.source === "skills_listing")
      .map((part) => String((part as { text?: string }).text));
  const historyIndexOfListing = (value: ReturnType<typeof createTestAgentRuntime>) =>
    (value as unknown as AgentRuntimeInternal).messageHistory
      .toRuntimeEntries()
      .findIndex(
        (entry) => entry.kind === "attachment" && entry.metadata.source === "skills_listing",
      );
  it("does not place a date before the summary when the kept tail already has one", () => {
    // 保留段里已有 date 类型的公告（哪怕已过期）时，summary 之前不放日期；
    // 之后的请求以保留段里的旧日期为基准，在末尾宣告一次日期变化。
    runtime = createRuntime(
      { now: () => new Date(2026, 9, 15, 0, 10), skillPort, contextSourcePort: instructionsPort() },
      config,
    );
    const internal = runtime as unknown as AgentRuntimeInternal;
    const kept = [
      { message: { role: "assistant" as const, content: "Working on it." } },
      systemReminderAttachmentEntry("date", "Today's date is 2026-10-14."),
      { message: { role: "assistant" as const, content: "Done." } },
    ];
    const leading = buildCompactLeadingAnnouncements(internal, kept);
    expect(leading.map((entry) => entry.metadata.source)).not.toContain("date");
    // 普通请求前公告不受影响：同一份历史仍宣告日期变化。
    expect(
      buildRequestAnnouncements(internal, kept).map((entry) => entry.metadata.source),
    ).toContain("date");
  });

  it("does not invent environment or model notices after compact when history has none", () => {
    // 只重述 compact 前历史里真有的公告；历史里没有时由下一次请求的收集补上。
    runtime = createRuntime({ now, skillPort, contextSourcePort: instructionsPort() }, config);
    const internal = runtime as unknown as AgentRuntimeInternal;
    internal.latestContextBuildResult = {
      sections: [{ source: "env_info" }],
    } as never;
    const restated = restateContextAfterCompact(
      internal,
      [{ message: { role: "user", content: "legacy history" }, metadata: { source: "real_user" } }],
      [],
    );
    expect(restated).toEqual([]);
  });

  it("commits announcements, summary and attachments in one store transaction", async () => {
    const bundles: { messages: { info: { id: string }; parts: unknown[] }[] }[] = [];
    const saveMessage = vi.spyOn(store, "saveMessage");
    Object.assign(store, {
      async commitMessageBundle(bundle: (typeof bundles)[number]) {
        bundles.push(structuredClone(bundle));
        for (const message of bundle.messages) {
          store.savedMessages.push(message.info);
          store.savedParts.push(...message.parts);
        }
      },
    });
    runtime = createRuntime({ now, skillPort, contextSourcePort: instructionsPort() }, config);
    await runtime.executeTurn("first");
    await runtime.executeTurn("second");
    const savedBefore = saveMessage.mock.calls.length;
    const compacted = await compact(runtime, CompactTrigger.Reactive);
    expect(compacted.outcome).toBe("compacted");
    expect(bundles).toHaveLength(1);
    const bundleIds = bundles[0]!.messages.map((message) => message.info.id);
    const committed = new Set(bundleIds);
    // 整组记录只经过事务入口，不再逐条写入。
    expect(
      saveMessage.mock.calls.slice(savedBefore).filter(([info]) => committed.has(info.id)),
    ).toEqual([]);
    const summaryIndex = bundles[0]!.messages.findIndex((message) =>
      message.parts.some((part) => (part as { type?: string }).type === "compaction"),
    );
    const declared = (
      bundles[0]!.messages[summaryIndex]!.parts.find(
        (part) => (part as { type?: string }).type === "compaction",
      ) as { metadata?: { compactLeadingMessageIds?: string[] } }
    ).metadata?.compactLeadingMessageIds;
    expect(declared?.length).toBeGreaterThan(0);
    expect(bundleIds.slice(0, summaryIndex)).toEqual(declared);
    expect(bundleIds.length).toBeGreaterThanOrEqual(summaryIndex + 1);
  });

  it("does not commit a failed context write and retries the missing sources", async () => {
    runtime = createRuntime({ now, skillPort, contextSourcePort: instructionsPort() }, config);
    const savePart = store.savePart;
    store.savePart = async (part) => {
      if (part.metadata?.runtimeMessage?.source === "date")
        throw new Error("context write failed");
      await savePart(part);
    };
    await expect(runtime.executeTurn("first")).rejects.toThrow();
    expect(respond).not.toHaveBeenCalled();
    // date 是持久化公告；它写入失败时，后续来源都不会提交。
    expect(contextEntries(runtime).map((entry) => entry.metadata?.source)).toEqual([]);
    store.savePart = savePart;
    await runtime.executeTurn("retry");
    expect(contextEntries(runtime).map((entry) => entry.metadata?.source)).toEqual(["date"]);
  });
});
