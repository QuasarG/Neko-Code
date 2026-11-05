// ============================================================
// Wardrobe Injection - current outfit as silent state
// ============================================================

import type { WardrobeDefinitions, WardrobeState } from "@zcode/contracts/wardrobe";

import { resolveWardrobeSlots } from "./model.js";

/** 注入块总预算（UTF-8 字节）；描述超长按字符边界截断。 */
export const WARDROBE_INJECTION_BUDGET_BYTES = 300;

const SILENT_RULE =
  "This is current state, not a change event: do not mention clothing unless the user asks or you changed it this turn.";

/**
 * 渲染 <wardrobe> 注入块。autoChanged 只在触发自动换装的会话里为 true，
 * 该会话可以叙述一次；其他会话只看到状态。
 */
export function renderWardrobeInjection(input: {
  definitions: WardrobeDefinitions;
  state: WardrobeState;
  autoChanged: boolean;
}): string | undefined {
  const slots = resolveWardrobeSlots(input.definitions, input.state.current);
  if (slots.length === 0 && !input.state.locked) return undefined;
  const lines = slots.map((slot) => `- ${slot.slot}: ${slot.name} — ${slot.description}`);
  if (input.state.locked) lines.push("- locked: 这套着装已锁定，只有 zexin 能解锁");
  const autoNote = input.autoChanged
    ? "\nAuto-changed after idle; you may mention the change once."
    : "";
  // 正向基线表述：裸体是底座，下面列出的是附着的全部穿着——
  // 模型由此自然得出"此外没有别的衣物"，负向提示词（"不得出现衣摆"之类）反而污染上下文。
  return `<wardrobe>\nCurrent outfit (state, not an event). Neko's base is fully nude; everything she is wearing is listed below:\n${lines.join("\n")}\n${SILENT_RULE}${autoNote}\n</wardrobe>`;
}

/** 注入块按版本判断：版本没变就不注入（快照由调用方管理）。 */
export function wardrobeInjectionFingerprint(state: WardrobeState): string {
  return `v${state.version}:locked=${state.locked ? 1 : 0}`;
}
