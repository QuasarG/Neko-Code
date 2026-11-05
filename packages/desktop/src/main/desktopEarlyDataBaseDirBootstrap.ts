import { sanitizeNekodeRuntimeEnvInPlace } from "@zcode/shared";
import { applyEarlyDataBaseDirBootstrap } from "./desktopDataBaseDirBootstrap.js";

// Nekode fork: never inherit the parent Nekode host's pointers into ~/.nekode.
// 这几项只在桌面入口剥掉；不能放进共享的子进程清洗器，否则 host→agent 的正常传参
// （数据根、provider 配置路径）会被清掉一半，agent 启动即失败。
for (const key of [
  "NEKODE_DATA_BASE_DIR",
  "NEKODE_STORAGE_DIR",
  "NEKODE_ROOT",
  "NEKODE_GEN_UI_OUTPUT_ROOT",
  "NEKODE_PERSONAL_PROVIDER_CONFIG_FILE",
  // 官方宿主可能把会话库与内置 provider 配置路径直接传进来；不剥离会把 Nekode
  // 读到官方 ~/.nekode/cli/db 和官方安装目录的 provider 清单。
  "NEKODE_SESSION_DB_PATH",
  "NEKODE_SESSION_DB",
  "NEKODE_BUILTIN_PROVIDER_CONFIG_FILE",
]) {
  delete process.env[key];
}
// 官方 ZCode 宿主会导出整套 ZCODE_* 指针；Nekode 现在只认 NEKODE_*，一律剥掉。
for (const key of Object.keys(process.env)) {
  if (key.startsWith("ZCODE_")) delete process.env[key];
}
sanitizeNekodeRuntimeEnvInPlace(process.env);
applyEarlyDataBaseDirBootstrap();
