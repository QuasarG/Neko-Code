import { readFileSync } from "node:fs";
import {
  NekoMemoryBooksAdapter,
  NekoMemorySnapshotStore,
  resolveNekoMemoryRoot,
  resolveNekoMemoryRuntimeDbPath,
} from "@zcode/adapters/neko-memory";
import type { INekoMemoryService } from "./nekoMemory.js";

/**
 * 每次调用新建书架端口：与旧实现一致地按当前磁盘即时读取，不缓存、不轮询，
 * 也不长期持有 runtime SQLite 句柄。
 *
 * 副作用说明：books() 首次解析会 ensure 空书文件（一行标题）。服务侧接受这个
 * 行为——设置页打开即建空书，等于把「还没写过」落成一册空 Markdown，
 * 与 harness 侧会话开始时的 ensure 语义一致，不会覆盖已有内容。
 */
function createBooksAdapter(): NekoMemoryBooksAdapter {
  const memoryRoot = resolveNekoMemoryRoot();
  return new NekoMemoryBooksAdapter(
    memoryRoot,
    new NekoMemorySnapshotStore(resolveNekoMemoryRuntimeDbPath(memoryRoot)),
  );
}

/** 正文缺失按空书计 0 字节，不把 IO 抖动抛给设置页。 */
function readFileBytes(path: string): number {
  try {
    return readFileSync(path).length;
  } catch {
    return 0;
  }
}

/** 身份 key 与仓库约定一致：workspaceIdentity 优先，否则 workspacePath。 */
function resolveWorkspaceKey(params: {
  workspacePath?: string | null;
  workspaceIdentity?: string;
}): string | null {
  return params.workspaceIdentity?.trim() || params.workspacePath?.trim() || null;
}

/**
 * 六本书只读服务：listBooks 给目录与字节/预算，readBook 给整本正文。
 * 编辑一律走 agent 的 Edit/Write（预算闸门在 harness），服务面无写入。
 */
export function createNekoMemoryService(): INekoMemoryService {
  return {
    async listBooks(params) {
      const adapter = createBooksAdapter();
      const books = adapter
        .books({
          ...(params.workspacePath?.trim() ? { workspacePath: params.workspacePath } : {}),
          ...(params.workspaceIdentity?.trim()
            ? { workspaceIdentity: params.workspaceIdentity }
            : {}),
        })
        .map((book) => ({
          scope: book.scope,
          kind: book.kind,
          label: book.label,
          path: book.path,
          relativePath: book.relativePath,
          bytes: readFileBytes(book.path),
          budgetBytes: book.budgetBytes,
        }));
      return {
        workspaceKey: resolveWorkspaceKey(params),
        books,
        loadedAt: Date.now(),
      };
    },

    async readBook(params) {
      const adapter = createBooksAdapter();
      // 先按路径认书再读正文：readBook 是 RPC 暴露面，必须拒绝记忆根之外的任意文件。
      if (!adapter.bookForPath(params.path)) {
        throw new Error(`Not a Neko memory book: ${params.path}`);
      }
      const content = adapter.readBook(params.path);
      if (content === undefined) {
        throw new Error(`Neko memory book not found: ${params.path}`);
      }
      return { path: params.path, content };
    },
  };
}
