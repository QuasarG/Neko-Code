// ============================================================
// Wardrobe Contracts - global outfit state, independent of memory books
// ============================================================

/** 一件可穿戴的部件；槽位是小写字母/数字/连字符的 slug。 */
export interface WardrobePart {
  id: string;
  slot: string;
  name: string;
  description: string;
}

/** 一套命名组合：槽位 → part id。 */
export interface WardrobeOutfit {
  id: string;
  name: string;
  parts: Record<string, string>;
}

/** 定义文件 wardrobe.json 的内容；手改后由加载器校验。 */
export interface WardrobeDefinitions {
  parts: WardrobePart[];
  outfits: WardrobeOutfit[];
}

/** 运行状态：当前穿着、锁定、版本、最后用户活动时间。 */
export interface WardrobeState {
  /** 槽位 → part id；空对象表示什么都没穿。 */
  current: Record<string, string>;
  /** 锁定当前这套；锁定后 wear/clear/自动换装全部拒绝。 */
  locked: boolean;
  /** 每次状态变化递增；注入按版本判断。 */
  version: number;
  /** 最后一次真实用户消息时间（毫秒）；6 小时自动换装的基准。 */
  lastUserAt: number;
}

export type WardrobeAction =
  | "list"
  | "add_part"
  | "update_part"
  | "remove_part"
  | "save_outfit"
  | "delete_outfit"
  | "wear"
  | "clear"
  | "lock"
  | "unlock";

export interface WardrobeError {
  code: string;
  message: string;
  hint?: string;
}

/** wardrobe 工具的统一返回结构；错误也走同一形状。 */
export interface WardrobeToolResult {
  ok: boolean;
  action: WardrobeAction;
  changed: boolean;
  current: Record<string, string>;
  locked: boolean;
  warnings: string[];
  error?: WardrobeError;
}

/** 注入块用的当前着装快照。 */
export interface WardrobeInjection {
  /** 槽位 → part 名称 + 一句短描述。 */
  slots: Array<{ slot: string; name: string; description: string }>;
  locked: boolean;
  version: number;
  /** 本次是否由 6 小时自动换装触发；只有触发会话能看到。 */
  autoChanged: boolean;
}
