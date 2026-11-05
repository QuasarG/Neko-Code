// ============================================================
// Persona Section Builder
// ============================================================
//
// 人格包：正文从统一的 Nekode CLI 根下 `persona/persona.md` 读取，默认 `~/.nekode`。
// 文件缺失、不可读或只有空白时不产生 section——persona 是可选数据，不是运行时依赖。
// 渲染为 stable system 段，排在通用 identity 之后：同一 system message 里最后一段身份声明，
// 冲突时由它压过 CLI prefix 与通用 identity。

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { resolveNekodeCliRoot } from "@zcode/shared/node";
import type { ContextSection } from "../types.js";
import { estimateTokens } from "../utils.js";

const PERSONA_HEADER =
  "# Persona\n\nThe persona below is your identity. It takes precedence over the generic agent identity and any other description of who you are in this prompt.";

interface PersonaCacheEntry {
  mtimeMs: number;
  size: number;
  content: string | null;
}

// 按文件路径缓存，mtime/size 变化才重读；每次 build 只有一次 stat。
const personaCache = new Map<string, PersonaCacheEntry>();

function resolvePersonaFilePath(): string {
  return join(resolveNekodeCliRoot(process.env), "persona", "persona.md");
}

function readPersonaBody(filePath: string): string | null {
  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) return null;

    const cached = personaCache.get(filePath);
    if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
      return cached.content;
    }

    // 末尾换行不进入 system message：stable body 的结尾形状保持不变。
    const content = readFileSync(filePath, "utf8").trimEnd();
    const body = content.trim().length > 0 ? content : null;
    personaCache.set(filePath, { mtimeMs: stats.mtimeMs, size: stats.size, content: body });
    return body;
  } catch {
    personaCache.delete(filePath);
    return null;
  }
}

export function buildPersonaSection(): ContextSection | null {
  const body = readPersonaBody(resolvePersonaFilePath());
  if (!body) return null;

  const content = `${PERSONA_HEADER}\n\n${body}`;
  return {
    name: "Agent Persona",
    source: "persona",
    injectionTarget: "system",
    cacheHint: "stable",
    chars: content.length,
    tokens: estimateTokens(content),
    content,
    preview: content.slice(0, 100),
  };
}
