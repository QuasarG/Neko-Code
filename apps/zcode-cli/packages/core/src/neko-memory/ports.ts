// ============================================================
// Neko Memory Ports - core-owned boundaries adapters implement
// ============================================================

import type { NekoMemoryBook, NekoMemoryBookSnapshotRow } from "@zcode/contracts/neko-memory";

/**
 * 每会话的投递快照与轮次计数：只留最新一份，不存历史。
 * 快照不是记忆元数据，只是「这个会话上次看到的正文」，用于算 diff。
 */
export interface NekoMemorySnapshotPort {
  getBookSnapshot(
    session: string,
    path: string,
  ): Pick<NekoMemoryBookSnapshotRow, "hash" | "body"> | undefined;
  setBookSnapshot(session: string, path: string, hash: string, body: string): void;
  clearSessionBookSnapshots(session: string): void;

  /**
   * 会话级整数状态：真实用户轮计数（query_count）与已完成的 checkpoint
   * 区间（checkpoint_block）。Edit 记忆书成功后由闸门推进 checkpoint_block。
   */
  getSessionInt(session: string, key: string): number;
  setSessionInt(session: string, key: string, value: number): void;
}

/**
 * 运行时可用的记忆书架：六本固定 Markdown，文件是唯一事实源。
 * 读写走通用文件工具；这里只负责枚举、定位与快照。
 */
export interface NekoMemoryBooksPort {
  readonly memoryRoot: string;

  /**
   * 解析一个会话可见的书：全局四本 + 项目两本（workspace key 命中项目时）。
   * 首次调用会确保文件存在（空文件带标题行）。
   */
  books(input: {
    workspacePath?: string;
    workspaceIdentity?: string;
  }): NekoMemoryBook[];

  /** 按绝对路径识别一本书；Edit/Write 预算闸门用它。 */
  bookForPath(path: string): NekoMemoryBook | undefined;

  /** 读一本书的正文；文件缺失返回 undefined。 */
  readBook(path: string): string | undefined;

  readonly state: NekoMemorySnapshotPort;
}
