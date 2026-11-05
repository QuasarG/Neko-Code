import type { NekodeRuntimeEnv } from "./runtimeEnv.js";

export type NekodeEnv = "test" | "production";
/** 安装包身份：决定应用名、app id、Electron 数据目录与更新策略；与后端环境 `NekodeEnv` 是两个轴。 */
export type NekodeProductFlavor = "production" | "preview";
export type ArmsRumEnv = "local" | "prod";

// 非构建环境（如 e2e 测试的 mocha）下 define 不存在，用 typeof 检查 + fallback 避免 ReferenceError
declare const __NEKODE_ENV__: string;
declare const __NEKODE_PRODUCT_FLAVOR__: string;
declare const __NEKODE_ARMS_RUM_ENDPOINT__: string;
declare const __NEKODE_TELEMETRY_REPORT_ENDPOINT__: string;
declare const __NEKODE_AUTO_UPDATE_ENABLED__: boolean;

export function normalizeNekodeEnv(value: string | undefined): NekodeEnv {
  return value?.trim().toLowerCase() === "production" ? "production" : "test";
}

export const NEKODE_ENV = normalizeNekodeEnv(
  typeof __NEKODE_ENV__ !== "undefined" ? __NEKODE_ENV__ : undefined,
);

/**
 * 身份缺省跟随后端环境（test → preview，production → production）。
 * 桌面构建通过 `NEKODE_PREVIEW_IDENTITY=1` 显式注入 preview，得到连接生产后端的 Preview 包；
 * 未注入 define 的 bundle（web、CLI、测试）沿用旧的单轴语义。
 */
export function normalizeNekodeProductFlavor(
  value: string | undefined,
  zcodeEnv: NekodeEnv,
): NekodeProductFlavor {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "production" || normalized === "preview") {
    return normalized;
  }
  return zcodeEnv === "production" ? "production" : "preview";
}

export const NEKODE_PRODUCT_FLAVOR = normalizeNekodeProductFlavor(
  typeof __NEKODE_PRODUCT_FLAVOR__ !== "undefined" ? __NEKODE_PRODUCT_FLAVOR__ : undefined,
  NEKODE_ENV,
);
export const NEKODE_APP_VERSION_ENV = "NEKODE_APP_VERSION" as const;
export const NEKODE_BUILD_COMMIT_ID_ENV = "NEKODE_BUILD_COMMIT_ID" as const;

// ── 运行时环境变量（不经过编译打包，启动时从 process.env 读取） ──
// 启用调试模式，值为 inspect-brk 的端口号，如 NEKODE_DEBUG=9230
export const RUNTIME_NEKODE_DEBUG =
  typeof process !== "undefined" ? process.env.NEKODE_DEBUG : undefined;

// ── 构建期可选能力（见 docs/desktop/build-time-optional-capabilities.md），未注入时一律关闭 ──
/** ARMS RUM 上报地址；为空时 SDK 以 enable=false 初始化，不产生上报。 */
export const NEKODE_ARMS_RUM_ENDPOINT: string =
  typeof __NEKODE_ARMS_RUM_ENDPOINT__ !== "undefined" ? __NEKODE_ARMS_RUM_ENDPOINT__ : "";
/** 事件上报（数仓）地址；为空时不上报。 */
export const NEKODE_TELEMETRY_REPORT_ENDPOINT: string =
  typeof __NEKODE_TELEMETRY_REPORT_ENDPOINT__ !== "undefined"
    ? __NEKODE_TELEMETRY_REPORT_ENDPOINT__
    : "";
/** 桌面自动更新是否启用。 */
export const NEKODE_AUTO_UPDATE_ENABLED: boolean =
  typeof __NEKODE_AUTO_UPDATE_ENABLED__ !== "undefined" ? __NEKODE_AUTO_UPDATE_ENABLED__ : false;

/** 将本地运行态与编译期 NEKODE_ENV 映射为 ARMS 控制台识别的上报环境标签 */
export function mapNekodeEnvToArmsRumEnv(runtimeEnv: NekodeRuntimeEnv): ArmsRumEnv {
  return runtimeEnv !== "development" && NEKODE_ENV === "production" ? "prod" : "local";
}
