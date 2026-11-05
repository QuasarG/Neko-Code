import { buildRuntimeNekodeApiUrl, resolveZaiBusinessBaseUrl } from "@zcode/shared";

export const NEKODE_CLIENT_SCENES_URL = buildRuntimeNekodeApiUrl(
  process.env,
  "/api/v1/client/scenes",
);

export const ZAI_API_HOST = resolveZaiBusinessBaseUrl(process.env);
