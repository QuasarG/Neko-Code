// ============================================================
// Wardrobe File Store - wardrobe.json definitions + SQLite runtime state
// ============================================================

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";

import type { WardrobeDefinitions, WardrobeState } from "@zcode/contracts/wardrobe";
import { validateWardrobeDefinitions, type WardrobeStorePort } from "@zcode/core/wardrobe";

import {
  resolveNekoWardrobeDefinitionsPath,
  resolveNekoWardrobeStateDbPath,
} from "../neko-memory/paths.js";

const STATE_SCHEMA = `
CREATE TABLE IF NOT EXISTS wardrobe_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current TEXT NOT NULL,
  locked INTEGER NOT NULL,
  version INTEGER NOT NULL,
  last_user_at INTEGER NOT NULL
);
`;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 先做形状检查再交给 core 做规则校验；保证错误消息可读而不是 TypeError。 */
function assertDefinitionsShape(value: unknown): asserts value is WardrobeDefinitions {
  if (!isPlainObject(value) || !Array.isArray(value.parts) || !Array.isArray(value.outfits)) {
    throw new Error("wardrobe.json 需要 parts[] 与 outfits[] 两个字段");
  }
  value.parts.forEach((part, index) => {
    if (
      !isPlainObject(part) ||
      typeof part.id !== "string" ||
      typeof part.slot !== "string" ||
      typeof part.name !== "string" ||
      typeof part.description !== "string"
    ) {
      throw new Error(`parts[${index}] 需要 id/slot/name/description 四个字符串字段`);
    }
  });
  value.outfits.forEach((outfit, index) => {
    if (
      !isPlainObject(outfit) ||
      typeof outfit.id !== "string" ||
      typeof outfit.name !== "string" ||
      !isPlainObject(outfit.parts) ||
      Object.values(outfit.parts).some((partId) => typeof partId !== "string")
    ) {
      throw new Error(`outfits[${index}] 需要 id、name 与 parts（槽位 → part id 字符串）`);
    }
  });
}

/**
 * 衣橱存储：定义在 wardrobe.json（可手改），状态在 runtime SQLite。
 * 加载失败必须返回错误而不是抛出——损坏的配置降级为空衣橱并提示，
 * 不阻塞消息。
 */
export class WardrobeFileStore implements WardrobeStorePort {
  readonly definitionsPath: string;
  readonly stateDbPath: string;
  private readonly db: DatabaseSync;
  private readonly statements = new Map<string, StatementSync>();

  constructor(input: { definitionsPath?: string; stateDbPath?: string } = {}) {
    // 路径默认走统一根解析；允许覆盖以便测试与备份读取。
    this.definitionsPath = input.definitionsPath ?? resolveNekoWardrobeDefinitionsPath();
    this.stateDbPath = input.stateDbPath ?? resolveNekoWardrobeStateDbPath();
    if (this.stateDbPath !== ":memory:") {
      mkdirSync(dirname(this.stateDbPath), { recursive: true, mode: 0o700 });
    }
    this.db = new DatabaseSync(this.stateDbPath);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    this.db.exec(STATE_SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  private stmt(sql: string): StatementSync {
    let statement = this.statements.get(sql);
    if (!statement) {
      statement = this.db.prepare(sql);
      this.statements.set(sql, statement);
    }
    return statement;
  }

  loadDefinitions(): { definitions: WardrobeDefinitions; error?: string } {
    try {
      const raw = readFileSync(this.definitionsPath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      assertDefinitionsShape(parsed);
      validateWardrobeDefinitions(parsed);
      return { definitions: parsed };
    } catch (error) {
      // 任何损坏（缺失、非法 JSON、形状错、规则错）都降级为空衣橱；
      // 消息带上原因，设置页据此提示手改方向。
      return {
        definitions: { parts: [], outfits: [] },
        error: `衣橱定义不可用（${this.definitionsPath}）：${(error as Error).message}`,
      };
    }
  }

  loadState(): WardrobeState {
    const row = this.stmt(
      "SELECT current, locked, version, last_user_at AS lastUserAt FROM wardrobe_state WHERE id = 1",
    ).get() as { current: string; locked: number; version: number; lastUserAt: number } | undefined;
    if (!row) {
      // 首次建库 lastUserAt 取 now：刚装好不能立刻触发 6 小时自动换装。
      const initial: WardrobeState = {
        current: {},
        locked: false,
        version: 1,
        lastUserAt: Date.now(),
      };
      this.saveState(initial);
      return initial;
    }
    let current: Record<string, string> = {};
    try {
      const parsed: unknown = JSON.parse(row.current);
      if (isPlainObject(parsed)) current = parsed as Record<string, string>;
    } catch {
      // current 被手改坏：回退为没穿，其余状态保留。
    }
    return {
      current,
      locked: row.locked === 1,
      version: row.version,
      lastUserAt: row.lastUserAt,
    };
  }

  saveState(state: WardrobeState): void {
    this.stmt(
      `INSERT INTO wardrobe_state (id, current, locked, version, last_user_at) VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET current = excluded.current, locked = excluded.locked,
       version = excluded.version, last_user_at = excluded.last_user_at`,
    ).run(JSON.stringify(state.current), state.locked ? 1 : 0, state.version, state.lastUserAt);
  }

  saveDefinitions(definitions: WardrobeDefinitions): void {
    // tmp + rename 原子替换：手改途中读到的永远是完整文件。
    mkdirSync(dirname(this.definitionsPath), { recursive: true, mode: 0o700 });
    const temp = `${this.definitionsPath}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(temp, `${JSON.stringify(definitions, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temp, this.definitionsPath);
  }
}
