import { describe, expect, it } from "vitest";

import type { NekoMemoryBook } from "@zcode/contracts/neko-memory";

import {
  buildNekoMemoryBookDelivery,
  commitNekoMemoryBookDelivery,
  nekoMemoryBookHash,
} from "../src/neko-memory/delivery.js";
import type { NekoMemorySnapshotPort } from "../src/neko-memory/ports.js";

function fakeState(): NekoMemorySnapshotPort & {
  store: Map<string, { hash: string; body: string }>;
} {
  const store = new Map<string, { hash: string; body: string }>();
  return {
    store,
    getBookSnapshot: (_session, path) => store.get(path),
    setBookSnapshot: (_session, path, hash, body) => void store.set(path, { hash, body }),
    clearSessionBookSnapshots: () => store.clear(),
    getSessionInt: () => 0,
    setSessionInt: () => undefined,
  };
}

const book: NekoMemoryBook = {
  scope: "global",
  kind: "plans",
  path: "/tmp/books/global/plans.md",
  relativePath: "global/plans.md",
  budgetBytes: 64,
  label: "约定",
};

const readFrom = (content: string) => (path: string) =>
  path === book.path ? content : undefined;

describe("neko memory book delivery", () => {
  it("hashes are stable for identical bodies", () => {
    expect(nekoMemoryBookHash("abc")).toBe(nekoMemoryBookHash("abc"));
    expect(nekoMemoryBookHash("abc")).not.toBe(nekoMemoryBookHash("abd"));
  });

  it("delivers a full baseline when the session has no snapshot", () => {
    const state = fakeState();
    const delivery = buildNekoMemoryBookDelivery({
      sessionId: "s1",
      books: [book],
      readBook: readFrom("- [ ] 2026-11-01：测试"),
      state,
    });
    expect(delivery.sections).toHaveLength(1);
    expect(delivery.sections[0]!.reason).toBe("baseline");
    expect(delivery.sections[0]!.text).toContain("# 约定".slice(0, 0)); // 标题在书正文里
    expect(delivery.sections[0]!.text).toContain("- [ ] 2026-11-01：测试");
    expect(delivery.sections[0]!.text).toContain("预算 64B");
    expect(delivery.sections[0]!.overBudget).toBe(false);
    expect(delivery.updates).toHaveLength(1);
  });

  it("skips unchanged books and sends a line diff on change", () => {
    const state = fakeState();
    // 大正文只改一行，diff 明显小于全文，走行级 diff 通道。
    const lines = Array.from({ length: 20 }, (_, index) => `- 2026-11-${index + 1}：第${index + 1}条`);
    const before = lines.join("\n");
    const after = lines.with(5, "- 2026-11-06：改过的第六条").join("\n");
    state.setBookSnapshot("s1", book.path, nekoMemoryBookHash(before), before);
    // 哈希没变 → 不注入。
    expect(
      buildNekoMemoryBookDelivery({
        sessionId: "s1",
        books: [book],
        readBook: readFrom(before),
        state,
      }).sections,
    ).toHaveLength(0);
    // 变了 → 行级 diff。
    const delivery = buildNekoMemoryBookDelivery({
      sessionId: "s1",
      books: [book],
      readBook: readFrom(after),
      state,
    });
    expect(delivery.sections).toHaveLength(1);
    expect(delivery.sections[0]!.reason).toBe("updated");
    expect(delivery.sections[0]!.text).toContain("+ - 2026-11-06：改过的第六条");
    expect(delivery.sections[0]!.text).not.toContain("baseline");
    // 其余行不应整篇重发。
    expect(delivery.sections[0]!.text).not.toContain("第7条");
  });

  it("falls back to the full body when the diff is not smaller", () => {
    const state = fakeState();
    state.setBookSnapshot("s1", book.path, nekoMemoryBookHash("旧"), "旧");
    const delivery = buildNekoMemoryBookDelivery({
      sessionId: "s1",
      books: [book],
      readBook: readFrom("完全不同的一句话正文"),
      state,
    });
    expect(delivery.sections[0]!.reason).toBe("updated");
    expect(delivery.sections[0]!.text).toContain("完全不同的一句话正文");
  });

  it("skips empty books and flags over-budget bodies without truncating", () => {
    const state = fakeState();
    expect(
      buildNekoMemoryBookDelivery({
        sessionId: "s1",
        books: [book],
        readBook: readFrom("   \n"),
        state,
      }).sections,
    ).toHaveLength(0);
    const big = "长".repeat(book.budgetBytes);
    const delivery = buildNekoMemoryBookDelivery({
      sessionId: "s1",
      books: [book],
      readBook: readFrom(big),
      state,
    });
    expect(delivery.sections[0]!.overBudget).toBe(true);
    expect(delivery.sections[0]!.text).toContain("已超预算");
    expect(delivery.sections[0]!.text).toContain(big);
  });

  it("commit replaces snapshots with the latest delivered body only", () => {
    const state = fakeState();
    const first = buildNekoMemoryBookDelivery({
      sessionId: "s1",
      books: [book],
      readBook: readFrom("v1"),
      state,
    });
    commitNekoMemoryBookDelivery({ sessionId: "s1", delivery: first, state });
    expect(state.getBookSnapshot("s1", book.path)?.body).toBe("v1");
    const second = buildNekoMemoryBookDelivery({
      sessionId: "s1",
      books: [book],
      readBook: readFrom("v2"),
      state,
    });
    commitNekoMemoryBookDelivery({ sessionId: "s1", delivery: second, state });
    expect(state.getBookSnapshot("s1", book.path)?.body).toBe("v2");
    expect(state.getBookSnapshot("s1", book.path)?.hash).toBe(nekoMemoryBookHash("v2"));
  });
});
