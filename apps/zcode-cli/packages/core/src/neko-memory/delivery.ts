// ============================================================
// Neko Memory Book Delivery - hash compare + line diff per book
// ============================================================

import { createHash } from "node:crypto";

import type {
  NekoMemoryBook,
  NekoMemoryBookDelivery,
  NekoMemoryBookSection,
  NekoMemoryBookUpdate,
  NekoMemoryDeliveryReason,
} from "@zcode/contracts/neko-memory";

import { diffNekoMemoryBodies } from "./diff.js";
import type { NekoMemorySnapshotPort } from "./ports.js";

export function nekoMemoryBookHash(body: string): string {
  return createHash("sha256").update(Buffer.from(body, "utf8")).digest("hex");
}

function renderSection(
  book: NekoMemoryBook,
  reason: NekoMemoryDeliveryReason,
  body: string,
  previousBody: string | undefined,
): string {
  const bytes = Buffer.byteLength(body, "utf8");
  const over = bytes > book.budgetBytes;
  const header =
    `### ${book.label} · ${book.relativePath}` +
    `（预算 ${book.budgetBytes}B，当前 ${bytes}B${over ? "，已超预算：整理时先压缩这本书，不要挪到别的书" : ""}）`;
  if (reason === "baseline") {
    return `${header}\n${body}`;
  }
  const diff = previousBody ? diffNekoMemoryBodies(previousBody, body) : null;
  if (!diff || diff.length === 0) {
    return `${header}\n${body}`;
  }
  const lines = diff.map((line) => `${line.kind} ${line.text}`);
  return `${header}\n自上次投递的行级 diff（先删后加）：\n${lines.join("\n")}`;
}

/**
 * 计算本次要注入的书段。纯函数：只读快照与正文，不提交写入；
 * 调用方在用户消息持久化之后，再提交 updates。
 */
export function buildNekoMemoryBookDelivery(input: {
  sessionId: string;
  books: readonly NekoMemoryBook[];
  readBook: (path: string) => string | undefined;
  state: NekoMemorySnapshotPort;
}): NekoMemoryBookDelivery {
  const sections: NekoMemoryBookSection[] = [];
  const updates: NekoMemoryBookUpdate[] = [];
  for (const book of input.books) {
    const body = input.readBook(book.path);
    if (body === undefined || !body.trim()) continue;
    const hash = nekoMemoryBookHash(body);
    const snapshot = input.state.getBookSnapshot(input.sessionId, book.path);
    if (snapshot && snapshot.hash === hash) continue;
    const reason: NekoMemoryDeliveryReason = snapshot ? "updated" : "baseline";
    sections.push({
      book,
      reason,
      text: renderSection(book, reason, body, snapshot?.body),
      overBudget: Buffer.byteLength(body, "utf8") > book.budgetBytes,
    });
    updates.push({ path: book.path, hash, body });
  }
  return { sections, updates };
}

/**
 * 提交一次投递的快照更新。必须在注入成功持久化之后调用；
 * 失败请求的快照随下一次查询重算，不会留下「已投递」的假账。
 */
export function commitNekoMemoryBookDelivery(input: {
  sessionId: string;
  delivery: NekoMemoryBookDelivery;
  state: NekoMemorySnapshotPort;
}): void {
  for (const update of input.delivery.updates) {
    input.state.setBookSnapshot(input.sessionId, update.path, update.hash, update.body);
  }
}
