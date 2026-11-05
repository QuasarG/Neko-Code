const NEKODE_PROCESS_PREFIX = "zcode";
const MAX_PROCESS_NAME_SEGMENT_LENGTH = 24;

function sanitizeProcessNameSegment(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, MAX_PROCESS_NAME_SEGMENT_LENGTH);
}

function joinNekodeProcessName(...segments: Array<string | null | undefined>): string {
  const sanitizedSegments = segments
    .map((segment) => sanitizeProcessNameSegment(segment))
    .filter((segment): segment is string => Boolean(segment));
  return [NEKODE_PROCESS_PREFIX, ...sanitizedSegments].join("-");
}

function pickWorkspaceTag(workspacePath: string | null | undefined): string | undefined {
  const trimmedPath = workspacePath?.trim();
  if (!trimmedPath) {
    return undefined;
  }

  const parts = trimmedPath.split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) ?? trimmedPath;
}

export function formatNekodeMainProcessName(): string {
  return joinNekodeProcessName("main");
}

export function formatNekodeGpuProcessName(): string {
  return joinNekodeProcessName("gpu");
}

export function formatNekodeHostProcessName(label?: string): string {
  return joinNekodeProcessName("host", label);
}

export function formatNekodeRendererProcessName(windowTitle?: string): string {
  const normalizedTitle = windowTitle?.trim();
  if (!normalizedTitle || normalizedTitle === "Nekode") {
    return joinNekodeProcessName("renderer", "main");
  }

  if (normalizedTitle === "Resource Manager") {
    return joinNekodeProcessName("renderer", "resource-manager");
  }

  const remoteWindowPrefix = "Nekode - ";
  if (normalizedTitle.startsWith(remoteWindowPrefix)) {
    return joinNekodeProcessName(
      "renderer",
      "remote",
      normalizedTitle.slice(remoteWindowPrefix.length),
    );
  }

  return joinNekodeProcessName("renderer", normalizedTitle);
}

export function formatNekodeAgentProcessName(provider: string, workspacePath?: string): string {
  return joinNekodeProcessName("agent", provider, pickWorkspaceTag(workspacePath));
}

export function formatNekodeUtilityProcessName(name?: string, type = "utility"): string {
  return joinNekodeProcessName(type, name);
}
