import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import { WardrobeFileStore } from "../src/wardrobe/store.js";

const dirs: string[] = [];
const stores: WardrobeFileStore[] = [];

async function freshEnv(): Promise<{ definitionsPath: string; stateDbPath: string }> {
  const dir = await mkdtemp(join(tmpdir(), "neko-wardrobe-"));
  dirs.push(dir);
  return {
    definitionsPath: join(dir, "wardrobe", "wardrobe.json"),
    stateDbPath: join(dir, "runtime", "wardrobe.sqlite"),
  };
}

function freshStore(env: { definitionsPath: string; stateDbPath: string }): WardrobeFileStore {
  const store = new WardrobeFileStore(env);
  stores.push(store);
  return store;
}

afterEach(async () => {
  while (stores.length) stores.pop()?.close();
  while (dirs.length) {
    await rm(dirs.pop() as string, { recursive: true, force: true });
  }
});

const VALID_DEFINITIONS = {
  parts: [
    { id: "ankle-chain", slot: "ankle", name: "细脚链", description: "素链" },
    { id: "white-socks", slot: "legs", name: "白袜", description: "过膝" },
  ],
  outfits: [{ id: "default", name: "日常", parts: { ankle: "ankle-chain" } }],
};

describe("WardrobeFileStore.loadDefinitions", () => {
  it("degrades to an empty wardrobe with an error when the file is missing", async () => {
    const env = await freshEnv();
    const store = freshStore(env);
    const { definitions, error } = store.loadDefinitions();
    expect(definitions).toEqual({ parts: [], outfits: [] });
    expect(error).toContain(env.definitionsPath);
  });

  it("loads a valid wardrobe.json", async () => {
    const env = await freshEnv();
    await mkdir(dirname(env.definitionsPath), { recursive: true });
    await writeFile(env.definitionsPath, JSON.stringify(VALID_DEFINITIONS), "utf8");
    const store = freshStore(env);
    const { definitions, error } = store.loadDefinitions();
    expect(error).toBeUndefined();
    expect(definitions).toEqual(VALID_DEFINITIONS);
  });

  it("degrades on broken JSON syntax", async () => {
    const env = await freshEnv();
    await mkdir(dirname(env.definitionsPath), { recursive: true });
    await writeFile(env.definitionsPath, "{ not json", "utf8");
    const store = freshStore(env);
    const { definitions, error } = store.loadDefinitions();
    expect(definitions).toEqual({ parts: [], outfits: [] });
    expect(error).toContain(env.definitionsPath);
  });

  it("degrades on wrong shapes with a readable message", async () => {
    const env = await freshEnv();
    await mkdir(dirname(env.definitionsPath), { recursive: true });
    await writeFile(env.definitionsPath, JSON.stringify({ parts: [{}], outfits: [] }), "utf8");
    const store = freshStore(env);
    const { definitions, error } = store.loadDefinitions();
    expect(definitions).toEqual({ parts: [], outfits: [] });
    expect(error).toContain("parts[0]");
  });

  it("degrades when core validation rejects dangling outfit references", async () => {
    const env = await freshEnv();
    await mkdir(dirname(env.definitionsPath), { recursive: true });
    const broken = {
      parts: VALID_DEFINITIONS.parts,
      outfits: [{ id: "broken", name: "悬空", parts: { ankle: "ghost-part" } }],
    };
    await writeFile(env.definitionsPath, JSON.stringify(broken), "utf8");
    const store = freshStore(env);
    const { definitions, error } = store.loadDefinitions();
    expect(definitions).toEqual({ parts: [], outfits: [] });
    expect(error).toContain("ghost-part");
  });
});

describe("WardrobeFileStore state", () => {
  it("seeds a default state whose lastUserAt is now", async () => {
    const env = await freshEnv();
    const store = freshStore(env);
    const before = Date.now();
    const state = store.loadState();
    const after = Date.now();
    expect(state).toEqual({
      current: {},
      locked: false,
      version: 1,
      lastUserAt: expect.any(Number),
    });
    expect(state.lastUserAt).toBeGreaterThanOrEqual(before);
    expect(state.lastUserAt).toBeLessThanOrEqual(after);
  });

  it("round-trips state through saveState/loadState", async () => {
    const env = await freshEnv();
    const store = freshStore(env);
    store.loadState();
    store.saveState({
      current: { ankle: "ankle-chain" },
      locked: true,
      version: 2,
      lastUserAt: 1234,
    });
    expect(store.loadState()).toEqual({
      current: { ankle: "ankle-chain" },
      locked: true,
      version: 2,
      lastUserAt: 1234,
    });
  });

  it("falls back to an empty current when the stored JSON is corrupted", async () => {
    const env = await freshEnv();
    const store = freshStore(env);
    store.loadState();
    store.saveState({
      current: { ankle: "ankle-chain" },
      locked: false,
      version: 2,
      lastUserAt: 1234,
    });
    store.close();
    stores.pop();

    // 直接改库模拟手改损坏：current 不是 JSON 对象时其余状态保留。
    const db = new DatabaseSync(env.stateDbPath);
    db.exec("UPDATE wardrobe_state SET current = 'not-json' WHERE id = 1");
    db.close();

    const reopened = freshStore(env);
    expect(reopened.loadState()).toEqual({
      current: {},
      locked: false,
      version: 2,
      lastUserAt: 1234,
    });
  });

  it("state survives a new store instance on the same db", async () => {
    const env = await freshEnv();
    const first = freshStore(env);
    first.loadState();
    first.saveState({
      current: { legs: "white-socks" },
      locked: false,
      version: 5,
      lastUserAt: 99,
    });
    first.close();
    stores.pop();

    const second = freshStore(env);
    expect(second.loadState()).toEqual({
      current: { legs: "white-socks" },
      locked: false,
      version: 5,
      lastUserAt: 99,
    });
  });
});

describe("WardrobeFileStore.saveDefinitions", () => {
  it("writes pretty JSON with a trailing newline and loads it back", async () => {
    const env = await freshEnv();
    const store = freshStore(env);
    store.saveDefinitions(VALID_DEFINITIONS);
    const raw = await readFile(env.definitionsPath, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain('"ankle-chain"');
    const { definitions, error } = store.loadDefinitions();
    expect(error).toBeUndefined();
    expect(definitions).toEqual(VALID_DEFINITIONS);
  });

  it("atomically replaces previous definitions", async () => {
    const env = await freshEnv();
    const store = freshStore(env);
    store.saveDefinitions(VALID_DEFINITIONS);
    const next = { parts: [VALID_DEFINITIONS.parts[0]], outfits: [] };
    store.saveDefinitions(next);
    const { definitions } = store.loadDefinitions();
    expect(definitions).toEqual(next);
  });
});
