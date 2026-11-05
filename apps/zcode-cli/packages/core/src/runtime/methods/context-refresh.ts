import { formatLocalIsoDate, SessionEventType, type TraceContext } from "@zcode/contracts";
import {
  isRuntimeAttachmentEntry,
  systemReminderAttachmentEntry,
  type RuntimeAttachmentEntry,
} from "../../agent/message-history.js";
import {
  buildDateChangeReminderBody,
  buildOutputStyleInstructionsBody,
  OUTPUT_STYLE_RESET_REMINDER,
} from "../helpers/runtime-reminders.js";
import { querySourceForTask } from "./turn-model-step-usage.js";
import { commitTurnRequestEntries } from "./turn-output-token-continuation.js";
import type { TurnRequestState } from "./turn-loop-state.js";
import { countContextPrefixMessages } from "../deps.js";
import type { Model, OutputStylePromptConfig } from "../deps.js";
import type { RuntimeMessageEntry } from "../../agent/message-history.js";
import type { AgentRuntimeInternal } from "../internal.js";
import { buildContextHistoryEntries } from "./context-history-entries.js";
import { resolveNekoMemoryBooks } from "./context.js";
import { throwIfTurnAborted } from "../helpers/turn-errors.js";
import { buildProjectionAnchor } from "./projection-anchor.js";
import { persistRuntimeReminderMessage } from "./runtime-reminder-persistence.js";

export function rebuildContextPrefix(
  runtime: AgentRuntimeInternal,
  options: { model?: Model; turnRequestEntries?: readonly RuntimeMessageEntry[] } = {},
): readonly RuntimeMessageEntry[] {
  if (!runtime.contextBuilder || !runtime.contextInitialized) {
    // 首轮 context 初始化前，model/outputStyle/language 变更只能刷新同步预览，
    // 不能把 config-only fallback envInfo 写入 config.envInfo。否则真实 context source
    // 会以为 envInfo 已由外部显式提供，跳过平台和 git 探测。
    if (runtime.contextBuilder) {
      runtime.contextBuilder = runtime.createContextBuilderFromSnapshot(
        runtime.createConfigOnlyContextSnapshot(runtime.workingDirectory),
        resolveNekoMemoryBooks(runtime),
        {
          model: options.model,
          persistEnvInfo: false,
        },
      );
    }
    return options.turnRequestEntries ?? runtime.messageHistory.borrowReadOnlyRuntimeEntries();
  }

  const contextSnapshot =
    runtime.contextSourceSnapshot ??
    runtime.createConfigOnlyContextSnapshot(runtime.workingDirectory);
  runtime.contextBuilder = runtime.createContextBuilderFromSnapshot(
    contextSnapshot,
    resolveNekoMemoryBooks(runtime),
    { model: options.model },
  );
  const effectiveContextResult = runtime.contextBuilder.build();
  const contextEntries = buildContextHistoryEntries(effectiveContextResult);
  const canonicalEntries = runtime.messageHistory.borrowReadOnlyRuntimeEntries();
  const canonicalConversationEntries = canonicalEntries.slice(
    countContextPrefixMessages(canonicalEntries),
  );

  runtime.latestContextBuildResult = effectiveContextResult;
  runtime.messageHistory.replaceMessages([...contextEntries, ...canonicalConversationEntries]);

  const turnEntries = options.turnRequestEntries;
  if (!turnEntries) return runtime.messageHistory.borrowReadOnlyRuntimeEntries();
  return [...contextEntries, ...turnEntries.slice(countContextPrefixMessages(turnEntries))];
}

// 输入附件中的当前时间与 output style 指令：
// 环境、模型、子 Agent 名单、skills、指令文件已进入 system prompt，不再逐轮公告。
// ToolSearch 公告由 turn-loop 紧随其后追加。
export async function appendRuntimeContextAnnouncements(
  runtime: AgentRuntimeInternal,
  state: TurnRequestState,
  _model: Model,
  outputStyle: OutputStylePromptConfig | undefined,
  traceContext: TraceContext,
  signal?: AbortSignal,
): Promise<void> {
  const last = lastAnnouncedAttachments(state.entries);
  const attachments: RuntimeAttachmentEntry[] = [];
  // 每条用户输入注入一次北京时间；同一输入后的工具批次与重发不重复。
  // 取最近一条 user 输入而不是最近一条非附件：通知轮次跳过输入附件后，
  // 首个工具结果会排在通知之后，仍要补上这一轮的时间。
  const latestUserIndex = state.entries.findLastIndex(
    (entry) => !isRuntimeAttachmentEntry(entry) && entry.message.role === "user",
  );
  const timeInjectedForLatestInput =
    latestUserIndex >= 0 &&
    state.entries
      .slice(latestUserIndex + 1)
      .some((entry) => entry.kind === "attachment" && entry.metadata.source === "current_time");
  if (latestUserIndex >= 0 && !timeInjectedForLatestInput) {
    const timeBody = buildCurrentTimeBody(runtime.now());
    // 时间注入与记忆/衣橱走同一持久化合同（persistAnnouncements）：隐藏提醒消息落库，
    // 重开会话时注入面板才能从 transcript 合成"本轮时间"按钮——之前只写 turn request
    // entries（不落库），轨迹里有、重开后 UI 没有按钮；同屏下记忆/衣橱按钮在而时间不在
    // （2026-11-04 zexin 实测）。旧时钟随历史回放属事实记录，每轮一行体积可接受。
    await persistAnnouncements(
      runtime,
      state,
      [systemReminderAttachmentEntry("current_time", timeBody)],
      traceContext,
    );
  }
  // output style 只对主线程宣告。内容与最近一次宣告不同时再宣告；
  // 清除风格时，若最近一次宣告的是某个风格，宣告一次重置。
  if (querySourceForTask(runtime.config.taskType) === "main_turn") {
    const previousStyle = last.get("output_style_instructions")?.content;
    const instructions =
      buildOutputStyleInstructionsBody(outputStyle) ??
      (previousStyle === undefined ? undefined : OUTPUT_STYLE_RESET_REMINDER);
    if (instructions !== undefined && instructions !== previousStyle) {
      attachments.push(systemReminderAttachmentEntry("output_style_instructions", instructions));
    }
  }
  throwIfTurnAborted(signal);
  await persistAnnouncements(runtime, state, attachments, traceContext);
}

const BEIJING_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 北京时间固定 UTC+8，不跟随机器时区。 */
export function formatBeijingDateTime(now: Date): string {
  const shifted = new Date(now.getTime() + BEIJING_UTC_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())} (Asia/Shanghai, UTC+8)`;
}

function buildCurrentTimeBody(now: Date): string {
  return `Current time: ${formatBeijingDateTime(now)}.`;
}

const REFRESHED_ON_LOAD_SOURCES: ReadonlySet<string> = new Set([
  "skills_listing",
  "context_prefix",
]);

/**
 * 从库加载历史后（冷恢复、rewind），已恢复的 skill 列表与指令公告（含 Memory 索引）按
 * runtime 当前内容原位更新：内容不同就在原位置改成当前内容，当前为空就删除。
 * 历史里的公告随加载带回；当前为空时没有新内容可宣告，只靠插入新公告撤回不了旧内容。
 * 只改内存，库里的记录只决定位置，每次加载都重新套用。两者都只在 runtime 启动时读取，
 * 运行中不变；内容变化时之前的请求字节变一次，prompt cache 失效一次。
 * 修复原因：指令公告原来恢复后原样保留，模型看到旧的 MEMORY.md，读文件状态却记录磁盘上的
 * 当前内容；Write 的新鲜度检查放行，模型按旧内容写入，会覆盖它没见过的新内容。
 */
export function refreshRestoredAnnouncements(runtime: AgentRuntimeInternal): void {
  const attachments = runtime.latestContextBuildResult?.metaUserAttachments;
  if (!attachments) return;
  const currentContent = (source: string) =>
    attachments.find((item) => item.source === source)?.content;
  const entries = runtime.messageHistory.borrowReadOnlyRuntimeEntries();
  const isStale = (entry: RuntimeMessageEntry) =>
    entry.kind === "attachment" &&
    REFRESHED_ON_LOAD_SOURCES.has(entry.metadata.source) &&
    entry.content !== currentContent(entry.metadata.source);
  if (!entries.some(isStale)) return;
  runtime.messageHistory.replaceMessages(
    entries.flatMap((entry) => {
      if (entry.kind !== "attachment" || !isStale(entry)) return [entry];
      const content = currentContent(entry.metadata.source);
      return content ? [{ ...entry, content }] : [];
    }),
  );
}

/** 请求前公告：date。环境、指令、skills、Git 已进入 system prompt。 */
export async function appendRequestAnnouncements(
  runtime: AgentRuntimeInternal,
  state: TurnRequestState,
  traceContext: TraceContext,
  _signal?: AbortSignal,
): Promise<void> {
  await persistAnnouncements(
    runtime,
    state,
    buildRequestAnnouncements(runtime, state.entries),
    traceContext,
  );
}

/**
 * 按给定历史去重后需要宣告的请求前日期；compaction 也用它放置 summary 之前的公告。
 * date 只按来源判断：同一天不重复，跨天才换成变化提醒。
 */
export function buildRequestAnnouncements(
  runtime: AgentRuntimeInternal,
  entries: readonly RuntimeMessageEntry[],
): RuntimeAttachmentEntry[] {
  const previousDate = lastAnnouncedAttachments(entries).get("date");
  // 日期一律取运行时时钟：context snapshot 的日期在会话起点冻结，跨天 compact 后
  // 剩余历史没有日期公告时，回退到它会先宣告一次过期日期。
  const date = formatLocalIsoDate(runtime.now());
  const initialDate = `Today's date is ${date}.`;
  const changedDate = buildDateChangeReminderBody(date);
  if (previousDate?.content === initialDate || previousDate?.content === changedDate) {
    return [];
  }
  return [
    systemReminderAttachmentEntry("date", previousDate ? changedDate : initialDate),
  ];
}

/** compaction 放在 summary 之前的请求前公告：保留段已有的日期不重复。 */
export function buildCompactLeadingAnnouncements(
  runtime: AgentRuntimeInternal,
  keptEntries: readonly RuntimeMessageEntry[],
): RuntimeAttachmentEntry[] {
  const kept = lastAnnouncedAttachments(keptEntries);
  return buildRequestAnnouncements(runtime, keptEntries).filter(
    (entry) => !kept.has(entry.metadata.source),
  );
}

/** compaction 重述 output style 指令；环境、模型已在 system prompt。 */
export function restateContextAfterCompact(
  _runtime: AgentRuntimeInternal,
  preCompactEntries: readonly RuntimeMessageEntry[],
  keptEntries: readonly RuntimeMessageEntry[],
): RuntimeAttachmentEntry[] {
  return restateOutputStyle(preCompactEntries, keptEntries);
}

function restateOutputStyle(
  preCompactEntries: readonly RuntimeMessageEntry[],
  keptEntries: readonly RuntimeMessageEntry[],
): RuntimeAttachmentEntry[] {
  if (lastAnnouncedAttachments(keptEntries).has("output_style_instructions")) return [];
  const latest = lastAnnouncedAttachments(preCompactEntries).get("output_style_instructions");
  return latest && latest.content !== OUTPUT_STYLE_RESET_REMINDER
    ? [systemReminderAttachmentEntry("output_style_instructions", latest.content)]
    : [];
}

function lastAnnouncedAttachments(
  entries: readonly RuntimeMessageEntry[],
): Map<string, RuntimeAttachmentEntry> {
  const last = new Map<string, RuntimeAttachmentEntry>();
  for (const entry of entries) {
    if (entry.kind === "attachment") last.set(entry.metadata.source, entry);
  }
  return last;
}

export async function persistAnnouncements(
  runtime: AgentRuntimeInternal,
  state: TurnRequestState,
  attachments: readonly RuntimeAttachmentEntry[],
  traceContext: TraceContext,
  model?: Model,
): Promise<void> {
  for (const entry of attachments) {
    // 持久化成功才算已宣告；同一历史同时负责恢复、去重和 provider 投影。
    // 与 ToolSearch 公告、compaction 附件同一种隐藏提醒记录：不写顶层 source，
    // 旧版本 App 按封闭列表校验该字段，新值会让它拒绝整个会话。
    // 隐藏提醒不是对话消息，不移动对话指针（compaction 覆盖边界、timeline 锚点读它）。
    await persistRuntimeReminderMessage.call(runtime, entry, traceContext, {
      model,
      anchor: buildProjectionAnchor(traceContext, "synthetic"),
    });
    commitTurnRequestEntries(runtime, state, [entry]);
  }
}
