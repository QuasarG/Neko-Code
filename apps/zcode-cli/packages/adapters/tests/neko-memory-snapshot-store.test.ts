import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { NekoMemorySnapshotStore } from "../src/neko-memory/snapshot-store.js";

const stores: NekoMemorySnapshotStore[] = [];

function freshStore(): NekoMemorySnapshotStore {
  const store = new NekoMemorySnapshotStore(":memory:");
  stores.push(store);
  return store;
}

afterEach(() => {
  while (stores.length) stores.pop()?.close();
});

describe("NekoMemorySnapshotStore", () => {
  it("returns undefined before the first snapshot and stores the latest only", () => {
    const store = freshStore();
    expect(store.getBookSnapshot("s1", "/books/profile.md")).toBeUndefined();
    store.setBookSnapshot("s1", "/books/profile.md", "hash-a", "# 档案\n");
    expect(store.getBookSnapshot("s1", "/books/profile.md")).toEqual({
      hash: "hash-a",
      body: "# 档案\n",
    });
    store.setBookSnapshot("s1", "/books/profile.md", "hash-b", "# 档案\n\n- 新\n");
    expect(store.getBookSnapshot("s1", "/books/profile.md")).toEqual({
      hash: "hash-b",
      body: "# 档案\n\n- 新\n",
    });
  });

  it("keeps sessions isolated; clearing one leaves the other untouched", () => {
    const store = freshStore();
    store.setBookSnapshot("s1", "/books/profile.md", "hash-a", "body-a");
    store.setBookSnapshot("s2", "/books/profile.md", "hash-b", "body-b");
    store.clearSessionBookSnapshots("s1");
    expect(store.getBookSnapshot("s1", "/books/profile.md")).toBeUndefined();
    expect(store.getBookSnapshot("s2", "/books/profile.md")).toEqual({
      hash: "hash-b",
      body: "body-b",
    });
  });

  it("session ints default to zero and overwrite on set", () => {
    const store = freshStore();
    expect(store.getSessionInt("s1", "query_count")).toBe(0);
    store.setSessionInt("s1", "query_count", 3);
    store.setSessionInt("s1", "checkpoint_block", 10);
    expect(store.getSessionInt("s1", "query_count")).toBe(3);
    store.setSessionInt("s1", "query_count", 4);
    expect(store.getSessionInt("s1", "query_count")).toBe(4);
    expect(store.getSessionInt("s2", "query_count")).toBe(0);
    expect(store.getSessionInt("s1", "checkpoint_block")).toBe(10);
  });

  it("persists across store instances on the same db file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "neko-snapshot-db-"));
    const dbPath = join(dir, "runtime", "memory.sqlite");
    const first = new NekoMemorySnapshotStore(dbPath);
    first.setBookSnapshot("s1", "/books/plans.md", "hash-z", "正文");
    first.setSessionInt("s1", "query_count", 7);
    first.close();

    const second = new NekoMemorySnapshotStore(dbPath);
    stores.push(second);
    expect(second.getBookSnapshot("s1", "/books/plans.md")).toEqual({
      hash: "hash-z",
      body: "正文",
    });
    expect(second.getSessionInt("s1", "query_count")).toBe(7);
    await rm(dir, { recursive: true, force: true });
  });
});
