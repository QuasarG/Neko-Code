import { DEFAULT_NEKODE_ENDPOINT_ORIGIN } from "./zcodeEndpoint.js";

export const NEKODE_SOURCE_HEADERS = {
  "User-Agent": "Nekode/unknown",
  "HTTP-Referer": DEFAULT_NEKODE_ENDPOINT_ORIGIN,
  "X-Title": "Z Code@electron",
} as const;

export interface BuildNekodeSourceHeadersFromContextOptions {
  appVersion?: string;
  arch?: string;
  clientLanguage?: string;
  clientTimezone?: string;
  deviceMid?: string;
  endpointOrigin?: string;
  osVersion?: string;
  platform?: string;
  releaseChannel?: string;
  sourceTitle?: string;
}

export function normalizeNekodeSourceHeaderValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !/^[\x20-\x7e]+$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

export function buildNekodeSourceHeadersFromContext(
  options: BuildNekodeSourceHeadersFromContextOptions = {},
): Record<string, string> {
  const appVersion = normalizeNekodeSourceHeaderValue(options.appVersion);
  const arch = normalizeNekodeSourceHeaderValue(options.arch);
  const clientLanguage = normalizeNekodeSourceHeaderValue(options.clientLanguage) ?? "unknown";
  const clientTimezone = normalizeNekodeSourceHeaderValue(options.clientTimezone) ?? "unknown";
  const deviceMid = normalizeNekodeSourceHeaderValue(options.deviceMid);
  const endpointOrigin =
    normalizeNekodeSourceHeaderValue(options.endpointOrigin) ?? DEFAULT_NEKODE_ENDPOINT_ORIGIN;
  const osVersion = normalizeNekodeSourceHeaderValue(options.osVersion);
  const platform = normalizeNekodeSourceHeaderValue(options.platform);
  const releaseChannel = normalizeNekodeSourceHeaderValue(options.releaseChannel);
  const sourceTitle = normalizeNekodeSourceHeaderValue(options.sourceTitle) ?? "electron";

  return {
    ...NEKODE_SOURCE_HEADERS,
    "HTTP-Referer": endpointOrigin,
    "User-Agent": `Nekode/${appVersion ?? "unknown"}`,
    ...(appVersion ? { "X-Nekode-App-Version": appVersion } : {}),
    "X-Title": `Z Code@${sourceTitle}`,
    ...(platform && arch ? { "X-Platform": `${platform}-${arch}` } : {}),
    ...(releaseChannel ? { "X-Release-Channel": releaseChannel } : {}),
    "X-Client-Language": clientLanguage,
    "X-Client-Timezone": clientTimezone,
    ...(platform ? { "X-Os-Category": normalizeOsCategory(platform) } : {}),
    ...(osVersion ? { "X-Os-Version": osVersion } : {}),
    ...(deviceMid ? { "X-Device-Mid": deviceMid } : {}),
  };
}

function normalizeOsCategory(platform: string): string {
  switch (platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
}
