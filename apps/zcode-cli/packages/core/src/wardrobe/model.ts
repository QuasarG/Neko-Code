// ============================================================
// Wardrobe Model - validation, limits, random auto-change pick
// ============================================================

import type {
  WardrobeDefinitions,
  WardrobeOutfit,
  WardrobePart,
} from "@zcode/contracts/wardrobe";

export const WARDROBE_SLOT_MAX = 32;
export const WARDROBE_ID_MAX = 100;
export const WARDROBE_NAME_MAX = 100;
export const WARDROBE_DESCRIPTION_MAX_BYTES = 2000;
export const WARDROBE_MAX_PARTS = 100;
export const WARDROBE_MAX_OUTFITS = 50;

/** 槽位 slug：小写字母/数字/连字符。非法直接拒绝，不截断。 */
export function normalizeWardrobeSlot(value: string): string {
  const slot = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/gu, "-");
  if (!slot || slot.length > WARDROBE_SLOT_MAX) {
    throw new Error(`invalid wardrobe slot: ${value}`);
  }
  return slot;
}

function assertId(id: string, label: string): void {
  if (!id || id.length > WARDROBE_ID_MAX) {
    throw new Error(`${label} id must be 1-${WARDROBE_ID_MAX} characters`);
  }
}

function assertName(name: string, label: string): void {
  if (!name || Array.from(name).length > WARDROBE_NAME_MAX) {
    throw new Error(`${label} name must be 1-${WARDROBE_NAME_MAX} characters`);
  }
}

function assertDescription(description: string, label: string): void {
  const bytes = Buffer.byteLength(description, "utf8");
  if (bytes > WARDROBE_DESCRIPTION_MAX_BYTES) {
    throw new Error(
      `${label} description is ${bytes} bytes, over the ${WARDROBE_DESCRIPTION_MAX_BYTES}-byte limit`,
    );
  }
}

/**
 * 校验整份定义：id 唯一、槽位规范、outfit 引用的 part 必须存在。
 * 损坏的 wardrobe.json 按此函数拒绝并降级为空衣橱。
 */
export function validateWardrobeDefinitions(definitions: WardrobeDefinitions): void {
  if (!Array.isArray(definitions.parts) || !Array.isArray(definitions.outfits)) {
    throw new Error("wardrobe definitions require parts[] and outfits[]");
  }
  if (definitions.parts.length > WARDROBE_MAX_PARTS) {
    throw new Error(`too many parts: ${definitions.parts.length} > ${WARDROBE_MAX_PARTS}`);
  }
  if (definitions.outfits.length > WARDROBE_MAX_OUTFITS) {
    throw new Error(`too many outfits: ${definitions.outfits.length} > ${WARDROBE_MAX_OUTFITS}`);
  }
  const partIds = new Set<string>();
  for (const part of definitions.parts) {
    assertId(part.id, "part");
    assertName(part.name, `part ${part.id}`);
    assertDescription(part.description, `part ${part.id}`);
    normalizeWardrobeSlot(part.slot);
    if (partIds.has(part.id)) throw new Error(`duplicate part id: ${part.id}`);
    partIds.add(part.id);
  }
  const outfitIds = new Set<string>();
  for (const outfit of definitions.outfits) {
    assertId(outfit.id, "outfit");
    assertName(outfit.name, `outfit ${outfit.id}`);
    if (outfitIds.has(outfit.id)) throw new Error(`duplicate outfit id: ${outfit.id}`);
    outfitIds.add(outfit.id);
    const slots = Object.keys(outfit.parts ?? {});
    if (slots.length === 0) {
      throw new Error(`outfit ${outfit.id} must reference at least one part`);
    }
    for (const [slot, partId] of Object.entries(outfit.parts)) {
      normalizeWardrobeSlot(slot);
      if (!partIds.has(partId)) {
        throw new Error(`outfit ${outfit.id} references unknown part ${partId}`);
      }
    }
  }
}

/** 校验一次 wear 的槽位→part 选择；返回规范化的映射。 */
export function validateWardrobeSelection(
  definitions: WardrobeDefinitions,
  selection: Record<string, string>,
): Record<string, string> {
  const catalog = new Map(definitions.parts.map((part) => [part.id, part]));
  const resolved: Record<string, string> = {};
  for (const [slot, partId] of Object.entries(selection)) {
    const normalizedSlot = normalizeWardrobeSlot(slot);
    const part = catalog.get(partId);
    if (!part) throw new Error(`unknown part id: ${partId}`);
    if (part.slot !== normalizedSlot) {
      throw new Error(`part ${partId} belongs to slot '${part.slot}', not '${normalizedSlot}'`);
    }
    resolved[normalizedSlot] = partId;
  }
  return resolved;
}

/**
 * 6 小时自动换装的随机选套：从与当前不同的 outfit 里随机挑一套。
 * 没有可换的（不足两套或全都等于当前）返回 undefined。
 */
export function pickRandomWardrobeOutfit(
  definitions: WardrobeDefinitions,
  current: Record<string, string>,
  random: () => number = Math.random,
): WardrobeOutfit | undefined {
  const currentKey = JSON.stringify(
    Object.entries(current).sort(([a], [b]) => a.localeCompare(b)),
  );
  const candidates = definitions.outfits.filter(
    (outfit) =>
      JSON.stringify(Object.entries(outfit.parts).sort(([a], [b]) => a.localeCompare(b))) !==
      currentKey,
  );
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(random() * candidates.length) % candidates.length];
}

/** 注入用的当前着装解析：悬空引用（part 被删）直接跳过该槽位。 */
export function resolveWardrobeSlots(
  definitions: WardrobeDefinitions,
  current: Record<string, string>,
): Array<Pick<WardrobePart, "slot" | "name" | "description">> {
  const catalog = new Map(definitions.parts.map((part) => [part.id, part]));
  const slots: Array<Pick<WardrobePart, "slot" | "name" | "description">> = [];
  for (const [slot, partId] of Object.entries(current)) {
    const part = catalog.get(partId);
    if (!part) continue;
    slots.push({ slot: part.slot, name: part.name, description: part.description });
  }
  slots.sort((left, right) => left.slot.localeCompare(right.slot));
  return slots;
}
