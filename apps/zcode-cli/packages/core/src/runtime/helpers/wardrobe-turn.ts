// ============================================================
// Wardrobe Turn - current outfit as silent per-turn state
// ============================================================
//
// 每个真实用户轮运行一次：先按 6 小时窗口尝试自动换装，再把 lastUserAt 刷成
// 本次 query（顺序不能反，先刷会把窗口吞掉）。注入按版本指纹去重，只有
// current/locked 变化或新会话时下发 `<wardrobe>`；它是状态不是事件——除非
// 本轮就是自动换装的触发者（autoChanged），否则不得主动叙述换装。

import {
  maybeAutoChangeWardrobe,
  renderWardrobeInjection,
  wardrobeInjectionFingerprint,
} from "../../wardrobe/index.js";
import {
  isRuntimeAttachmentEntry,
  systemReminderAttachmentEntry,
} from "../../agent/message-history.js";
import type { TraceContext } from "../deps.js";
import type { AgentRuntimeInternal } from "../internal.js";
import type { RegularTurnLoopState } from "../methods/turn-loop-state.js";
import { persistAnnouncements } from "../methods/context-refresh.js";

/**
 * 衣橱快照借用记忆书的每会话快照表：key 固定 "wardrobe"，hash 是注入指纹，
 * body 恒为空——衣橱注入按版本判断，不需要正文回放。
 */
export const WARDROBE_SNAPSHOT_KEY = "wardrobe";

export async function appendWardrobeAttachment(
  runtime: AgentRuntimeInternal,
  state: RegularTurnLoopState,
  traceContext: TraceContext,
): Promise<void> {
  if (state.wardrobeAttachmentCollected) return;
  const store = runtime.wardrobeStore;
  if (!store) return;
  const latest = state.turnRequestState.entries.findLast(
    (entry) => !isRuntimeAttachmentEntry(entry),
  );
  // 与记忆投递同一条纪律：只服务真实用户轮。model-only 轮不刷新 lastUserAt，
  // 否则 goal 续跑会把 6 小时自动换装的窗口悄悄清零。
  if (
    !latest ||
    isRuntimeAttachmentEntry(latest) ||
    latest.message.role !== "user" ||
    latest.metadata?.source !== "real_user"
  ) {
    return;
  }
  state.wardrobeAttachmentCollected = true;

  const sessionId = runtime.sessionId;
  const now = runtime.now().getTime();
  const auto = maybeAutoChangeWardrobe({ store, now });
  let wardrobeState = auto.state;
  if (wardrobeState.lastUserAt !== now) {
    wardrobeState = { ...wardrobeState, lastUserAt: now };
    store.saveState(wardrobeState);
  }

  // 注入去重快照挂在记忆书架的 state 通道上；书架缺席（理论上不会与衣橱分离注入）
  // 时跳过注入——没有去重通道的注入会每轮重复，宁可不出声。
  const snapshotPort = runtime.nekoMemoryBooks?.state;
  if (!snapshotPort) return;
  const fingerprint = wardrobeInjectionFingerprint(wardrobeState);
  const snapshot = snapshotPort.getBookSnapshot(sessionId, WARDROBE_SNAPSHOT_KEY);
  if (snapshot?.hash === fingerprint) return;
  const text = renderWardrobeInjection({
    definitions: auto.definitions,
    state: wardrobeState,
    autoChanged: auto.changed,
  });
  if (!text) return;

  await persistAnnouncements(
    runtime,
    state.turnRequestState,
    [systemReminderAttachmentEntry("wardrobe", text)],
    traceContext,
  );
  // 注入持久化成功后才记快照；失败请求下一轮按当前状态重投，不重复叙述。
  snapshotPort.setBookSnapshot(sessionId, WARDROBE_SNAPSHOT_KEY, fingerprint, "");
}
