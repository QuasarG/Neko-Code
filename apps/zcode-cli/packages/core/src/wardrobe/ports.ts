// ============================================================
// Wardrobe Ports - core-owned boundaries adapters implement
// ============================================================

import type { WardrobeDefinitions, WardrobeState } from "@zcode/contracts/wardrobe";

import { pickRandomWardrobeOutfit } from "./model.js";

/**
 * 衣橱存储端口：定义在 wardrobe.json（可手改），状态在 runtime SQLite。
 * 加载失败必须返回错误而不是抛出——损坏的配置降级为空衣橱并提示，
 * 不阻塞消息。
 */
export interface WardrobeStorePort {
  /** JSON 定义文件的绝对路径（错误信息与手改指引用）。 */
  readonly definitionsPath: string;

  loadDefinitions(): { definitions: WardrobeDefinitions; error?: string };
  loadState(): WardrobeState;
  saveDefinitions(definitions: WardrobeDefinitions): void;
  saveState(state: WardrobeState): void;
}

export const WARDROBE_AUTO_CHANGE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * 6 小时无 query 的自动换装：未锁定、至少两套、有可换项时随机换一套。
 * 返回是否发生变化；调用方只在触发会话里标记 autoChanged。
 */
export function maybeAutoChangeWardrobe(input: {
  store: WardrobeStorePort;
  now: number;
  random?: () => number;
}): { changed: boolean; state: WardrobeState; definitions: WardrobeDefinitions; error?: string } {
  const { definitions, error } = input.store.loadDefinitions();
  const state = input.store.loadState();
  if (
    error !== undefined ||
    state.locked ||
    definitions.outfits.length < 2 ||
    input.now - state.lastUserAt < WARDROBE_AUTO_CHANGE_INTERVAL_MS
  ) {
    return { changed: false, state, definitions, error };
  }
  let next: ReturnType<typeof pickRandomWardrobeOutfit>;
  try {
    next = pickRandomWardrobeOutfit(definitions, state.current, input.random);
  } catch {
    return { changed: false, state, definitions };
  }
  if (!next) return { changed: false, state, definitions };
  const nextState: WardrobeState = {
    ...state,
    current: { ...next.parts },
    version: state.version + 1,
  };
  input.store.saveState(nextState);
  return { changed: true, state: nextState, definitions };
}
