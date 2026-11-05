// ============================================================
// Neko Memory Context Sources - injectable reminder classification
// ============================================================

/**
 * 记忆三块 + 本轮注入的北京时间 + 衣橱状态：落库/入列后补发 ContextInjected，
 * 产品投影成可折叠的上下文行（时间不落库，事件走当轮合成）。
 * 它们只进入 provider 上下文，不产生用户气泡，也不参与轮次计数。
 * continuity 与 scratch_pending 已随 v2 删除；wardrobe 是全局着装状态注入，
 * 与记忆书共用投递纪律（只服务真实用户轮、按指纹去重）。
 */
export const NEKO_MEMORY_CONTEXT_SOURCES = [
  "runtime_memory",
  "memory_checkpoint",
  "memory_hint",
  "current_time",
  "wardrobe",
] as const;

export type NekoMemoryContextSource = (typeof NEKO_MEMORY_CONTEXT_SOURCES)[number];

const NEKO_MEMORY_CONTEXT_SOURCE_SET: ReadonlySet<string> = new Set(NEKO_MEMORY_CONTEXT_SOURCES);

export function isNekoMemoryContextSource(source: unknown): source is NekoMemoryContextSource {
  return typeof source === "string" && NEKO_MEMORY_CONTEXT_SOURCE_SET.has(source);
}
