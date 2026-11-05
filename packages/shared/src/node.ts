/**
 * Node-only shared utilities.
 *
 * This subpath must not be imported by renderer/browser bundles.
 */
import { homedir, userInfo } from "node:os";
import { join, resolve, sep } from "node:path";

/** Server 展示系统用户；容器的数字 UID 无需在 passwd 中有名称条目。 */
export function resolveServerOsUser(): string {
  try {
    return userInfo().username;
  } catch (error) {
    // Docker 的数字 UID 可能没有 passwd 条目，userInfo 会抛错并阻断 Core ready。
    // 此字段只用于展示；用有效 UID 保持 userInfo 的用户语义，其他系统错误仍由调用方处理。
    if (
      error instanceof Error &&
      "info" in error &&
      typeof error.info === "object" &&
      error.info !== null &&
      "code" in error.info &&
      error.info.code === "ENOENT" &&
      "syscall" in error.info &&
      error.info.syscall === "uv_os_get_passwd" &&
      typeof process.geteuid === "function"
    ) {
      return `uid:${process.geteuid()}`;
    }
    throw error;
  }
}

/** `HOME` / `USERPROFILE` / 系统 homedir；不读 Nekode 自己的数据根变量。 */
export function resolveNekodeUserHome(env: NodeJS.ProcessEnv = process.env): string {
  const home = env.HOME?.trim() || env.USERPROFILE?.trim();
  return home && home.length > 0 ? home : homedir();
}

function expandNekodePath(value: string, env: NodeJS.ProcessEnv): string {
  if (value === "~") return resolveNekodeUserHome(env);
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return join(resolveNekodeUserHome(env), value.slice(2));
  }
  return value;
}

function normalizeNekodePathForCompare(value: string, env: NodeJS.ProcessEnv): string {
  const normalized = resolve(expandNekodePath(value, env));
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

/**
 * 官方 ZCode 的数据根。Nekode 任何根解析都不能落到这里：
 * 命中时由调用方回退到 `~/.nekode`，不迁移、不双读。
 */
export function isOfficialZcodeDataPath(
  candidate: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const officialRoot = normalizeNekodePathForCompare(
    join(resolveNekodeUserHome(env), ".zcode"),
    env,
  );
  const normalized = normalizeNekodePathForCompare(candidate, env);
  return normalized === officialRoot || normalized.startsWith(`${officialRoot}${sep}`);
}

/** 单个候选根的最后一道守卫；命中官方根时回到 `~/.nekode`。 */
export function guardNekodeRoot(candidate: string, env: NodeJS.ProcessEnv = process.env): string {
  const resolved = resolve(expandNekodePath(candidate, env));
  return isOfficialZcodeDataPath(resolved, env)
    ? join(resolveNekodeUserHome(env), ".nekode")
    : resolved;
}

/**
 * CLI / persona / Neko Memory 的统一根：
 * `NEKODE_HOME` > `NEKODE_STORAGE_DIR` > `NEKODE_ROOT` > fallback。
 * 任一显式根指向 `~/.zcode` 时跳过；fallback 也不安全时回到 `~/.nekode`。
 */
export function resolveNekodeRoot(input: { env?: NodeJS.ProcessEnv; fallbackDir: string }): string {
  const env = input.env ?? process.env;
  for (const candidate of [
    env.NEKODE_HOME?.trim(),
    env.NEKODE_STORAGE_DIR?.trim(),
    env.NEKODE_ROOT?.trim(),
  ]) {
    if (candidate && !isOfficialZcodeDataPath(candidate, env)) {
      return resolve(expandNekodePath(candidate, env));
    }
  }

  return guardNekodeRoot(input.fallbackDir, env);
}

/** CLI 侧默认根；保留 `NEKODE_STORAGE_DIR` 的 beta/自定义语义。 */
export function resolveNekodeCliRoot(env: NodeJS.ProcessEnv = process.env): string {
  return resolveNekodeRoot({
    env,
    fallbackDir: join(resolveNekodeUserHome(env), ".nekode"),
  });
}

/** App 侧 `dataBaseDir` 派生根；只守卫官方根，不接管 CLI 的根变量。 */
export function resolveNekodeDataBaseRoot(
  dataBaseDir: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const fallback = join(resolve(expandNekodePath(dataBaseDir, env)), ".nekode");
  return isOfficialZcodeDataPath(fallback, env)
    ? join(resolveNekodeUserHome(env), ".nekode")
    : fallback;
}

export { acquireFileLock } from "./node/atomicFileLock.js";
export { createNodeNetworkCapture, withoutNetworkCapture } from "./node/networkCapture.js";
export {
  GEN_UI_OUTPUT_ROOT_ENV,
  GEN_UI_OUTPUT_DIRECTORY,
  getGenUiOutputDirectory,
} from "./node/genUiPaths.js";
export { scanOfficialPluginCacheRoots } from "./node/officialPluginCache.js";
export {
  migrateUserSubagentMarkdown,
  migrateSubagentStateFile,
} from "./node/subagentMarkdownMigration.js";
export {
  atomicWritePrivateTextFile,
  backupCorruptFile,
  withFileLock,
  type SharedFileLockOptions,
} from "./node/privateFilePersistence.js";
export {
  createNodeSelfResourceSampler,
  NODE_SELF_RESOURCE_SAMPLE_INTERVAL_MS,
  type NodeSelfResourceSampler,
  type NodeSelfResourceSamplerOptions,
} from "./node/nodeSelfResourceTelemetry.js";
