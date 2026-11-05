// 原始 -32602 文案来自旧 Agent schema，跨 RPC 后 UI 不能靠易变字符串识别能力缺失。
// ChannelClient 会保留 error.code，因此用稳定 code 驱动设置页停止 status-only 轮询。
export const NEKODE_AGENT_MCP_STATUS_MODE_UNSUPPORTED_ERROR_CODE =
  "NEKODE_AGENT_MCP_STATUS_MODE_UNSUPPORTED";

export class NekodeAgentMcpStatusModeUnsupportedError extends Error {
  readonly code = NEKODE_AGENT_MCP_STATUS_MODE_UNSUPPORTED_ERROR_CODE;

  constructor() {
    super("The connected Nekode Agent does not support MCP status-only refresh");
    this.name = "NekodeAgentMcpStatusModeUnsupportedError";
  }
}

export function isNekodeAgentMcpStatusModeUnsupportedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  return (error as { code?: unknown }).code === NEKODE_AGENT_MCP_STATUS_MODE_UNSUPPORTED_ERROR_CODE;
}
