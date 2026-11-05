import { ServiceChannels } from "@zcode/shared";
import { createServiceDescriptor } from "../descriptors.js";

/** 六本书之一：固定路径、固定预算，正文就是磁盘上的 Markdown 文件。 */
export interface NekoMemoryBookEntry {
  scope: "global" | "project";
  kind: string;
  /** 中文标签：档案 / 约定 / 经历 / 做法。 */
  label: string;
  /** 书的绝对路径。 */
  path: string;
  /** 相对记忆根的路径，正斜杠。 */
  relativePath: string;
  /** 当前正文的 UTF-8 字节数。 */
  bytes: number;
  /** 活跃正文上限（UTF-8 字节）。 */
  budgetBytes: number;
}

export interface NekoMemorySnapshot {
  /** workspaceIdentity 优先、否则 workspacePath；两者都没有时为 null。 */
  workspaceKey: string | null;
  books: NekoMemoryBookEntry[];
  /** 本次快照的读取时间，供 UI 区分刷新批次。 */
  loadedAt: number;
}

export interface NekoMemoryBookBody {
  path: string;
  content: string;
}

/**
 * Neko 记忆六本书只读服务。
 *
 * 写入只属于 agent 的 Read/Edit 文件工具（预算闸门在 harness）；
 * 这里只暴露书目录（label、路径、字节/预算）与整本正文，
 * 不提供任何编辑面。
 */
export interface INekoMemoryService {
  /** 列出可见的书：全局四本 + 项目两本（workspace 命中项目时）。 */
  listBooks(params: {
    workspacePath?: string | null;
    workspaceIdentity?: string;
  }): Promise<NekoMemorySnapshot>;

  /** 读一本书的完整正文；path 必须来自 listBooks 的条目。 */
  readBook(params: { path: string }): Promise<NekoMemoryBookBody>;
}

export const INekoMemoryService = createServiceDescriptor<INekoMemoryService>(
  ServiceChannels.NekoMemory,
);
