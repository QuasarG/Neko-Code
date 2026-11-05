import {
  SessionEventType,
  createMessageId,
  createModelId,
  createModelProviderId,
  createPartId,
  modelMessageContentToText,
  traceContextToLogContext,
  type MessageId,
  type MessageProjectionAnchor,
  type MessageWithParts,
  type Model,
  type TraceContext,
} from "@zcode/contracts";
import {
  INTERRUPT_MARKER_SOURCE,
  isRuntimeAttachmentEntry,
  type RuntimeMessageEntry,
  type RuntimeMessageMetadata,
} from "../../agent/message-history.js";
import { isNekoMemoryContextSource } from "../../neko-memory/context-sources.js";
import type { AgentRuntimeInternal } from "../internal.js";

/** 普通收集和 compact 共用隐藏提醒落盘，正文与 runtime metadata 写入同一 text part。 */
export async function persistRuntimeReminderMessage(
  this: AgentRuntimeInternal,
  entry: RuntimeMessageEntry,
  traceContext: TraceContext,
  options: RuntimeReminderMessageOptions = {},
): Promise<MessageId | undefined> {
  if (!this.sessionStore) return;
  const record = buildRuntimeReminderMessage(this, entry, options);
  if (!record) return;
  try {
    await this.persistMessage(record.info, traceContext);
    for (const part of record.parts) await this.persistPart(part, traceContext);
    const source = record.info.semantics?.source;
    if (isNekoMemoryContextSource(source)) {
      await emitContextInjected.call(this, record, source, traceContext);
    }
    return record.info.id;
  } catch (error) {
    await removeRuntimePersistenceMessagesBestEffort.call(this, [record.info.id], traceContext);
    throw error;
  }
}

/**
 * 记忆注入的可见性事件：正文已经落库，产品投影只消费这一份。
 * 事件失败不能回滚已写好的模型上下文（重试会让同一轮重复注入），故只记日志。
 */
async function emitContextInjected(
  this: AgentRuntimeInternal,
  record: MessageWithParts,
  source: string,
  traceContext: TraceContext,
): Promise<void> {
  const text = record.parts.find((part) => part.type === "text")?.text;
  if (!text) return;
  try {
    await this.appendEvent(
      this.createEvent(
        SessionEventType.ContextInjected,
        { source, text, messageId: record.info.id },
        traceContext,
      ),
      traceContext,
    );
  } catch (error) {
    this.logger?.warn("Context injection event persistence failed", {
      ...traceContextToLogContext(traceContext),
      errorMessage: error instanceof Error ? error.message : String(error),
      event: "runtime.context_injected.failed",
      module: "core.runtime",
      source,
    });
  }
}

interface RuntimeReminderMessageOptions {
  created?: number;
  model?: Model;
  anchor?: MessageProjectionAnchor;
}

/** 只构建隐藏提醒记录，不写入；compact 用它把整组记录交给同一事务。 */
export function buildRuntimeReminderMessage(
  runtime: AgentRuntimeInternal,
  entry: RuntimeMessageEntry,
  options: RuntimeReminderMessageOptions = {},
): MessageWithParts | undefined {
  if (!entry.metadata) return;
  // 中断标记是普通 user 文本，不是 system-reminder 附件，正文取消息文本。
  const content = isRuntimeAttachmentEntry(entry)
    ? entry.content
    : entry.metadata.toolSearchAnnouncement || entry.metadata.source === INTERRUPT_MARKER_SOURCE
      ? modelMessageContentToText(entry.message.content)
      : undefined;
  if (content === undefined) return;

  const created = options.created ?? Date.now();
  const messageID = createMessageId();
  return {
    info: {
      id: messageID,
      sessionID: runtime.sessionId,
      role: "user",
      time: { created },
      agent: runtime.config.agentName ?? "zcode-agent",
      metadata: reminderPartMetadata(entry.metadata),
      modelSelection: resolvePersistedReminderModel(runtime, options.model),
      ...(options.anchor ? { anchor: options.anchor } : {}),
      semantics: {
        origin: "agent_runtime",
        kind: "system_reminder",
        source: entry.metadata.source,
        uiVisibility: "hidden",
        providerVisibility: "visible",
        transcriptVisibility: "hidden",
      },
      synthetic: true,
      // 工具名单与 system prompt 只写在用户输入记录上：隐藏提醒条数多，每条都存一份会让数据库重复膨胀。
      visibility: "model-only",
    },
    parts: [
      {
        id: createPartId(),
        sessionID: runtime.sessionId,
        messageID,
        type: "text",
        text: content,
        synthetic: true,
        time: { start: created, end: created },
        metadata: reminderPartMetadata(entry.metadata),
      },
    ],
  };
}

export function resolvePersistedReminderModel(runtime: AgentRuntimeInternal, model?: Model) {
  if (model) return { providerId: model.providerId, modelId: model.modelId };
  const selection = runtime.getSessionModelSelection();
  return selection
    ? {
        providerId: createModelProviderId(selection.providerId),
        modelId: createModelId(selection.modelId),
      }
    : undefined;
}

export async function removeRuntimePersistenceMessagesBestEffort(
  this: AgentRuntimeInternal,
  messageIds: readonly MessageId[],
  traceContext: TraceContext,
): Promise<void> {
  if (!this.sessionStore) return;
  for (const rollbackMessageId of new Set(messageIds)) {
    try {
      await this.sessionStore.removeMessage({
        sessionID: this.sessionId,
        messageID: rollbackMessageId,
      });
    } catch (cleanupError) {
      this.logger?.warn("Runtime message persistence cleanup failed", {
        ...traceContextToLogContext(traceContext),
        errorMessage: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        event: "runtime.persistence.cleanup_failed",
        messageId: rollbackMessageId,
        module: "core.runtime",
      });
    }
  }
}

function reminderPartMetadata(runtimeMessage: RuntimeMessageMetadata): Record<string, unknown> {
  return { runtimeMessage, source: runtimeMessage.source, visibility: "model-only" };
}
