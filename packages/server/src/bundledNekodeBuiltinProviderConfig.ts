import { materializeNekodeBuiltinProviderConfig } from "@zcode/services/node";

declare const __NEKODE_BUILTIN_PROVIDER_CONFIG_JSON__: string | undefined;

export interface MaterializeBundledNekodeBuiltinProviderConfigOptions {
  readonly environmentConfigRoot: string;
  readonly content: string;
}

/** 返回构建时嵌入远端 Server 的 Nekode Built-in Provider Config。 */
export function readBundledNekodeBuiltinProviderConfig(): string {
  if (typeof __NEKODE_BUILTIN_PROVIDER_CONFIG_JSON__ !== "string") {
    throw new Error("当前构建未嵌入 Nekode Built-in Provider Config");
  }
  return __NEKODE_BUILTIN_PROVIDER_CONFIG_JSON__;
}

/**
 * 将 Nekode Built-in Config 原子物化到所属环境的固定资源副本。
 * 升级前退出旧进程；不保留按内容 hash 增长的历史文件。
 */
export async function materializeBundledNekodeBuiltinProviderConfig(
  options: MaterializeBundledNekodeBuiltinProviderConfigOptions,
): Promise<string> {
  return materializeNekodeBuiltinProviderConfig(options);
}
