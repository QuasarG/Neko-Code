import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import type { SkillRoot, SkillSource } from "@zcode/contracts";

const GIT_MARKER = ".git";
const HOME_PREFIX = "~/";
const PRIORITY_STEP = 10;
const SKILLS_DIR = "skills";
const NEKODE_DIR = ".nekode";
const AGENTS_DIR = ".agents";

export interface SkillRootResolutionOptions {
  homeDirectory?: string;
  additionalDirectories?: readonly string[];
  extraRoots?: string[];
  extraResolvedRoots?: SkillRoot[];
  includeZcodeSkills?: boolean;
}

export async function resolveDefaultSkillRoots(
  workingDirectory: string,
  options: SkillRootResolutionOptions = {},
): Promise<SkillRoot[]> {
  const resolvedWorkingDirectory = resolve(workingDirectory);
  const roots: SkillRoot[] = [];
  const includeZcode = options.includeZcodeSkills ?? true;
  const home = options.homeDirectory ?? homedir();
  let priority = 0;
  const nextPriority = () => {
    priority += PRIORITY_STEP;
    return priority;
  };

  for (const extraRoot of options.extraRoots ?? []) {
    roots.push(
      root(
        resolveConfiguredRoot(extraRoot, resolvedWorkingDirectory),
        "project",
        "zcode",
        nextPriority(),
      ),
    );
  }

  if (includeZcode) {
    roots.push(...skillRootsForBase(home, "user", nextPriority));
  }

  const projectDirectories = await resolveProjectSkillDirectories(resolvedWorkingDirectory);
  for (const directory of projectDirectories) {
    if (includeZcode) {
      roots.push(...skillRootsForBase(directory, "project", nextPriority));
    }
  }

  for (const directory of new Set(
    (options.additionalDirectories ?? []).map((path) => resolve(path)),
  )) {
    if (directory === resolvedWorkingDirectory) continue;
    roots.push(
      ...skillRootsForBase(directory, "project", nextPriority).map((item) => ({
        ...item,
        namespace: basename(directory),
      })),
    );
  }

  roots.push(...(options.extraResolvedRoots ?? []));

  return roots;
}

async function resolveProjectSkillDirectories(workingDirectory: string): Promise<string[]> {
  const worktreeRoot = await findWorktreeRoot(workingDirectory);
  if (!worktreeRoot) return [workingDirectory];

  const directories: string[] = [];
  let current = workingDirectory;
  while (true) {
    directories.push(current);
    if (current === worktreeRoot || current === dirname(current)) break;
    current = dirname(current);
  }
  return directories;
}

async function findWorktreeRoot(workingDirectory: string): Promise<string | null> {
  let current = workingDirectory;
  while (true) {
    if (await pathExists(join(current, GIT_MARKER))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function skillRootsForBase(
  baseDirectory: string,
  scope: SkillRoot["scope"],
  nextPriority: () => number,
): SkillRoot[] {
  // 用户级只有 ~/.nekode/skills 这一个全局 skill 位置：不再读 ~/.agents/skills，
  // Nekode 的 skill 与其他 harness 的安装位彻底分家（zexin 2026-11-03 拍板）。
  // 项目级保留 .agents/skills 兼容：仓库自带的 skill（如本仓库 architecture-governance）
  // 仍要被认出来；同一级别 .nekode 优先。
  if (scope === "user") {
    return [root(join(baseDirectory, NEKODE_DIR, SKILLS_DIR), scope, "zcode", nextPriority())];
  }
  return [
    root(join(baseDirectory, NEKODE_DIR, SKILLS_DIR), scope, "zcode", nextPriority()),
    root(join(baseDirectory, AGENTS_DIR, SKILLS_DIR), scope, "agents", nextPriority()),
  ];
}

function root(
  path: string,
  scope: SkillRoot["scope"],
  source: SkillSource,
  priority: number,
): SkillRoot {
  return {
    path: resolve(path),
    scope,
    source,
    priority,
  };
}

function resolveConfiguredRoot(path: string, workingDirectory: string): string {
  const expanded = path.startsWith(HOME_PREFIX)
    ? join(homedir(), path.slice(HOME_PREFIX.length))
    : path;
  return isAbsolute(expanded) ? expanded : resolve(workingDirectory, expanded);
}
