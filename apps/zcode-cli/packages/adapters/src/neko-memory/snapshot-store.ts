// ============================================================
// Neko Memory Snapshot Store - per-session delivery snapshots (SQLite)
// ============================================================

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";

import type { NekoMemorySnapshotPort } from "@zcode/core/neko-memory";

import { resolveNekoMemoryRuntimeDbPath } from "./paths.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS book_snapshots (
  session TEXT NOT NULL,
  path TEXT NOT NULL,
  hash TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (session, path)
);
CREATE TABLE IF NOT EXISTS session_ints (
  session TEXT NOT NULL,
  key TEXT NOT NULL,
  value INTEGER NOT NULL,
  PRIMARY KEY (session, key)
);
`;

/**
 * 每会话每本书只留最新一份投递快照，外加会话级整数（轮次计数、
 * checkpoint 区间）。快照不是记忆元数据，只是「这个会话上次看到的
 * 正文」，会话删除时一并清掉；与 CLI 会话库分开存放。
 */
export class NekoMemorySnapshotStore implements NekoMemorySnapshotPort {
  readonly dbPath: string;
  private readonly db: DatabaseSync;
  private readonly statements = new Map<string, StatementSync>();

  constructor(dbPath: string = resolveNekoMemoryRuntimeDbPath()) {
    this.dbPath = dbPath;
    if (dbPath !== ":memory:") {
      mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
    }
    this.db = new DatabaseSync(dbPath);
    // WAL + busy_timeout：多进程各持一份 CLI 时读快照不互相阻塞。
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    this.db.exec(SCHEMA);
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

  getBookSnapshot(session: string, path: string): { hash: string; body: string } | undefined {
    const row = this.stmt(
      "SELECT hash, body FROM book_snapshots WHERE session = ? AND path = ?",
    ).get(session, path) as { hash: string; body: string } | undefined;
    return row ?? undefined;
  }

  setBookSnapshot(session: string, path: string, hash: string, body: string): void {
    this.stmt(
      `INSERT INTO book_snapshots (session, path, hash, body, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(session, path) DO UPDATE SET hash = excluded.hash,
       body = excluded.body, updated_at = excluded.updated_at`,
    ).run(session, path, hash, body, Date.now());
  }

  clearSessionBookSnapshots(session: string): void {
    this.stmt("DELETE FROM book_snapshots WHERE session = ?").run(session);
  }

  getSessionInt(session: string, key: string): number {
    const row = this.stmt("SELECT value FROM session_ints WHERE session = ? AND key = ?").get(
      session,
      key,
    ) as { value: number } | undefined;
    return row?.value ?? 0;
  }

  setSessionInt(session: string, key: string, value: number): void {
    this.stmt(
      `INSERT INTO session_ints (session, key, value) VALUES (?, ?, ?)
       ON CONFLICT(session, key) DO UPDATE SET value = excluded.value`,
    ).run(session, key, value);
  }
}
