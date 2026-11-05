// ============================================================
// Wardrobe Tool Handler - outfit state management for the persona
// ============================================================
//
// 工具名固定 "wardrobe"（spec 8.3）：一个入口、十个动作，成功失败都走
// contracts 的 WardrobeToolResult 统一结构，模型不用按动作换解析方式。
// 定义（wardrobe.json）可手改，所以每次动作前都重新 load 并校验；
// 状态变更统一 version+1，注入层按指纹判断是否重投 <wardrobe>。

import { z } from "zod";
import type { JsonSchema, ModelMessageContent } from "@zcode/contracts";
import type {
  WardrobeAction,
  WardrobeDefinitions,
  WardrobeOutfit,
  WardrobePart,
  WardrobeState,
  WardrobeToolResult,
} from "@zcode/contracts/wardrobe";
import {
  WARDROBE_DESCRIPTION_MAX_BYTES,
  WARDROBE_ID_MAX,
  WARDROBE_NAME_MAX,
  WARDROBE_SLOT_MAX,
  normalizeWardrobeSlot,
  validateWardrobeDefinitions,
  validateWardrobeSelection,
} from "../../wardrobe/index.js";
import type {
  ToolEntry,
  ToolExecutionContext,
  ToolHandler,
  ToolRuntimePermissionCapability,
} from "../types.js";

export const WARDROBE_TOOL_NAME = "wardrobe";

// ------------------------------------------------------------
// Input schema：zod 判别联合，形状校验在这里，语义校验（slot 规范、
// 上限、引用完整性）交给 wardrobe/model.ts——那里的错误消息带修复指引。
// ------------------------------------------------------------

const partIdSchema = z.string().min(1).max(WARDROBE_ID_MAX);
// description 的字节上限由 model 层按 UTF-8 精确校验；zod 只挡明显离谱的字符数。
const descriptionSchema = z.string().max(WARDROBE_DESCRIPTION_MAX_BYTES);

const partInputSchema = z.object({
  id: partIdSchema,
  slot: z.string().min(1).max(WARDROBE_SLOT_MAX + 16),
  name: z.string().min(1).max(WARDROBE_NAME_MAX),
  description: descriptionSchema.optional(),
});

// update_part 不允许改 slot：部件的槽位是固有归属，改槽位会让引用它的
// outfit 槽位映射悬空。要换槽位必须先 remove_part 再 add_part。
const partUpdateSchema = z.object({
  name: z.string().min(1).max(WARDROBE_NAME_MAX).optional(),
  description: descriptionSchema.optional(),
});

const outfitInputSchema = z.object({
  id: partIdSchema,
  name: z.string().min(1).max(WARDROBE_NAME_MAX),
  parts: z.record(z.string(), z.string()),
});

// zod v3 的 discriminatedUnion 类型不兼容 contracts toToolJsonSchema 的 ZodTypeAny
// 入参（运行时其实支持）；普通 union 校验等价、类型链干净，provider 侧 JSON Schema
// 呈现为 anyOf，executor 的运行时校验仍由这份 zod schema 把关。
export const WardrobeInputSchema = z.union([
  z.object({ action: z.literal("list") }),
  z.object({ action: z.literal("add_part"), part: partInputSchema }),
  z.object({ action: z.literal("update_part"), id: partIdSchema, part: partUpdateSchema }),
  z.object({ action: z.literal("remove_part"), id: partIdSchema }),
  z.object({ action: z.literal("save_outfit"), outfit: outfitInputSchema }),
  z.object({ action: z.literal("delete_outfit"), id: partIdSchema }),
  z.object({
    action: z.literal("wear"),
    outfit_id: partIdSchema.optional(),
    parts: z.record(z.string(), z.string()).optional(),
  }),
  z.object({ action: z.literal("clear") }),
  z.object({ action: z.literal("lock") }),
  z.object({ action: z.literal("unlock") }),
]);

export type WardrobeInput = z.infer<typeof WardrobeInputSchema>;

// provider 侧 JSON Schema 手写而非走 contracts 的 toToolJsonSchema：core 与
// contracts 各解析到一份 zod（workspace 根 vs contracts 嵌套），跨实例的类型
// 与运行时都不可靠。形状与上方 zod union 一一对应，改动作时两处同步。
const partJsonProperties: Record<string, unknown> = {
  id: { type: "string", minLength: 1, maxLength: WARDROBE_ID_MAX },
  slot: { type: "string", minLength: 1, maxLength: WARDROBE_SLOT_MAX + 16 },
  name: { type: "string", minLength: 1, maxLength: WARDROBE_NAME_MAX },
  description: { type: "string", maxLength: WARDROBE_DESCRIPTION_MAX_BYTES },
};
const partIdJsonProperty = { type: "string", minLength: 1, maxLength: WARDROBE_ID_MAX };
const slotMapJsonProperty = {
  type: "object",
  additionalProperties: { type: "string", minLength: 1, maxLength: WARDROBE_ID_MAX },
};

// provider 侧 JSON Schema 禁用 anyOf（tool-contracts 的 provider 兼容检查），
// 所以这里压成单个扁平对象：action 枚举 + 各动作自己的可选字段；
// 每个动作的字段约束由 runtimeInputSchema 的 zod union 严格把关。
export const WardrobeInputJsonSchema: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: [
        "list",
        "add_part",
        "update_part",
        "remove_part",
        "save_outfit",
        "delete_outfit",
        "wear",
        "clear",
        "lock",
        "unlock",
      ],
    },
    id: partIdJsonProperty,
    part: {
      type: "object",
      properties: partJsonProperties,
      required: ["id", "slot", "name"],
      additionalProperties: false,
    },
    outfit: {
      type: "object",
      properties: {
        id: partJsonProperties.id,
        name: partJsonProperties.name,
        parts: slotMapJsonProperty,
      },
      required: ["id", "name", "parts"],
      additionalProperties: false,
    },
    outfit_id: partIdJsonProperty,
    parts: slotMapJsonProperty,
  },
  required: ["action"],
  additionalProperties: false,
};

/** list 附带清单数据；结构仍是 WardrobeToolResult 的扩展，失败面完全一致。 */
export type WardrobeOutput = WardrobeToolResult & {
  parts?: WardrobePart[];
  outfits?: WardrobeOutfit[];
};

// runtime 输出校验：所有动作同一个形状，失败面只多一个 error 对象。
const WardrobeOutputSchema = z.object({
  ok: z.boolean(),
  action: z.string(),
  changed: z.boolean(),
  current: z.record(z.string(), z.string()),
  locked: z.boolean(),
  warnings: z.array(z.string()),
  error: z
    .object({ code: z.string(), message: z.string(), hint: z.string().optional() })
    .optional(),
  parts: z
    .object({
      id: z.string(),
      slot: z.string(),
      name: z.string(),
      description: z.string(),
    })
    .array()
    .optional(),
  outfits: z
    .object({
      id: z.string(),
      name: z.string(),
      parts: z.record(z.string(), z.string()),
    })
    .array()
    .optional(),
});

// ------------------------------------------------------------
// 统一返回：成功带当前状态，失败带 {code, message, hint}。
// ------------------------------------------------------------

function success(
  action: WardrobeAction,
  state: WardrobeState,
  extra: { changed: boolean; warnings?: string[]; parts?: WardrobePart[]; outfits?: WardrobeOutfit[] },
): WardrobeOutput {
  return {
    ok: true,
    action,
    changed: extra.changed,
    current: state.current,
    locked: state.locked,
    warnings: extra.warnings ?? [],
    ...(extra.parts === undefined ? {} : { parts: extra.parts }),
    ...(extra.outfits === undefined ? {} : { outfits: extra.outfits }),
  };
}

function failure(
  action: WardrobeAction,
  code: string,
  message: string,
  hint?: string,
  state?: WardrobeState,
): WardrobeOutput {
  return {
    ok: false,
    action,
    changed: false,
    // store 缺席或定义损坏时拿不到可靠状态，只能交空；其余失败如实带回当前着装。
    current: state?.current ?? {},
    locked: state?.locked ?? false,
    warnings: [],
    error: { code, message, ...(hint === undefined ? {} : { hint }) },
  };
}

// ------------------------------------------------------------
// Handler
// ------------------------------------------------------------

// 入参类型保持仓库惯例（宽 unknown + 内部 parse 收窄），否则 handler 的泛型
// 逆变会让 ToolHandler<具体输入> 无法挂进 ToolEntry.handler。
export const wardrobeHandler: ToolHandler = async (input, context) => {
  const parsed = WardrobeInputSchema.parse(input) as WardrobeInput;
  const store = context.wardrobeStore;
  if (!store) {
    return failure(
      parsed.action,
      "store_missing",
      "Wardrobe store is not configured for this session.",
    );
  }
  // 定义文件可被手改：每次动作前重读。损坏时降级为空衣橱并给明确错误，
  // 不阻塞其他消息（spec 8.2）——修复指引直接指向 definitionsPath。
  const { definitions, error } = store.loadDefinitions();
  if (error !== undefined) {
    return failure(
      parsed.action,
      "broken_definitions",
      `Wardrobe definitions failed to load: ${error}`,
      `Fix or restore ${store.definitionsPath} (valid JSON with parts[] and outfits[]); the wardrobe stays empty until then.`,
    );
  }
  const state = store.loadState();

  switch (parsed.action) {
    case "list":
      return listWardrobe(definitions, state);
    case "add_part":
      return addPart(parsed, definitions, state, store);
    case "update_part":
      return updatePart(parsed, definitions, state, store);
    case "remove_part":
      return removePart(parsed, definitions, state, store);
    case "save_outfit":
      return saveOutfit(parsed, definitions, state, store);
    case "delete_outfit":
      return deleteOutfit(parsed, definitions, state, store);
    case "wear":
      return wearOutfit(parsed, definitions, state, store);
    case "clear":
      return clearOutfit(parsed.action, state, store);
    case "lock":
      return setLocked(parsed.action, state, store, true);
    case "unlock":
      return setLocked(parsed.action, state, store, false);
  }
};

type WardrobeStoreCarrier = NonNullable<ToolExecutionContext["wardrobeStore"]>;

function listWardrobe(definitions: WardrobeDefinitions, state: WardrobeState): WardrobeOutput {
  // 按 slot 分组再按 id 排序：清单稳定可读，模型不用自己归组。
  const parts = [...definitions.parts].sort(
    (left, right) =>
      left.slot.localeCompare(right.slot) || left.id.localeCompare(right.id),
  );
  const outfits = [...definitions.outfits].sort((left, right) => left.id.localeCompare(right.id));
  return success("list", state, { changed: false, parts, outfits });
}

function addPart(
  input: Extract<WardrobeInput, { action: "add_part" }>,
  definitions: WardrobeDefinitions,
  state: WardrobeState,
  store: WardrobeStoreCarrier,
): WardrobeOutput {
  if (definitions.parts.some((part) => part.id === input.part.id)) {
    return failure(
      input.action,
      "duplicate_part",
      `Part id '${input.part.id}' already exists.`,
      `Use update_part to change it, or pick a new id. Existing ids: ${listPartIds(definitions)}.`,
      state,
    );
  }
  // slot 规范化在 model 层做（非法直接拒绝、不截断）；把它的报错转成可读 hint。
  let slot: string;
  try {
    slot = normalizeWardrobeSlot(input.part.slot);
  } catch (error) {
    return failure(
      input.action,
      "invalid_slot",
      error instanceof Error ? error.message : `invalid wardrobe slot: ${input.part.slot}`,
      `Slot must be 1-${WARDROBE_SLOT_MAX} chars of lowercase letters, digits, and hyphens (e.g. "feet", "head").`,
      state,
    );
  }
  const nextParts: WardrobePart[] = [
    ...definitions.parts,
    {
      id: input.part.id,
      slot,
      name: input.part.name,
      description: input.part.description ?? "",
    },
  ];
  return saveDefinitionsOrReject(
    input.action,
    { ...definitions, parts: nextParts },
    state,
    store,
  );
}

function updatePart(
  input: Extract<WardrobeInput, { action: "update_part" }>,
  definitions: WardrobeDefinitions,
  state: WardrobeState,
  store: WardrobeStoreCarrier,
): WardrobeOutput {
  const existing = definitions.parts.find((part) => part.id === input.id);
  if (!existing) {
    return unknownPartFailure(input.action, input.id, definitions, state);
  }
  const next: WardrobePart = {
    ...existing,
    ...(input.part.name === undefined ? {} : { name: input.part.name }),
    ...(input.part.description === undefined ? {} : { description: input.part.description }),
  };
  const nextParts = definitions.parts.map((part) => (part.id === input.id ? next : part));
  return saveDefinitionsOrReject(
    input.action,
    { ...definitions, parts: nextParts },
    state,
    store,
  );
}

function removePart(
  input: Extract<WardrobeInput, { action: "remove_part" }>,
  definitions: WardrobeDefinitions,
  state: WardrobeState,
  store: WardrobeStoreCarrier,
): WardrobeOutput {
  const existing = definitions.parts.find((part) => part.id === input.id);
  if (!existing) {
    return unknownPartFailure(input.action, input.id, definitions, state);
  }
  // 被 current 或任何 outfit 引用时拒绝并列出全部引用：静默删除会让
  // outfit 槽位映射悬空、wear 在运行时才炸，排错远比现在拒绝痛苦。
  const referencingOutfits = definitions.outfits.filter((outfit) =>
    Object.values(outfit.parts).includes(input.id),
  );
  const inCurrent = Object.values(state.current).includes(input.id);
  if (referencingOutfits.length > 0 || inCurrent) {
    const outfitList = referencingOutfits
      .map((outfit) => `${outfit.id} (${outfit.name})`)
      .join(", ");
    return failure(
      input.action,
      "part_in_use",
      `Part '${input.id}' is still referenced${
        outfitList ? ` by outfits: ${outfitList}` : ""
      }${inCurrent ? `${outfitList ? " and" : ""} by the current outfit` : ""}.`,
      "Remove the references first: adjust or delete those outfits, or wear/clear something else.",
      state,
    );
  }
  const nextParts = definitions.parts.filter((part) => part.id !== input.id);
  return saveDefinitionsOrReject(
    input.action,
    { ...definitions, parts: nextParts },
    state,
    store,
  );
}

function saveOutfit(
  input: Extract<WardrobeInput, { action: "save_outfit" }>,
  definitions: WardrobeDefinitions,
  state: WardrobeState,
  store: WardrobeStoreCarrier,
): WardrobeOutput {
  // 先校验选择：part 存在且槽位匹配。validateWardrobeSelection 的报错自带
  // "part X belongs to slot 'a', not 'b'"——正是排错需要的那句话。
  let resolved: Record<string, string>;
  try {
    resolved = validateWardrobeSelection(definitions, input.outfit.parts);
  } catch (error) {
    return selectionFailure(input.action, error, definitions, state);
  }
  const normalized: WardrobeOutfit = {
    id: input.outfit.id,
    name: input.outfit.name,
    parts: resolved,
  };
  // save 语义是 upsert：同 id 覆盖，方便微调套装；内容没变时不写盘。
  const others = definitions.outfits.filter((outfit) => outfit.id !== input.outfit.id);
  const unchanged = definitions.outfits.some(
    (outfit) => outfit.id === input.outfit.id && sameSelection(outfit.parts, resolved),
  );
  if (unchanged) {
    return success(input.action, state, { changed: false });
  }
  return saveDefinitionsOrReject(
    input.action,
    { ...definitions, outfits: [...others, normalized] },
    state,
    store,
  );
}

function deleteOutfit(
  input: Extract<WardrobeInput, { action: "delete_outfit" }>,
  definitions: WardrobeDefinitions,
  state: WardrobeState,
  store: WardrobeStoreCarrier,
): WardrobeOutput {
  const existing = definitions.outfits.find((outfit) => outfit.id === input.id);
  if (!existing) {
    return failure(
      input.action,
      "unknown_outfit",
      `Outfit id '${input.id}' does not exist.`,
      `Existing outfits: ${
        definitions.outfits.length > 0
          ? definitions.outfits.map((outfit) => `${outfit.id} (${outfit.name})`).join(", ")
          : "(none saved yet)"
      }.`,
      state,
    );
  }
  return saveDefinitionsOrReject(
    input.action,
    { ...definitions, outfits: definitions.outfits.filter((outfit) => outfit.id !== input.id) },
    state,
    store,
  );
}

function wearOutfit(
  input: Extract<WardrobeInput, { action: "wear" }>,
  definitions: WardrobeDefinitions,
  state: WardrobeState,
  store: WardrobeStoreCarrier,
): WardrobeOutput {
  if (state.locked) {
    return failure(
      input.action,
      "locked",
      "The current outfit is locked; wear and clear are refused while locked.",
      "Locked outfits can only be changed after zexin unlocks; ask zexin to unlock first.",
      state,
    );
  }
  // outfit_id 与 parts 二选一：都给或都不给都是歧义输入，拒绝比猜更好。
  if (Boolean(input.outfit_id) === Boolean(input.parts)) {
    return failure(
      input.action,
      "invalid_input",
      "Provide either outfit_id or a parts mapping ({slot: part_id}), exactly one of them.",
      undefined,
      state,
    );
  }
  let selection: Record<string, string>;
  if (input.outfit_id !== undefined) {
    const outfit = definitions.outfits.find((candidate) => candidate.id === input.outfit_id);
    if (!outfit) {
      return failure(
        input.action,
        "unknown_outfit",
        `Outfit id '${input.outfit_id}' does not exist.`,
        `Existing outfits: ${
          definitions.outfits.length > 0
            ? definitions.outfits.map((candidate) => `${candidate.id} (${candidate.name})`).join(", ")
            : "(none saved yet)"
        }.`,
        state,
      );
    }
    selection = outfit.parts;
  } else {
    selection = input.parts!;
  }
  let resolved: Record<string, string>;
  try {
    resolved = validateWardrobeSelection(definitions, selection);
  } catch (error) {
    return selectionFailure(input.action, error, definitions, state);
  }
  if (sameSelection(state.current, resolved)) {
    return success(input.action, state, { changed: false });
  }
  const nextState: WardrobeState = {
    ...state,
    current: resolved,
    version: state.version + 1,
  };
  store.saveState(nextState);
  return success(input.action, nextState, { changed: true });
}

function clearOutfit(
  action: WardrobeAction,
  state: WardrobeState,
  store: WardrobeStoreCarrier,
): WardrobeOutput {
  if (state.locked) {
    return failure(
      action,
      "locked",
      "The current outfit is locked; wear and clear are refused while locked.",
      "Locked outfits can only be changed after zexin unlocks; ask zexin to unlock first.",
      state,
    );
  }
  if (Object.keys(state.current).length === 0) {
    return success(action, state, { changed: false });
  }
  const nextState: WardrobeState = { ...state, current: {}, version: state.version + 1 };
  store.saveState(nextState);
  return success(action, nextState, { changed: true });
}

function setLocked(
  action: "lock" | "unlock",
  state: WardrobeState,
  store: WardrobeStoreCarrier,
  locked: boolean,
): WardrobeOutput {
  if (state.locked === locked) {
    return success(action, state, { changed: false });
  }
  // locked 进注入指纹（wardrobeInjectionFingerprint），version+1 让下一轮
  // <wardrobe> 重投，其他会话只看到状态、不会得到换装事件。
  const nextState: WardrobeState = { ...state, locked, version: state.version + 1 };
  store.saveState(nextState);
  return success(action, nextState, { changed: true });
}

// ------------------------------------------------------------
// 共享小件
// ------------------------------------------------------------

/**
 * 定义变更的唯一落盘路径：先整体 validateWardrobeDefinitions 再 save。
 * 校验失败转 invalid_definitions（带原始消息——model 层的报错本身可读），
 * 保证落盘的 wardrobe.json 永远是校验过的形状，加载器不必容忍半坏状态。
 */
function saveDefinitionsOrReject(
  action: WardrobeAction,
  next: WardrobeDefinitions,
  state: WardrobeState,
  store: WardrobeStoreCarrier,
): WardrobeOutput {
  try {
    validateWardrobeDefinitions(next);
  } catch (error) {
    return failure(
      action,
      "invalid_definitions",
      error instanceof Error ? error.message : String(error),
      "Adjust the change so the whole wardrobe stays valid (limits, unique ids, outfit references).",
      state,
    );
  }
  store.saveDefinitions(next);
  return success(action, state, { changed: true });
}

/** wear/save_outfit 共用的选择校验失败转换：unknown part 或 slot 不匹配。 */
function selectionFailure(
  action: WardrobeAction,
  error: unknown,
  definitions: WardrobeDefinitions,
  state: WardrobeState,
): WardrobeOutput {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("unknown part id")) {
    return failure(
      action,
      "unknown_part",
      message,
      `Existing parts: ${listPartIds(definitions)}.`,
      state,
    );
  }
  if (message.includes("belongs to slot")) {
    return failure(action, "slot_mismatch", message, "Map the part under its own slot.", state);
  }
  return failure(action, "invalid_input", message, undefined, state);
}

function unknownPartFailure(
  action: WardrobeAction,
  id: string,
  definitions: WardrobeDefinitions,
  state: WardrobeState,
): WardrobeOutput {
  return failure(
    action,
    "unknown_part",
    `Part id '${id}' does not exist.`,
    `Existing parts: ${listPartIds(definitions)}.`,
    state,
  );
}

function listPartIds(definitions: WardrobeDefinitions): string {
  return definitions.parts.length > 0
    ? definitions.parts.map((part) => `${part.id} [${part.slot}]`).join(", ")
    : "(none defined yet)";
}

function sameSelection(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
}

// ------------------------------------------------------------
// Provider-visible rendering
// ------------------------------------------------------------

export function formatWardrobeModelContent(output: unknown): ModelMessageContent {
  if (typeof output !== "object" || output === null) return "Wardrobe action completed.";
  const result = output as WardrobeOutput;
  const headline = result.ok
    ? `wardrobe ${result.action}: ${result.changed ? "changed" : "no change"} (locked=${result.locked})`
    : `wardrobe ${result.action} failed: [${result.error?.code ?? "error"}] ${result.error?.message ?? ""}` +
      (result.error?.hint ? `\nHint: ${result.error.hint}` : "");
  const lines = [headline];
  if (result.ok && result.parts !== undefined) {
    if (result.parts.length === 0) {
      lines.push("Parts: (none defined)");
    } else {
      lines.push("Parts:");
      for (const part of result.parts) {
        lines.push(`- ${part.slot} / ${part.id}: ${part.name} — ${part.description}`);
      }
    }
  }
  if (result.ok && result.outfits !== undefined) {
    if (result.outfits.length === 0) {
      lines.push("Outfits: (none saved)");
    } else {
      lines.push("Outfits:");
      for (const outfit of result.outfits) {
        const mapping = Object.entries(outfit.parts)
          .map(([slot, partId]) => `${slot}=${partId}`)
          .join(", ");
        lines.push(`- ${outfit.id} (${outfit.name}): ${mapping}`);
      }
    }
  }
  if (Object.keys(result.current).length > 0) {
    lines.push(
      `Current: ${Object.entries(result.current)
        .map(([slot, partId]) => `${slot}=${partId}`)
        .join(", ")}`,
    );
  } else {
    lines.push("Current: (nothing worn)");
  }
  return lines.join("\n");
}

// ------------------------------------------------------------
// 动态权限：readOnly / needsApproval 按 action 收敛。
// 静态声明保守（needsApproval true），这里按动作降级；
// lock/unlock 返回 undefined 落回静态声明——只有 zexin 能解锁（spec 8.3）。
// ------------------------------------------------------------

export function resolveWardrobePermissionCapability(
  input: unknown,
): ToolRuntimePermissionCapability | undefined {
  const action =
    typeof input === "object" && input !== null && typeof (input as { action?: unknown }).action === "string"
      ? ((input as { action: string }).action as WardrobeAction)
      : undefined;
  if (action === undefined) return undefined;
  if (action === "lock" || action === "unlock") return undefined;
  if (action === "list") {
    return {
      readOnly: true,
      destructive: false,
      needsApproval: false,
      riskLevel: "low",
      sideEffectScope: "none",
      permission: { needsApproval: false, riskLevel: "low", sideEffectScope: "none" },
    };
  }
  return {
    readOnly: false,
    destructive: false,
    needsApproval: false,
    riskLevel: "low",
    sideEffectScope: "system",
    permission: { needsApproval: false, riskLevel: "low", sideEffectScope: "system" },
  };
}

// ------------------------------------------------------------
// Tool entry
// ------------------------------------------------------------

const WARDROBE_PROVIDER_DESCRIPTION = [
  "Manage and wear the persona wardrobe (clothing and accessory state).",
  "",
  "Actions:",
  "- list: parts grouped by slot, saved outfits, current outfit, locked state.",
  "- add_part / update_part / remove_part: manage parts. A part belongs to exactly one slot; update_part cannot move it to another slot (remove and re-add instead). remove_part refuses while the part is referenced by an outfit or currently worn.",
  "- save_outfit / delete_outfit: manage named outfits (save is upsert by id).",
  "- wear: dress by `outfit_id`, or by a `parts` mapping of {slot: part_id}.",
  "- clear: take everything off.",
  "- lock / unlock: freeze or release the current outfit. Only call these when zexin explicitly asks for it; locking blocks wear, clear, and auto-change until unlocked.",
  "",
  "Every action returns the same shape: {ok, action, changed, current, locked, warnings, error:{code, message, hint}}.",
  "The wardrobe is silent state: do not mention clothing unless the user asks or you changed it this turn.",
].join("\n");

const WARDROBE_RESULT_BUDGET_BYTES = 100_000;

export const wardrobeToolEntry: ToolEntry = {
  capability: "Read and change the persona wardrobe via the wardrobe store port",
  metadata: {
    name: WARDROBE_TOOL_NAME,
    description: WARDROBE_PROVIDER_DESCRIPTION,
    // shouldDefer 标记低频工具可入 ToolSearch 延迟体系；alwaysLoad 再把它豁免——
    // 衣橱是即时性的（zexin 说"换上"时工具必须在场，不该先搜一步），
    // 两个声明合起来的语义是「常驻，不因 toolsearch 折叠」。
    shouldDefer: true,
    alwaysLoad: true,
    searchHint: "outfit wear dress clothing accessories lock wardrobe",
    // 静态保守基线 needsApproval true（lock/unlock 用）；list/其余动作由
    // resolveWardrobePermissionCapability 按输入动态降级为免审。
    readOnly: false,
    destructive: false,
    concurrentSafe: false,
    sideEffectScope: "system",
    riskLevel: "medium",
    needsApproval: true,
  },
  handler: wardrobeHandler,
  formatModelContent: formatWardrobeModelContent,
  inputSchema: WardrobeInputJsonSchema,
  runtimeInputSchema: WardrobeInputSchema,
  outputSchema: {},
  runtimeOutputSchema: WardrobeOutputSchema,
  resolvePermissionCapability: resolveWardrobePermissionCapability,
  permission: {
    permission: "wardrobe",
    reason:
      "Wardrobe changes persona outfit state; lock/unlock freeze or release the current outfit",
    riskLevel: "medium",
    sideEffectScope: "system",
    needsApproval: true,
    patternSources: ["input"],
    alwaysAllowPatternSources: ["input"],
    denyPriority: "beforeAsk",
  },
  resultBudget: {
    maxInlineBytes: WARDROBE_RESULT_BUDGET_BYTES,
    maxModelBytes: WARDROBE_RESULT_BUDGET_BYTES,
    strategy: "truncate",
    preview: { maxBytes: WARDROBE_RESULT_BUDGET_BYTES, direction: "head" },
  },
  // 本地 store 的同步读写，没有外部 IO 等待面，不需要超时预算。
  timeout: { kind: "none" },
  cancellation: {
    supported: true,
    cleanup: "none",
    userVisibleMessage: "Wardrobe action was cancelled before the store was updated",
  },
  trace: {
    required: true,
    propagateToAdapters: false,
    recordInput: "summary",
    recordOutput: "summary",
  },
};
