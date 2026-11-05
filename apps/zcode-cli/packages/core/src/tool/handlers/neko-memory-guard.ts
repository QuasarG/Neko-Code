// ============================================================
// Neko Memory Book Guard - budget gate, checkpoint, shell refusal
// ============================================================
//
// Edit/Write 落盘前的预算闸门、Edit 成功后的 checkpoint 推进与 Bash 写记忆
// 路径的拒绝共用这一份判定：v2 里文件本身是唯一事实源，所有写入必须经过
// 「改动后字节数 ≤ 书预算」这道门，shell 绕行会同时破坏预算与投递纪律。

import type { NekoMemoryBook } from "@zcode/contracts/neko-memory";
import {
  NEKO_MEMORY_CHECKPOINT_BLOCK_KEY,
  NEKO_MEMORY_QUERY_COUNT_KEY,
  NEKO_MEMORY_UPDATE_INTERVAL,
} from "../../neko-memory/index.js";
import type { NekoMemoryBooksPort } from "../../neko-memory/ports.js";
import type { ToolExecutionContext } from "../types.js";

/**
 * 超预算拒绝消息：书名 + label + 当前字节 + 预算，只指向同一本书内的整理，
 * 明确禁止挪书——一条事实只住一本书，挪走只会把预算问题变成路由问题。
 */
export function nekoMemoryBookBudgetMessage(book: NekoMemoryBook, bytes: number): string {
  return (
    `Neko memory book over budget: ${book.label} (${book.relativePath}) would be ${bytes} ` +
    `bytes after this edit, over its ${book.budgetBytes}-byte budget. Consolidate within ` +
    "the same book: merge same-topic entries, compress experiences older than 30 days " +
    "into a one-line impression, and delete completed commitments. Moving content to " +
    "another book is not allowed."
  );
}

/**
 * Edit 成功落在记忆书上时推进 checkpoint 区间：一次成功的记忆写入满足当前
 * 十轮区间（spec §6），checkpoint 提醒关闭到下一个区间。写入发生在工具调用时，
 * 查询计数已在本轮投递时登记，因此直接按当前 query_count 归位区间号。
 */
export function completeNekoMemoryCheckpointForEdit(
  context: ToolExecutionContext,
  filePath: string,
): void {
  const books = context.nekoMemoryBooks;
  if (!books?.bookForPath(filePath)) return;
  const queries = books.state.getSessionInt(context.sessionId, NEKO_MEMORY_QUERY_COUNT_KEY);
  books.state.setSessionInt(
    context.sessionId,
    NEKO_MEMORY_CHECKPOINT_BLOCK_KEY,
    Math.floor(queries / NEKO_MEMORY_UPDATE_INTERVAL),
  );
}

/** shell 写特征：重定向与常见改写命令；前置条件是命令已包含记忆根路径。 */
const SHELL_WRITE_PATTERNS: readonly RegExp[] = [
  />/, // > 与 >> 重定向
  /\btee\b/,
  /\bsed\b[^|;&]*-i/,
  /\b(mv|cp|rm|dd|truncate|install)\b/,
];

/**
 * Bash 写记忆路径的判定：命令字符串包含记忆根且命中任一写特征。
 * 单词边界避免 format 误伤 rm、add 误伤 dd；sed 只认带 -i 的原地改写。
 */
export function isNekoMemoryShellWrite(books: NekoMemoryBooksPort, command: string): boolean {
  if (!command.includes(books.memoryRoot)) return false;
  return SHELL_WRITE_PATTERNS.some((pattern) => pattern.test(command));
}

/** Bash 拒写消息：记忆书只能经 Edit/Write 走预算闸门。 */
export const NEKO_MEMORY_SHELL_REFUSAL_MESSAGE =
  "Neko memory books can only be modified with Edit/Write (subject to the book budget); " +
  "this shell command writes to the memory root and was refused.";
