const NEKO_INJECTION_TAGS = [
  "message_time",
  "runtime_activity",
  "runtime_memory",
  "checkpoint",
  "memory_hint",
  "scratch_pending",
] as const;

const NEKO_INJECTION_START_PATTERN = new RegExp(
  `<(${NEKO_INJECTION_TAGS.join("|")})(?:\\s|>)`,
  "g",
);

const NEKO_INJECTION_BLOCK_PATTERN =
  /^<(message_time|runtime_activity|runtime_memory|checkpoint|memory_hint|scratch_pending)(?:\s|>)/u;

const MEMORY_SECTION_PATTERN = /^### Memory (?:baseline|update|removed):/gmu;

function isLineStartTag(text: string, index: number): boolean {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  const prefix = text.slice(lineStart, index).trim();
  return prefix === "" || prefix === "---";
}

/**
 * 从 start 起是否只剩一组合法注入块。块之间允许空行和 `---` 分隔线；
 * 遇到任何普通文本立即失败，避免把正文里出现的同名标签当成注入。
 */
function consumesInjectionBlocksToEnd(text: string, start: number): boolean {
  let cursor = start;
  while (cursor < text.length) {
    while (cursor < text.length && /\s/u.test(text[cursor] ?? "")) cursor += 1;
    if (cursor >= text.length) return true;

    if (text.startsWith("---", cursor)) {
      const lineEnd = text.indexOf("\n", cursor);
      const separatorEnd = lineEnd === -1 ? text.length : lineEnd + 1;
      if (text.slice(cursor + 3, separatorEnd).trim() !== "") return false;
      cursor = separatorEnd;
      continue;
    }

    const tagMatch = NEKO_INJECTION_BLOCK_PATTERN.exec(text.slice(cursor));
    if (!tagMatch) return false;
    const tag = tagMatch[1];
    const closing = `</${tag}>`;
    const closingIndex = text.indexOf(closing, cursor + tagMatch[0].length);
    if (closingIndex === -1) {
      // 块未闭合时只接受「整段都是这一块」的退化形态；否则宁可留在正文里。
      return cursor === start;
    }
    cursor = closingIndex + closing.length;
  }
  return true;
}

/**
 * 把迁移会话尾部拼接的 Neko 注入块从正文里切出来。
 * 只有从某个行首标签开始、一直到结尾都是注入块时才切分；中间夹普通文本则原样返回。
 */
export function splitUserInputInjectionEpilogue(text: string): {
  body: string;
  epilogue?: string;
} {
  if (!text) return { body: text };
  NEKO_INJECTION_START_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = NEKO_INJECTION_START_PATTERN.exec(text)) !== null) {
    const index = match.index;
    if (!isLineStartTag(text, index)) continue;
    if (!consumesInjectionBlocksToEnd(text, index)) continue;
    return {
      body: text.slice(0, index).trimEnd(),
      epilogue: text.slice(index),
    };
  }
  return { body: text };
}

export interface UserInputEpilogueLabel {
  id: string;
  values?: Record<string, string | number>;
}

/** 根据注入块内容决定披露标题；不是 Neko 注入时返回 null，沿用工作流尾注标题。 */
export function describeUserInputEpilogue(text: string): UserInputEpilogueLabel | null {
  if (text.includes("<runtime_memory>")) {
    const count = text.match(MEMORY_SECTION_PATTERN)?.length ?? 0;
    return count > 0
      ? { id: "chat.userInput.memoryEpilogue.count", values: { count } }
      : { id: "chat.userInput.memoryEpilogue.label" };
  }
  if (text.includes("<checkpoint>")) {
    return { id: "chat.userInput.memoryEpilogue.checkpoint" };
  }
  if (text.includes("<memory_hint>") || text.includes("<scratch_pending>")) {
    return { id: "chat.userInput.memoryEpilogue.hint" };
  }
  if (text.includes("<message_time>") || text.includes("<runtime_activity>")) {
    return { id: "chat.userInput.runtimeEpilogue.label" };
  }
  return null;
}
