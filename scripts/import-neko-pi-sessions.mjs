#!/usr/bin/env node
/* eslint-disable max-lines -- 单个脚本集中维护 pi JSONL → Nekode session/message/part/tasks 的映射与校验，拆分会让字段对应关系分散。 */
/**
 * One-way importer: neko-pi JSONL session history -> Neko-Code SQLite stores.
 *
 * Source:      <source>/**\/*.jsonl (default ~/.neko_pi/sessions), read-only.
 * Destinations:
 *   <dest-home>/cli/db/db.sqlite      (session/message/part)
 *   <dest-home>/v2/tasks-index.sqlite (tasks)
 *
 * The destination databases must already exist. Launch Neko-Code once so the
 * app creates and migrates them, then run this importer with the app closed.
 *
 * Usage:
 *   node scripts/import-neko-pi-sessions.mjs --dry-run
 *   node scripts/import-neko-pi-sessions.mjs
 *   node scripts/import-neko-pi-sessions.mjs --source <dir> --dest-home <dir>
 *
 * This script never reads or writes ~/.nekode. It refuses to run when the
 * source or destination resolves inside the official ~/.nekode tree.
 */

import { copyFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";

const originalEmitWarning = process.emitWarning;
process.emitWarning = function filterSqliteExperimentalWarning(warning, ...args) {
  if (String(warning).includes("SQLite is an experimental feature")) return;
  return originalEmitWarning.call(process, warning, ...args);
};
const { DatabaseSync } = await import("node:sqlite");
process.emitWarning = originalEmitWarning;

const NEKODE_PROVIDER = "glm";
const AGENT_NAME = "zcode-agent";
const IMPORT_SOURCE = "neko-pi";
const SUBAGENT_META_TYPE = "pi-web:subagent";
const DEFAULT_SOURCE = join(homedir(), ".neko_pi", "sessions");
const DEFAULT_DEST_HOME = join(homedir(), ".nekode");

// Same derivation as apps/zcode-cli/packages/core/src/runtime/helpers/project.ts.
function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "session";
}

function projectIdFromDirectory(directory) {
  return `proj_${slugify(directory).slice(0, 80) || "default"}`;
}

// Same shape as apps/zcode-cli/packages/core/src/runtime/helpers/project.ts.
function titleFromInput(input) {
  const compact = input.trim().replace(/\s+/g, " ");
  if (!compact) return "Untitled session";
  return compact.length <= 60 ? compact : `${compact.slice(0, 57)}...`;
}

function parseArgs(argv) {
  const args = {
    source: DEFAULT_SOURCE,
    destHome: DEFAULT_DEST_HOME,
    dryRun: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (item === "--help" || item === "-h") {
      args.help = true;
      continue;
    }
    const next = argv[index + 1];
    if (!next) throw new Error(`Missing value for ${item}`);
    index += 1;
    if (item === "--source") args.source = next;
    else if (item === "--dest-home") args.destHome = next;
    else throw new Error(`Unknown option: ${item}`);
  }
  return args;
}

function printUsage() {
  console.log(`Usage: node scripts/import-neko-pi-sessions.mjs [options]

Options:
  --dry-run              Print the import plan without writing.
  --source <dir>         neko-pi sessions root. Default: ${DEFAULT_SOURCE}
  --dest-home <dir>      Neko-Code data home. Default: ${DEFAULT_DEST_HOME}
  -h, --help             Show this help.

Destination files:
  <dest-home>/cli/db/db.sqlite
  <dest-home>/v2/tasks-index.sqlite

Both files must exist already; run Neko-Code once before importing.`);
}

function assertOutsideZcode(target, label) {
  const absolute = resolve(target);
  const zcodeRoot = resolve(join(homedir(), ".nekode"));
  if (absolute === zcodeRoot || absolute.startsWith(`${zcodeRoot}${sep}`)) {
    throw new Error(`${label} must not point inside ~/.nekode: ${absolute}`);
  }
}

function collectJsonlFiles(root) {
  if (!existsSync(root)) throw new Error(`Source directory not found: ${root}`);
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(path);
    }
  };
  walk(root);
  return files.sort();
}

function readJsonlFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const lines = text.split("\n");
  const entries = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    try {
      entries.push(JSON.parse(line));
    } catch (error) {
      throw new Error(
        `Invalid JSON at ${filePath}:${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return entries;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function timestampOf(value) {
  if (finiteNumber(value) !== undefined) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function entryTimestamp(entry, fallback) {
  return timestampOf(entry?.timestamp) ?? fallback;
}

function contentBlocks(content) {
  if (typeof content === "string") return [{ type: "text", text: content }];
  return Array.isArray(content) ? content.filter(isRecord) : [];
}

function visibleText(content) {
  return contentBlocks(content)
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("");
}

function toolResultOutput(content) {
  return contentBlocks(content)
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
}

function parseToolInput(value) {
  if (isRecord(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (isRecord(parsed)) return parsed;
    } catch {
      // Fall through to the wrapped form below.
    }
    return { rawArguments: value };
  }
  return {};
}

function toolResultImages(content) {
  const blocks = contentBlocks(content);
  const images = [];
  const layout = [];
  for (const block of blocks) {
    if (block.type === "text" && typeof block.text === "string") {
      layout.push({ type: "text", text: block.text });
      continue;
    }
    if (block.type === "image" && typeof block.data === "string") {
      const mime = optionalString(block.mimeType) ?? "image/png";
      const index = images.length;
      images.push({
        type: "file",
        mime,
        url: `data:${mime};base64,${block.data}`,
        metadata: {
          storageKind: "inline",
          recoverability: "provider_ready",
        },
      });
      layout.push({ type: "attachment", attachmentIndex: index });
    }
  }
  return { images, layout };
}

function detectSessionKind(entries) {
  const header = entries.find((entry) => entry?.type === "session");
  if (!header || typeof header.id !== "string" || header.id.length === 0) {
    return { kind: "invalid", reason: "missing session header" };
  }
  if (!optionalString(header.cwd)) {
    return { kind: "invalid", reason: "session header has no cwd" };
  }
  if (
    entries.some((entry) => entry?.type === "custom" && entry.customType === SUBAGENT_META_TYPE)
  ) {
    return { kind: "subagent", sessionId: header.id };
  }
  return { kind: "session", header };
}

/**
 * Convert one neko-pi session file into the Nekode row plan.
 * Non-message entries are classified, not silently dropped: session_info
 * supplies the title, compaction becomes a compact-summary message,
 * custom_message becomes a synthetic user message, and `custom` extension
 * state is skipped.
 */
function buildSessionPlan(filePath, entries) {
  const detected = detectSessionKind(entries);
  if (detected.kind !== "session") return detected;
  const header = detected.header;
  const sessionId = header.id;
  const cwd = optionalString(header.cwd);

  const createdAt = timestampOf(header.timestamp) ?? 0;
  let updatedAt = createdAt;
  for (const entry of entries) {
    const timestamp = entryTimestamp(entry, undefined);
    if (timestamp !== undefined && timestamp > updatedAt) updatedAt = timestamp;
  }

  const resultsByCallId = new Map();
  for (const entry of entries) {
    if (entry?.type !== "message") continue;
    const message = entry.message;
    if (!isRecord(message) || message.role !== "toolResult") continue;
    const callId = optionalString(message.toolCallId);
    if (callId && !resultsByCallId.has(callId)) {
      resultsByCallId.set(callId, { message, timestamp: entryTimestamp(entry, updatedAt) });
    }
  }

  const records = [];
  let titleName;
  let firstUserText;
  let sessionModel;
  let fallbackTimestamp = createdAt;

  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    const timestamp = entryTimestamp(entry, fallbackTimestamp);
    fallbackTimestamp = timestamp;
    if (timestamp > updatedAt) updatedAt = timestamp;

    if (entry.type === "session_info") {
      const name = optionalString(entry.name);
      if (name) titleName = name;
      continue;
    }

    if (entry.type === "model_change") {
      const modelId = optionalString(entry.modelId);
      if (modelId) sessionModel = { provider: optionalString(entry.provider), modelId };
      continue;
    }

    if (entry.type === "custom_message") {
      const text = typeof entry.content === "string" ? entry.content : visibleText(entry.content);
      if (!text) continue;
      const customType = optionalString(entry.customType) ?? "custom-message";
      const display = entry.display !== false;
      records.push({
        role: "user",
        timestamp,
        synthetic: true,
        customType,
        display,
        content: text,
        parts: [{ type: "text", text, time: { start: timestamp, end: timestamp } }],
      });
      continue;
    }

    if (entry.type === "compaction") {
      const summary = typeof entry.summary === "string" ? entry.summary : "";
      if (!summary) continue;
      records.push({
        role: "user",
        timestamp,
        synthetic: true,
        summary: {
          title: "Compact summary",
          body: summary,
          diffs: [],
        },
        compactSummary: true,
        content: summary,
        parts: [
          {
            type: "text",
            text: summary,
            synthetic: true,
            time: { start: timestamp, end: timestamp },
          },
        ],
      });
      continue;
    }

    if (entry.type !== "message" || !isRecord(entry.message)) continue;
    const message = entry.message;
    const messageTimestamp = timestampOf(message.timestamp) ?? timestamp;
    if (messageTimestamp > updatedAt) updatedAt = messageTimestamp;
    const durationMs = finiteNumber(message.durationMs);

    if (message.role === "user") {
      const text = visibleText(message.content);
      const parts = [];
      for (const block of contentBlocks(message.content)) {
        if (block.type === "text" && typeof block.text === "string") {
          parts.push({
            type: "text",
            text: block.text,
            time: { start: messageTimestamp, end: messageTimestamp },
          });
        } else if (block.type === "image" && typeof block.data === "string") {
          const mime = optionalString(block.mimeType) ?? "image/png";
          parts.push({
            type: "file",
            mime,
            url: `data:${mime};base64,${block.data}`,
            metadata: { storageKind: "inline", recoverability: "provider_ready" },
          });
        }
      }
      if (parts.length === 0) continue;
      if (!firstUserText && text.trim()) firstUserText = text;
      records.push({
        role: "user",
        timestamp: messageTimestamp,
        content: text,
        model: optionalString(message.model),
        parts,
      });
      continue;
    }

    if (message.role === "assistant") {
      const completedAt = messageTimestamp + (durationMs ?? 0);
      const blocks = contentBlocks(message.content);
      const parts = [];
      let declarationIndex = 0;
      for (const block of blocks) {
        if (block.type === "thinking" && typeof block.thinking === "string") {
          parts.push({
            type: "reasoning",
            text: block.thinking,
            time: { start: messageTimestamp, end: completedAt },
          });
          continue;
        }
        if (block.type === "text" && typeof block.text === "string") {
          parts.push({
            type: "text",
            text: block.text,
            time: { start: messageTimestamp, end: completedAt },
          });
          continue;
        }
        if (block.type === "toolCall") {
          const callId =
            optionalString(block.id) ?? `call_unidentified_${records.length}_${declarationIndex}`;
          const toolName = optionalString(block.name) ?? "unknown_tool";
          const input = parseToolInput(block.arguments);
          const matched = resultsByCallId.get(callId);
          const resultMessage = matched?.message;
          const resultAt = matched?.timestamp ?? completedAt;
          const startedAt = Math.min(messageTimestamp, resultAt);
          const endedAt = Math.max(startedAt, resultAt);
          const metadata = { importSource: IMPORT_SOURCE };
          const state = resultMessage
            ? (() => {
                const output = toolResultOutput(resultMessage.content);
                const { images, layout } = toolResultImages(resultMessage.content);
                if (resultMessage.isError === true) {
                  return {
                    status: "error",
                    input,
                    error: output || "Tool returned an error without text output.",
                    metadata: {
                      ...metadata,
                      ...(isRecord(resultMessage.details)
                        ? { piDetails: resultMessage.details }
                        : {}),
                    },
                    time: { start: startedAt, end: endedAt },
                  };
                }
                return {
                  status: "completed",
                  input,
                  output,
                  title: toolName,
                  metadata: {
                    ...metadata,
                    ...(layout.length > 0 ? { modelContentLayout: layout } : {}),
                    ...(isRecord(resultMessage.details)
                      ? { piDetails: resultMessage.details }
                      : {}),
                  },
                  time: { start: startedAt, end: endedAt },
                  ...(images.length > 0 ? { attachments: images } : {}),
                };
              })()
            : {
                status: "error",
                input,
                error: "No tool result recorded in the neko-pi session.",
                metadata,
                time: { start: startedAt, end: endedAt },
              };
          parts.push({
            type: "tool",
            callID: callId,
            declarationIndex,
            tool: toolName,
            state,
          });
          declarationIndex += 1;
        }
      }
      const usage = isRecord(message.usage) ? message.usage : {};
      const cost = isRecord(usage.cost) ? (finiteNumber(usage.cost.total) ?? 0) : 0;
      const errorMessage = optionalString(message.errorMessage);
      // Failed provider turns often have no content blocks. Keep the error
      // visible in history instead of writing an empty message row.
      if (parts.length === 0 && errorMessage) {
        parts.push({
          type: "text",
          text: `[Error] ${errorMessage}`,
          synthetic: true,
          time: { start: messageTimestamp, end: completedAt },
        });
      }
      records.push({
        role: "assistant",
        timestamp: messageTimestamp,
        completedAt,
        content: visibleText(message.content),
        model: optionalString(message.model),
        provider: optionalString(message.provider),
        responseId: optionalString(message.responseId),
        stopReason: optionalString(message.stopReason),
        errorMessage,
        usage: {
          input: finiteNumber(usage.input) ?? 0,
          output: finiteNumber(usage.output) ?? 0,
          reasoning: finiteNumber(usage.reasoning) ?? 0,
          cacheRead: finiteNumber(usage.cacheRead) ?? 0,
          cacheWrite: finiteNumber(usage.cacheWrite) ?? 0,
        },
        cost,
        parts,
      });
      continue;
    }

    // toolResult entries are folded into the owning tool part above.
    // system entries are prompt snapshots, not conversation turns.
  }

  const title = titleName ?? (firstUserText ? titleFromInput(firstUserText) : "Untitled session");
  const titleSource = titleName ? "custom" : "first_input";
  const messageCount = records.length;
  const partCount = records.reduce((total, record) => total + record.parts.length, 0);

  return {
    kind: "plan",
    filePath,
    sessionId,
    cwd,
    version: header.version === undefined ? "neko-pi" : String(header.version),
    title,
    titleSource,
    createdAt: createdAt || (records[0]?.timestamp ?? 0),
    updatedAt: updatedAt || (records.at(-1)?.timestamp ?? 0),
    model:
      sessionModel?.modelId ?? records.findLast((record) => record.role === "assistant")?.model,
    records,
    messageCount,
    partCount,
    searchableText: records.map((record) => record.content ?? "").join("\n"),
  };
}

function sessionExists(db, sessionId) {
  return db.prepare("select 1 from session where id = ?").get(sessionId) !== undefined;
}

function taskExists(db, workspaceKey, taskId) {
  return (
    db
      .prepare("select 1 from tasks where workspace_key = ? and task_id = ?")
      .get(workspaceKey, taskId) !== undefined
  );
}

function writeSession(db, plan) {
  const traceId = `neko-pi-${plan.sessionId}`;
  db.prepare(
    `
      insert into session (
        id, project_id, workspace_id, parent_id, trace_id, task_type, slug, directory, path,
        title, title_source, title_message_id, version, time_created, time_updated,
        time_title_updated
      ) values (?, ?, null, null, ?, 'interactive', ?, ?, ?, ?, ?, null, ?, ?, ?, ?)
    `,
  ).run(
    plan.sessionId,
    projectIdFromDirectory(plan.cwd),
    traceId,
    slugify(plan.sessionId),
    plan.cwd,
    plan.cwd,
    plan.title,
    plan.titleSource,
    plan.version,
    plan.createdAt,
    plan.updatedAt,
    plan.updatedAt,
  );

  const insertMessage = db.prepare(
    "insert into message (id, session_id, time_created, time_updated, data, sequence) values (?, ?, ?, ?, ?, ?)",
  );
  const insertPart = db.prepare(
    "insert into part (id, message_id, session_id, time_created, time_updated, data, sequence) values (?, ?, ?, ?, ?, ?, ?)",
  );

  let latestUserMessageId = "";
  const rootMessageId = `msg_nekopi_${plan.sessionId}_root`;

  for (const [messageIndex, record] of plan.records.entries()) {
    const messageId = `msg_nekopi_${plan.sessionId}_${String(messageIndex).padStart(4, "0")}`;
    const created = record.timestamp;
    const completed = record.completedAt ?? created;
    const data =
      record.role === "user"
        ? {
            role: "user",
            time: { created },
            agent: AGENT_NAME,
            content: record.content,
            // Frozen old Readers open user messages through model; the current
            // Reader ignores it. Keep the minimal object, as the official
            // restore plugin does.
            model: {},
            ...(record.model
              ? { modelSelection: { providerId: NEKODE_PROVIDER, modelId: record.model } }
              : {}),
            ...(record.synthetic
              ? {
                  synthetic: true,
                  ...(record.display === false ? { visibility: "model-only" } : {}),
                  semantics: {
                    origin: "agent_runtime",
                    kind:
                      record.customType === "background-task"
                        ? "background_notification"
                        : record.compactSummary
                          ? "compact_summary"
                          : "system_reminder",
                    uiVisibility:
                      record.display === false || record.compactSummary ? "hidden" : "visible",
                    providerVisibility: "visible",
                    transcriptVisibility:
                      record.display === false || record.compactSummary ? "hidden" : "visible",
                  },
                }
              : {}),
            ...(record.summary ? { summary: record.summary } : {}),
            metadata: {
              importSource: IMPORT_SOURCE,
              ...(record.customType ? { piCustomType: record.customType } : {}),
            },
          }
        : {
            role: "assistant",
            time: { created, completed },
            parentID: latestUserMessageId || rootMessageId,
            agent: AGENT_NAME,
            modelId: record.model ?? "unknown",
            providerId: NEKODE_PROVIDER,
            mode: "build",
            path: { cwd: plan.cwd, root: plan.cwd },
            content: record.content,
            cost: record.cost,
            tokens: {
              input: record.usage.input,
              output: record.usage.output,
              reasoning: record.usage.reasoning,
              cache: { read: record.usage.cacheRead, write: record.usage.cacheWrite },
            },
            finish: record.stopReason === "toolUse" ? "tool-calls" : (record.stopReason ?? "stop"),
            ...(record.errorMessage
              ? {
                  error: { name: "neko-pi-provider-error", data: { message: record.errorMessage } },
                }
              : {}),
            metadata: {
              importSource: IMPORT_SOURCE,
              ...(record.provider ? { piProvider: record.provider } : {}),
              ...(record.model ? { piModel: record.model } : {}),
              ...(record.responseId ? { piResponseId: record.responseId } : {}),
              ...(record.stopReason ? { piStopReason: record.stopReason } : {}),
            },
          };

    insertMessage.run(
      messageId,
      plan.sessionId,
      created,
      completed,
      JSON.stringify(data),
      messageIndex,
    );

    for (const [partIndex, part] of record.parts.entries()) {
      const partId = `part_nekopi_${plan.sessionId}_${String(messageIndex).padStart(4, "0")}_${String(
        partIndex,
      ).padStart(4, "0")}`;
      const partData = {
        ...part,
        ...(part.type === "tool" && part.state.status === "completed" && part.state.attachments
          ? {
              state: {
                ...part.state,
                attachments: part.state.attachments.map((attachment, attachmentIndex) => ({
                  ...attachment,
                  id: `${partId}_attachment_${attachmentIndex}`,
                  messageID: messageId,
                  sessionID: plan.sessionId,
                })),
              },
            }
          : {}),
      };
      const partCreated = part.time?.start ?? part.state?.time?.start ?? created;
      const partUpdated = part.time?.end ?? part.state?.time?.end ?? completed;
      insertPart.run(
        partId,
        messageId,
        plan.sessionId,
        partCreated,
        partUpdated,
        JSON.stringify(partData),
        partIndex,
      );
    }

    if (record.role === "user") latestUserMessageId = messageId;
  }

  return { messageCount: plan.messageCount, partCount: plan.partCount, traceId };
}

function writeTaskIndex(db, plan) {
  const traceId = `neko-pi-${plan.sessionId}`;
  const meta = {
    taskId: plan.sessionId,
    traceId,
    title: plan.title,
    workspacePath: plan.cwd,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    mode: "build",
    provider: NEKODE_PROVIDER,
    ...(plan.model ? { model: plan.model } : {}),
    importedFrom: IMPORT_SOURCE,
    messageCount: plan.messageCount,
  };

  // Mirrors the official restore plugin: preserve product-shell state on
  // conflict, never overwrite an overridden title or unread marker. host_id,
  // cli_* and project ownership are filled by Neko-Code startup reconciliation.
  db.prepare(
    `
      insert into tasks (
        workspace_key, workspace_path, workspace_identity, task_id, title,
        task_status, provider, mode, model, migration_source, forked_from_task_id,
        created_at, updated_at, unread_at, meta_json, searchable_text
      ) values (
        @workspace_key, @workspace_path, null, @task_id, @title,
        null, @provider, @mode, @model, null, null,
        @created_at, @updated_at, null, @meta_json, @searchable_text
      )
      on conflict(workspace_key, task_id) do update set
        workspace_path = excluded.workspace_path,
        title = case when tasks.title_overridden = 1 then tasks.title else excluded.title end,
        provider = excluded.provider,
        mode = excluded.mode,
        model = excluded.model,
        migration_source = null,
        created_at = min(tasks.created_at, excluded.created_at),
        updated_at = max(tasks.updated_at, excluded.updated_at),
        unread_at = tasks.unread_at,
        searchable_text = case
          when tasks.updated_at > excluded.updated_at then tasks.searchable_text
          else excluded.searchable_text
        end,
        meta_json = excluded.meta_json
    `,
  ).run({
    workspace_key: plan.cwd,
    workspace_path: plan.cwd,
    task_id: plan.sessionId,
    title: plan.title,
    provider: NEKODE_PROVIDER,
    mode: "build",
    model: plan.model ?? null,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
    meta_json: JSON.stringify(meta),
    searchable_text: plan.searchableText,
  });
}

function databaseReady(path, requiredTables, label) {
  if (!existsSync(path)) return { ok: false, reason: `${label} not found: ${path}` };
  let db;
  try {
    db = new DatabaseSync(path, { readOnly: true });
    for (const table of requiredTables) {
      const row = db
        .prepare("select 1 from sqlite_master where type = 'table' and name = ?")
        .get(table);
      if (!row) return { ok: false, reason: `${label} is missing table ${table}: ${path}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: `${label} cannot be opened: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    db?.close();
  }
}

function backupDatabase(path) {
  // Neko-Code keeps both stores in WAL mode. Flush the WAL before copying so
  // the backup contains every committed row, including rows from the last run.
  try {
    const db = new DatabaseSync(path);
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    db.close();
  } catch {
    // A locked database is still copied below; the app should be closed.
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${path}.bak-${stamp}`;
  copyFileSync(path, backupPath);
  return backupPath;
}

function formatCount(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const source = resolve(args.source);
  const destHome = resolve(args.destHome);
  assertOutsideZcode(source, "Source");
  assertOutsideZcode(destHome, "Destination home");
  const cliDbPath = join(destHome, "cli", "db", "db.sqlite");
  const taskIndexPath = join(destHome, "v2", "tasks-index.sqlite");

  const files = collectJsonlFiles(source);
  console.log(`Source:      ${source} (${formatCount(files.length, "jsonl file")})`);
  console.log(`CLI DB:      ${cliDbPath}`);
  console.log(`Task index:  ${taskIndexPath}`);
  console.log(`Dry run:     ${args.dryRun}`);
  console.log();

  const cliDbState = databaseReady(cliDbPath, ["session", "message", "part"], "CLI DB");
  const taskDbState = databaseReady(taskIndexPath, ["tasks"], "Task index");
  if (!args.dryRun) {
    if (!cliDbState.ok) throw new Error(cliDbState.reason);
    if (!taskDbState.ok) throw new Error(taskDbState.reason);
  }

  const cliDb = cliDbState.ok ? new DatabaseSync(cliDbPath, { readOnly: args.dryRun }) : undefined;
  const taskDb = taskDbState.ok
    ? new DatabaseSync(taskIndexPath, { readOnly: args.dryRun })
    : undefined;
  const seenSessionIds = new Set();
  const plans = [];
  const skipped = [];
  const errors = [];

  try {
    for (const filePath of files) {
      let entries;
      try {
        entries = readJsonlFile(filePath);
      } catch (error) {
        errors.push({ filePath, reason: error instanceof Error ? error.message : String(error) });
        continue;
      }
      const detected = detectSessionKind(entries);
      if (detected.kind === "invalid") {
        skipped.push({ filePath, status: "invalid", reason: detected.reason });
        continue;
      }
      if (detected.kind === "subagent") {
        skipped.push({
          filePath,
          status: "subagent",
          reason: `custom entry ${SUBAGENT_META_TYPE}`,
        });
        continue;
      }
      if (seenSessionIds.has(detected.header.id)) {
        skipped.push({
          filePath,
          status: "duplicate",
          reason: `session id ${detected.header.id} already seen in this run`,
        });
        continue;
      }
      seenSessionIds.add(detected.header.id);

      let plan;
      try {
        plan = buildSessionPlan(filePath, entries);
      } catch (error) {
        errors.push({ filePath, reason: error instanceof Error ? error.message : String(error) });
        continue;
      }
      if (plan.kind !== "plan") {
        skipped.push({ filePath, status: plan.kind, reason: plan.reason });
        continue;
      }
      if (cliDb && sessionExists(cliDb, plan.sessionId)) {
        const indexed = taskDb ? taskExists(taskDb, plan.cwd, plan.sessionId) : true;
        skipped.push({
          filePath,
          status: "existing-session",
          reason: indexed
            ? "session already imported"
            : "session exists; task index row missing (will heal)",
          plan,
          healTaskIndex: !indexed && !args.dryRun,
        });
        continue;
      }
      plans.push(plan);
    }

    // Dry run never writes; with missing destination DBs every source session
    // is reported as new.
    for (const plan of plans) {
      console.log(
        `  [new] ${plan.title} | ${plan.cwd} | ${formatCount(plan.messageCount, "message")}, ${formatCount(plan.partCount, "part")} | ${plan.sessionId}`,
      );
    }
    for (const item of skipped) {
      const suffix = item.plan ? ` | ${item.plan.sessionId}` : "";
      console.log(`  [skip:${item.status}] ${item.filePath}${suffix} - ${item.reason}`);
    }
    for (const item of errors) {
      console.log(`  [error] ${item.filePath} - ${item.reason}`);
    }

    console.log();
    console.log(
      `Plan: ${formatCount(plans.length, "new session")}, ${formatCount(skipped.length, "skipped file")}, ${formatCount(errors.length, "error")}`,
    );

    if (args.dryRun) {
      if (!cliDbState.ok) console.log(`CLI DB unavailable: ${cliDbState.reason}`);
      if (!taskDbState.ok) console.log(`Task index unavailable: ${taskDbState.reason}`);
      console.log("Dry run: no writes performed.");
      if (errors.length > 0) process.exitCode = 1;
      return;
    }

    if (plans.length === 0 && !skipped.some((item) => item.healTaskIndex)) {
      console.log("Nothing to import.");
      return;
    }

    const cliBackup = backupDatabase(cliDbPath);
    const taskBackup = backupDatabase(taskIndexPath);
    console.log(`Backed up CLI DB:     ${cliBackup}`);
    console.log(`Backed up task index: ${taskBackup}`);

    let cliInTransaction = false;
    let taskInTransaction = false;
    let importedMessages = 0;
    let importedParts = 0;

    try {
      cliDb.exec("PRAGMA foreign_keys = ON");
      taskDb.exec("BEGIN IMMEDIATE");
      taskInTransaction = true;
      cliDb.exec("BEGIN IMMEDIATE");
      cliInTransaction = true;

      for (const plan of plans) {
        const result = writeSession(cliDb, plan);
        writeTaskIndex(taskDb, plan);
        importedMessages += result.messageCount;
        importedParts += result.partCount;
        console.log(`  [imported] ${plan.title} | ${plan.sessionId}`);
      }
      for (const item of skipped) {
        if (item.healTaskIndex && item.plan) {
          writeTaskIndex(taskDb, item.plan);
          console.log(`  [index-healed] ${item.plan.title} | ${item.plan.sessionId}`);
        }
      }

      cliDb.exec("COMMIT");
      cliInTransaction = false;
      taskDb.exec("COMMIT");
      taskInTransaction = false;

      console.log();
      console.log(
        `Imported ${formatCount(plans.length, "session")}, ${formatCount(importedMessages, "message")}, ${formatCount(importedParts, "part")}.`,
      );
    } catch (error) {
      if (cliInTransaction) {
        try {
          cliDb.exec("ROLLBACK");
        } catch {
          // Keep the first error.
        }
      }
      if (taskInTransaction) {
        try {
          taskDb.exec("ROLLBACK");
        } catch {
          // Keep the first error.
        }
      }
      throw error;
    }

    if (errors.length > 0) process.exitCode = 1;
  } finally {
    cliDb?.close();
    taskDb?.close();
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
