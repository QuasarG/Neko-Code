// ============================================================
// Neko Memory v2 Paths - storage roots, project identity, wardrobe paths
// ============================================================

import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";

import type { NekoProjectIdentity } from "@zcode/contracts/neko-memory";
import { nekoProjectIdentityForKey } from "@zcode/core/neko-memory";
import { resolveNekodeCliRoot } from "@zcode/shared/node";

export function resolveNekoMemoryRoot(env: NodeJS.ProcessEnv = process.env): string {
  // 统一根解析：NEKODE_HOME > NEKODE_STORAGE_DIR > NEKODE_ROOT > ~/.nekode；
  // 指向官方 ~/.zcode 的值由 resolver 拒绝并回退。
  return join(resolveNekodeCliRoot(env), "memory");
}

/** 投递快照库放在根旁的 runtime/，绝不与 CLI 会话库混用。 */
export function resolveNekoMemoryRuntimeDbPath(
  memoryRoot: string = resolveNekoMemoryRoot(),
): string {
  return join(dirname(memoryRoot), "runtime", "memory.sqlite");
}

/** 衣橱定义（parts/outfits）是可手改 JSON，与六本书分开存放。 */
export function resolveNekoWardrobeDefinitionsPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(resolveNekodeCliRoot(env), "wardrobe", "wardrobe.json");
}

/** 衣橱运行状态库：与记忆快照一样放 runtime/，但独立文件。 */
export function resolveNekoWardrobeStateDbPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(resolveNekodeCliRoot(env), "runtime", "wardrobe.sqlite");
}

/** 绝对、realpath、正斜杠；目录不存在时保留规范化路径，旧会话身份仍稳定。 */
export function canonicalizeNekoDirectory(directory: string): string {
  const absolute = resolve(directory);
  let canonical = absolute;
  try {
    canonical = realpathSync(absolute);
  } catch {
    // 目录可能已被删除；身份不因旧会话重开而改变。
  }
  return canonical.split(sep).join("/");
}

/**
 * workspace key → 项目身份。本地绝对路径先 realpath 再交给 core 哈希，
 * 保证换 symlink 打开同一目录时仍命中同一本书；远端 identity 字符串
 * 原样参与哈希，非绝对路径不做任何磁盘访问。
 */
export function resolveNekoProjectIdentityForKey(key: string): NekoProjectIdentity {
  if (!isAbsolute(key)) return nekoProjectIdentityForKey(key);
  const identity = nekoProjectIdentityForKey(canonicalizeNekoDirectory(key));
  // core 记录的 original 是 canonical；这里改回调用方最初给的 key，
  // 排错时能看到用户实际的输入。
  return { ...identity, original: key };
}

export function resolveNekoHomeCanonical(): string {
  return canonicalizeNekoDirectory(homedir());
}
