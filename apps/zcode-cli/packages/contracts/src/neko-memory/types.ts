// ============================================================
// Neko Memory v2 Contracts - six fixed markdown books
// ============================================================

/** 四类记忆：档案 / 约定 / 经历 / 做法。 */
export type NekoMemoryBookKind = "profile" | "plans" | "experiences" | "playbook";

/** 两级作用域：全局册 + 项目册。 */
export type NekoMemoryBookScope = "global" | "project";

/**
 * 一本固定的记忆书。书的数量、路径、预算都是常量；
 * 模型用 Read/Edit 直接改正文，文件本身就是唯一事实源。
 */
export interface NekoMemoryBook {
  scope: NekoMemoryBookScope;
  kind: NekoMemoryBookKind;
  /** 书的绝对路径。 */
  path: string;
  /** 相对记忆根的路径，正斜杠。 */
  relativePath: string;
  /** 活跃正文上限（UTF-8 字节）。 */
  budgetBytes: number;
  /** 中文标签：档案 / 约定 / 经历 / 做法。 */
  label: string;
}

/** 项目身份：完整 SHA-256 是 ID，目录名只用于人读与排错。 */
export interface NekoProjectIdentity {
  /** workspace key（本地为 realpath，远端为 identity 字符串）的完整 SHA-256 hex。 */
  projectId: string;
  /** 参与哈希的规范 key：本地为 realpath 正斜杠，远端为原字符串。 */
  canonical: string;
  /** 调用方最初提供的路径或 identity。 */
  original: string;
  /** 可读 slug。 */
  name: string;
  /** 磁盘目录名 `<slug>--<hash16>`。 */
  folder: string;
}

/** 每会话每本书的投递快照：只留最新一份，用于行级 diff。 */
export interface NekoMemoryBookSnapshotRow {
  session: string;
  path: string;
  hash: string;
  body: string;
  updatedAt: number;
}

export type NekoMemoryDeliveryReason = "baseline" | "updated";

/** 一本书本次进入上下文的段。 */
export interface NekoMemoryBookSection {
  book: NekoMemoryBook;
  reason: NekoMemoryDeliveryReason;
  /** 直接可拼进 <runtime_memory> 的 Markdown 段。 */
  text: string;
  /** 手改绕过闸门时可能超预算；投递不截断，只警告。 */
  overBudget: boolean;
}

/** 注入成功后要提交的快照更新。 */
export interface NekoMemoryBookUpdate {
  path: string;
  hash: string;
  body: string;
}

export interface NekoMemoryBookDelivery {
  sections: NekoMemoryBookSection[];
  updates: NekoMemoryBookUpdate[];
}
