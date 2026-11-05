export type InterfaceMode = "office" | "coding";

export const INTERFACE_MODE_STORAGE_KEY = "zcode-interface-mode";

/**
 * Nekode：办公/编程模式已整体砍掉，界面固定为 coding。
 * 保留类型与存储键是为了让旧设置、快捷键与广播消息继续能解析，但不再产生 office。
 */
export function normalizeInterfaceMode(_value: unknown): InterfaceMode {
  return "coding";
}
