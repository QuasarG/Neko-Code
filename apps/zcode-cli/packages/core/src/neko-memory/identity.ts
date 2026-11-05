// ============================================================
// Neko Project Identity - workspace key → stable project folder
// ============================================================

import { createHash } from "node:crypto";

import type { NekoProjectIdentity } from "@zcode/contracts/neko-memory";

/**
 * 项目身份沿用 ZCode 的 workspace key：`workspaceIdentity?.trim() || workspacePath`。
 * 本地绝对路径由 adapter 先 realpath，这里只做分隔符规范与哈希派生；
 * 远端 identity 字符串原样参与哈希。换目录＝换一本书，与 ZCode 持久化口径一致。
 */
export function nekoProjectIdentityForKey(key: string): NekoProjectIdentity {
  const trimmed = key.trim();
  const canonical = trimmed.split("\\").join("/").replace(/\/+$/u, "");
  const projectId = createHash("sha256").update(Buffer.from(canonical, "utf8")).digest("hex");
  return {
    projectId,
    canonical,
    original: key,
    name: readableNekoProjectName(canonical),
    folder: nekoProjectFolderName(canonical, projectId),
  };
}

/** basename 的可读 slug；中文目录保留汉字，路径分隔符等替换为 -。 */
export function readableNekoProjectName(canonical: string): string {
  const raw = canonical.split("/").filter(Boolean).at(-1) ?? "project";
  const cleaned = raw
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^[-.]+|[-]+$/gu, "")
    .slice(0, 48);
  return cleaned || "project";
}

/** 项目书架目录名 `<slug>--<hash16>`；哈希是身份，slug 只是可读前缀。 */
export function nekoProjectFolderName(name: string, projectId: string): string {
  const safeName =
    name.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^[-.]+|[-]+$/gu, "") || "project";
  return `${safeName}--${projectId.slice(0, 16)}`;
}
