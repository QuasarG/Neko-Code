// ============================================================
// Neko Memory Books Adapter - enumerate, locate and ensure books on disk
// ============================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import type { NekoMemoryBook, NekoProjectIdentity } from "@zcode/contracts/neko-memory";
import {
  type NekoMemoryBooksPort,
  type NekoMemorySnapshotPort,
  findNekoMemoryBookByPath,
  nekoMemoryBookHeader,
  nekoMemoryBooksFor,
} from "@zcode/core/neko-memory";

import {
  canonicalizeNekoDirectory,
  resolveNekoHomeCanonical,
  resolveNekoProjectIdentityForKey,
} from "./paths.js";

/**
 * 运行时可用的记忆书架：六本固定 Markdown，文件是唯一事实源。
 * 这里只负责枚举、定位、确保空文件存在与读正文；写入全部走通用文件工具。
 */
export class NekoMemoryBooksAdapter implements NekoMemoryBooksPort {
  readonly memoryRoot: string;
  readonly state: NekoMemorySnapshotPort;
  /** 已确认存在的书的绝对路径；避免每轮投递对同一批文件反复 stat。 */
  private readonly ensuredBooks = new Set<string>();
  private homeCanonical: string | undefined;

  constructor(memoryRoot: string, state: NekoMemorySnapshotPort) {
    this.memoryRoot = memoryRoot;
    this.state = state;
  }

  books(input: { workspacePath?: string; workspaceIdentity?: string }): NekoMemoryBook[] {
    const key = input.workspaceIdentity?.trim() || input.workspacePath;
    const books = nekoMemoryBooksFor(this.memoryRoot, this.projectForKey(key));
    for (const book of books) this.ensureBookFile(book);
    return books;
  }

  /**
   * workspace key 的三态：home 目录没有项目册；本地非 home 绝对路径
   * realpath 后派生项目身份；远端 identity 字符串原样派生（远端也有项目册）。
   */
  private projectForKey(key: string | undefined): NekoProjectIdentity | undefined {
    if (!key) return undefined;
    if (!isAbsolute(key)) return resolveNekoProjectIdentityForKey(key);
    const canonical = canonicalizeNekoDirectory(key);
    if (canonical === this.home()) return undefined;
    return resolveNekoProjectIdentityForKey(key);
  }

  private home(): string {
    this.homeCanonical ??= resolveNekoHomeCanonical();
    return this.homeCanonical;
  }

  /** 首次见到一本书时建目录并写标题行，让 Edit 的 old_string 有锚点。 */
  private ensureBookFile(book: NekoMemoryBook): void {
    if (this.ensuredBooks.has(book.path)) return;
    mkdirSync(dirname(book.path), { recursive: true, mode: 0o700 });
    if (!existsSync(book.path)) {
      writeFileSync(book.path, nekoMemoryBookHeader(book), { encoding: "utf8", mode: 0o600 });
    }
    this.ensuredBooks.add(book.path);
  }

  bookForPath(path: string): NekoMemoryBook | undefined {
    return findNekoMemoryBookByPath(this.memoryRoot, resolve(path));
  }

  readBook(path: string): string | undefined {
    try {
      return readFileSync(path, "utf8");
    } catch (error) {
      // 书可能被手删：按空书处理，下一次可见时重新 baseline，不抛错。
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
}
