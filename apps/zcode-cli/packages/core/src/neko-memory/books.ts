// ============================================================
// Neko Memory Books - fixed six markdown books, budgets and paths
// ============================================================

import { join } from "node:path";

import type {
  NekoMemoryBook,
  NekoMemoryBookKind,
  NekoMemoryBookScope,
  NekoProjectIdentity,
} from "@zcode/contracts/neko-memory";

/** 全局四本的预算（UTF-8 字节）。 */
export const NEKO_MEMORY_GLOBAL_BOOK_BUDGETS: Record<NekoMemoryBookKind, number> = {
  profile: 3 * 1024,
  plans: 2 * 1024,
  experiences: 2 * 1024,
  playbook: 5 * 1024,
};

/** 项目两本的预算（UTF-8 字节）。 */
export const NEKO_MEMORY_PROJECT_BOOK_BUDGETS: Partial<Record<NekoMemoryBookKind, number>> = {
  playbook: 3 * 1024,
  experiences: 1 * 1024,
};

export const NEKO_MEMORY_BOOK_LABELS: Record<NekoMemoryBookKind, string> = {
  profile: "档案",
  plans: "约定",
  experiences: "经历",
  playbook: "做法",
};

/** 全局册允许的类型白名单；写错册由系统提示与预算闸门共同约束。 */
export const NEKO_MEMORY_GLOBAL_BOOK_KINDS: readonly NekoMemoryBookKind[] = [
  "profile",
  "plans",
  "experiences",
  "playbook",
];

/** 项目册只收做法与项目里程碑经历。 */
export const NEKO_MEMORY_PROJECT_BOOK_KINDS: readonly NekoMemoryBookKind[] = [
  "playbook",
  "experiences",
];

export function nekoMemoryBookKindLabel(kind: NekoMemoryBookKind): string {
  return NEKO_MEMORY_BOOK_LABELS[kind];
}

function buildBook(input: {
  memoryRoot: string;
  scope: NekoMemoryBookScope;
  kind: NekoMemoryBookKind;
  budgetBytes: number;
  path: string;
  relativePath: string;
}): NekoMemoryBook {
  return {
    scope: input.scope,
    kind: input.kind,
    path: input.path,
    relativePath: input.relativePath,
    budgetBytes: input.budgetBytes,
    label: NEKO_MEMORY_BOOK_LABELS[input.kind],
  };
}

export function globalNekoMemoryBook(memoryRoot: string, kind: NekoMemoryBookKind): NekoMemoryBook {
  return buildBook({
    memoryRoot,
    scope: "global",
    kind,
    budgetBytes: NEKO_MEMORY_GLOBAL_BOOK_BUDGETS[kind],
    path: join(memoryRoot, "global", `${kind}.md`),
    relativePath: `global/${kind}.md`,
  });
}

export function projectNekoMemoryBook(
  memoryRoot: string,
  project: Pick<NekoProjectIdentity, "folder">,
  kind: NekoMemoryBookKind,
): NekoMemoryBook {
  const budget = NEKO_MEMORY_PROJECT_BOOK_BUDGETS[kind];
  if (budget === undefined) {
    throw new Error(`kind '${kind}' is not allowed in the project scope`);
  }
  return buildBook({
    memoryRoot,
    scope: "project",
    kind,
    budgetBytes: budget,
    path: join(memoryRoot, "projects", project.folder, `${kind}.md`),
    relativePath: `projects/${project.folder}/${kind}.md`,
  });
}

/** 一个会话可见的书：全局四本 + 项目两本（提供项目身份时）。 */
export function nekoMemoryBooksFor(
  memoryRoot: string,
  project: NekoProjectIdentity | undefined,
): NekoMemoryBook[] {
  const books = NEKO_MEMORY_GLOBAL_BOOK_KINDS.map((kind) => globalNekoMemoryBook(memoryRoot, kind));
  if (project) {
    for (const kind of NEKO_MEMORY_PROJECT_BOOK_KINDS) {
      books.push(projectNekoMemoryBook(memoryRoot, project, kind));
    }
  }
  return books;
}

/**
 * 按记忆根内的相对路径识别一本书（正斜杠）。
 * `global/<kind>.md` 与 `projects/<folder>/<kind>.md`；其余路径不属于记忆。
 */
export function findNekoMemoryBookByPath(
  memoryRoot: string,
  path: string,
): NekoMemoryBook | undefined {
  const normalized = path.split("\\").join("/");
  const root = join(memoryRoot, "global");
  for (const kind of NEKO_MEMORY_GLOBAL_BOOK_KINDS) {
    if (normalized === join(root, `${kind}.md`).split("\\").join("/")) {
      return globalNekoMemoryBook(memoryRoot, kind);
    }
  }
  const projectMatch = normalized.match(
    new RegExp(`^${escapeRegExp(join(memoryRoot, "projects").split("\\").join("/"))}/([^/]+)/(\\w+)\\.md$`),
  );
  if (!projectMatch) return undefined;
  const kind = projectMatch[2] as NekoMemoryBookKind;
  const budget = NEKO_MEMORY_PROJECT_BOOK_BUDGETS[kind];
  if (budget === undefined) return undefined;
  return buildBook({
    memoryRoot,
    scope: "project",
    kind,
    budgetBytes: budget,
    path: normalized,
    relativePath: `projects/${projectMatch[1]}/${kind}.md`,
  });
}

/** 新书的标题行；ensure 时写入，让 Edit 的 old_string 有锚点。 */
export function nekoMemoryBookHeader(book: NekoMemoryBook): string {
  return `# ${book.label}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
