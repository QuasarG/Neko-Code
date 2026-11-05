import type { GlobalOptions, RunContext } from "@zcode/shared-types";
import type { RunDependencies } from "./cli-types.js";

/**
 * 账号登录已从本构建移除。
 *
 * 这里保留两个命令入口的空实现，是因为 TUI 的 `/login`、`/logout` 提示路径仍按原
 * 函数签名分发（该文件不在本次改动范围内）。实现不读取 dotenv、不加载 bootstrap
 * 登录模块、不发起 OAuth，只把「不可用」如实报告给调用方。
 */
const ACCOUNT_LOGIN_UNAVAILABLE_MESSAGE =
  "Account login is not available in this build. Configure a provider API key instead.";

export async function runLoginCommand(
  ctx: RunContext,
  _options: GlobalOptions,
  _deps: RunDependencies,
  _noBrowser: boolean,
  _args: readonly string[] = [],
): Promise<number> {
  ctx.stderr.write(`Error: ${ACCOUNT_LOGIN_UNAVAILABLE_MESSAGE}\n`);
  return 1;
}

export async function runLogoutCommand(
  ctx: RunContext,
  _options: GlobalOptions,
  _deps: RunDependencies,
): Promise<number> {
  ctx.stderr.write("Error: There is no account session to log out of.\n");
  return 1;
}
