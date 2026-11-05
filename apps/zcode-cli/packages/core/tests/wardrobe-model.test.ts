import { describe, expect, it } from "vitest";

import type { WardrobeDefinitions, WardrobeState } from "@zcode/contracts/wardrobe";

import {
  normalizeWardrobeSlot,
  pickRandomWardrobeOutfit,
  resolveWardrobeSlots,
  validateWardrobeDefinitions,
  validateWardrobeSelection,
} from "../src/wardrobe/model.js";
import { maybeAutoChangeWardrobe, type WardrobeStorePort } from "../src/wardrobe/ports.js";
import {
  renderWardrobeInjection,
  wardrobeInjectionFingerprint,
  WARDROBE_INJECTION_BUDGET_BYTES,
} from "../src/wardrobe/injection.js";

const HAIRPIN = { id: "pin", slot: "head", name: "发夹", description: "一枚普通发夹" };
const CHAIN = { id: "chain", slot: "ankle", name: "细脚链", description: "素链" };
const TEE = { id: "tee", slot: "torso", name: "宽大短袖", description: "zexin 的旧短袖" };

const definitions: WardrobeDefinitions = {
  parts: [HAIRPIN, CHAIN, TEE],
  outfits: [
    { id: "daily", name: "日常", parts: { head: "pin", ankle: "chain" } },
    { id: "tee-day", name: "短袖日", parts: { head: "pin", torso: "tee" } },
  ],
};

function fakeStore(input?: {
  definitions?: WardrobeDefinitions;
  error?: string;
  state?: Partial<WardrobeState>;
}): WardrobeStorePort & { savedState: WardrobeState[]; savedDefinitions: WardrobeDefinitions[] } {
  const state: WardrobeState = {
    current: { head: "pin", ankle: "chain" },
    locked: false,
    version: 3,
    lastUserAt: 0,
    ...input?.state,
  };
  const savedState: WardrobeState[] = [];
  const savedDefinitions: WardrobeDefinitions[] = [];
  return {
    savedState,
    savedDefinitions,
    definitionsPath: "/tmp/wardrobe/wardrobe.json",
    loadDefinitions: () => ({
      definitions: input?.definitions ?? definitions,
      ...(input?.error ? { error: input.error } : {}),
    }),
    loadState: () => state,
    saveState: (next) => {
      savedState.push(next);
      Object.assign(state, next);
    },
    saveDefinitions: (next) => savedDefinitions.push(next),
  };
}

describe("wardrobe model", () => {
  it("normalizes slots and rejects the invalid", () => {
    expect(normalizeWardrobeSlot("  Head Gear ")).toBe("head-gear");
    expect(() => normalizeWardrobeSlot("!!!")).toThrow(/slot/);
    expect(() => normalizeWardrobeSlot("a".repeat(33))).toThrow(/slot/);
  });

  it("validates definitions: duplicates, dangling refs, empty outfits", () => {
    expect(() =>
      validateWardrobeDefinitions({
        parts: [HAIRPIN, { ...HAIRPIN, name: "重复" }],
        outfits: definitions.outfits,
      }),
    ).toThrow(/duplicate part/);
    expect(() =>
      validateWardrobeDefinitions({
        parts: [HAIRPIN],
        outfits: [{ id: "x", name: "悬空", parts: { ankle: "chain" } }],
      }),
    ).toThrow(/unknown part/);
    expect(() =>
      validateWardrobeDefinitions({ parts: [HAIRPIN], outfits: [{ id: "x", name: "空", parts: {} }] }),
    ).toThrow(/at least one part/);
    expect(() => validateWardrobeDefinitions(definitions)).not.toThrow();
  });

  it("selection validation catches slot mismatch and unknown ids", () => {
    expect(validateWardrobeSelection(definitions, { head: "pin" })).toEqual({ head: "pin" });
    expect(() => validateWardrobeSelection(definitions, { ankle: "pin" })).toThrow(/belongs to slot/);
    expect(() => validateWardrobeSelection(definitions, { head: "ghost" })).toThrow(/unknown part/);
  });

  it("random pick never returns the current outfit", () => {
    let calls = 0;
    const random = () => {
      calls += 1;
      return 0.99;
    };
    const picked = pickRandomWardrobeOutfit(definitions, { head: "pin", ankle: "chain" }, random);
    expect(picked?.id).toBe("tee-day");
    expect(calls).toBe(1);
    // 只有一套、或全部等于当前 → 无可换。
    expect(
      pickRandomWardrobeOutfit(
        { parts: definitions.parts, outfits: [definitions.outfits[0]!] },
        { head: "pin", ankle: "chain" },
      ),
    ).toBeUndefined();
  });

  it("resolveWardrobeSlots drops dangling refs and sorts by slot", () => {
    const slots = resolveWardrobeSlots(definitions, { torso: "tee", ankle: "ghost", head: "pin" });
    expect(slots.map((slot) => slot.slot)).toEqual(["head", "torso"]);
  });
});

describe("maybeAutoChangeWardrobe", () => {
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  it("does nothing before six hours, when locked, or with a broken config", () => {
    const fresh = fakeStore({ state: { lastUserAt: 10_000 } });
    expect(
      maybeAutoChangeWardrobe({ store: fresh, now: 10_000 + SIX_HOURS - 1 }).changed,
    ).toBe(false);
    const locked = fakeStore({ state: { locked: true, lastUserAt: 0 } });
    expect(maybeAutoChangeWardrobe({ store: locked, now: SIX_HOURS }).changed).toBe(false);
    const broken = fakeStore({ error: "bad json" });
    expect(maybeAutoChangeWardrobe({ store: broken, now: SIX_HOURS }).changed).toBe(false);
  });

  it("randomly swaps to a different outfit and bumps the version", () => {
    const store = fakeStore({ state: { lastUserAt: 0 } });
    const result = maybeAutoChangeWardrobe({
      store,
      now: SIX_HOURS,
      random: () => 0.99,
    });
    expect(result.changed).toBe(true);
    expect(result.state.version).toBe(4);
    expect(result.state.current).toEqual({ head: "pin", torso: "tee" });
    expect(store.savedState).toHaveLength(1);
    // lastUserAt 由调用方在 query 时刷新，helper 不动它。
    expect(result.state.lastUserAt).toBe(0);
  });
});

describe("wardrobe injection", () => {
  const state: WardrobeState = {
    current: { head: "pin", ankle: "chain" },
    locked: false,
    version: 3,
    lastUserAt: 0,
  };

  it("renders slots, the silent rule, and the locked line", () => {
    const text = renderWardrobeInjection({ definitions, state, autoChanged: false })!;
    expect(text).toContain("<wardrobe>");
    expect(text).toContain("head: 发夹");
    expect(text).toContain("ankle: 细脚链");
    expect(text).toContain("do not mention clothing");
    expect(text).not.toContain("Auto-changed");
    expect(Buffer.byteLength(text, "utf8")).toBeLessThanOrEqual(
      WARDROBE_INJECTION_BUDGET_BYTES + 400,
    );
    const locked = renderWardrobeInjection({
      definitions,
      state: { ...state, locked: true },
      autoChanged: false,
    })!;
    expect(locked).toContain("locked");
  });

  it("adds the one-time auto-change note only for the triggering session", () => {
    const text = renderWardrobeInjection({ definitions, state, autoChanged: true })!;
    expect(text).toContain("Auto-changed after idle");
  });

  it("returns undefined when nothing is worn and unlocked", () => {
    expect(
      renderWardrobeInjection({
        definitions,
        state: { ...state, current: {} },
        autoChanged: false,
      }),
    ).toBeUndefined();
  });

  it("fingerprint changes with version and lock", () => {
    expect(wardrobeInjectionFingerprint(state)).toBe("v3:locked=0");
    expect(wardrobeInjectionFingerprint({ ...state, locked: true })).toBe("v3:locked=1");
  });
});
