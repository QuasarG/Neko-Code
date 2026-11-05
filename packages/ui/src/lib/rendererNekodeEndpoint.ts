import {
  buildRuntimeNekodeEndpointUrls,
  NEKODE_ENV,
  type RuntimeNekodeEndpointEnv,
} from "@zcode/shared";

interface RendererImportMetaEnv {
  VITE_NEKODE_BASE_URL?: string;
  VITE_NEKODE_ENDPOINT_ORIGIN?: string;
}

function readRendererImportMetaEnv(): RendererImportMetaEnv {
  return ((import.meta as ImportMeta & { env?: RendererImportMetaEnv }).env ??
    {}) as RendererImportMetaEnv;
}

export function createRendererNekodeEndpointEnv(
  env: RendererImportMetaEnv = readRendererImportMetaEnv(),
): RuntimeNekodeEndpointEnv {
  return {
    NEKODE_ENV,
    // UI 侧的 zcode-plan 占位 provider 以前只看 NEKODE_ENV，
    // 没有消费 Vite 注入的 base url，导致自定义测试域名时 renderer 和 host/service 可能不一致。
    NEKODE_BASE_URL: env.VITE_NEKODE_BASE_URL,
    NEKODE_ENDPOINT_ORIGIN: env.VITE_NEKODE_ENDPOINT_ORIGIN,
  };
}

export const RENDERER_NEKODE_ENDPOINT_URLS = buildRuntimeNekodeEndpointUrls(
  createRendererNekodeEndpointEnv(),
);
