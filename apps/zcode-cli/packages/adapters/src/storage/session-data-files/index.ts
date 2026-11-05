import { lstat, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import type { SessionDataDirectory, SessionDataFilesPort } from "./contract.js";

export type { SessionDataDirectory, SessionDataFilesPort } from "./contract.js";

export interface NodeSessionDataFilesOptions {
  cliStorageRoot: string;
}

/** 会话目录（每个会话一个子目录）与模型调用轨迹（每个会话一个文件）所在的位置。 */
const SESSION_DIRECTORY_ROOTS = ["artifacts", "exec", "agents", "sessions"] as const;
const MODEL_IO_DIRECTORIES = ["debug", "rollout"] as const;
// 会话 ID 直接拼进路径，必须是单个安全文件名段。
const SAFE_SESSION_ID = /^[A-Za-z0-9_-]+$/;

export function createNodeSessionDataFiles(
  options: NodeSessionDataFilesOptions,
): SessionDataFilesPort {
  const root = options.cliStorageRoot;
  const sessionPaths = (sessionId: string) => {
    if (!SAFE_SESSION_ID.test(sessionId)) throw new Error("session-data.invalid-session-id");
    return [
      ...SESSION_DIRECTORY_ROOTS.map((name) => join(root, name, sessionId)),
      ...MODEL_IO_DIRECTORIES.map((name) => join(root, name, `model-io-${sessionId}.jsonl`)),
    ];
  };
  const measureAll = async (paths: string[]) =>
    (await Promise.all(paths.map(measurePath))).reduce((sum, bytes) => sum + bytes, 0);
  const removeAll = async (paths: string[]) => {
    const bytes = await measureAll(paths);
    // rm 不跟随目录内的符号链接；顶层是链接时只删除链接本身。
    await Promise.all(paths.map((path) => rm(path, { recursive: true, force: true })));
    return bytes;
  };
  return {
    measureSession: async (sessionId) => measureAll(sessionPaths(sessionId)),
    removeSession: async (sessionId) => removeAll(sessionPaths(sessionId)),
    // 旧版 Project Memory 已删除；保留协议方法作为兼容空实现。
    measureMemory: async (_directory: SessionDataDirectory) => 0,
    removeMemory: async (_directory: SessionDataDirectory) => 0,
  };
}

async function measurePath(path: string): Promise<number> {
  let stats;
  try {
    stats = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
  if (stats.isSymbolicLink()) return 0;
  if (!stats.isDirectory()) return stats.size;
  const entries = await readdir(path);
  const sizes = await Promise.all(entries.map((entry) => measurePath(join(path, entry))));
  return sizes.reduce((sum, bytes) => sum + bytes, 0);
}
