import { z } from "zod";
import type { CommandAgentSource } from "./command-types.js";
import type { NekodeProvider } from "./zcode-task-types-core.js";

export const NEKODE_AGENT_PROVIDER = "glm" satisfies NekodeProvider;
export const NEKODE_AGENT_PROVIDER_LABEL = "Nekode Agent";
export const NEKODE_COMMAND_AGENT_SOURCE = "zcodeAgent" satisfies CommandAgentSource;

/**
 * 解析持久化/relay 数据时的 provider 归一 schema：
 * 已移除的第三方 provider 历史值仅作为归一化输入保留，统一收敛为 glm；
 * 其它非法值保持拒绝，与收窄前的校验边界一致。
 */
export const legacyNekodeProviderSchema = z
  .enum(["claude", "opencode", "gemini", "codex", "glm"])
  .transform((): typeof NEKODE_AGENT_PROVIDER => NEKODE_AGENT_PROVIDER);

export const NEKODE_ENABLED_AGENT_PROVIDERS = [
  NEKODE_AGENT_PROVIDER,
] as const satisfies readonly NekodeProvider[];

export const NEKODE_COMMAND_AGENT_SOURCES = [
  NEKODE_COMMAND_AGENT_SOURCE,
] as const satisfies readonly CommandAgentSource[];

export function normalizeAgentProviderToNekodeAgent(
  _provider?: NekodeProvider | null,
): NekodeProvider {
  return NEKODE_AGENT_PROVIDER;
}

export function normalizeAgentProvidersToNekodeAgent(
  _providers?: ReadonlyArray<NekodeProvider> | null,
): NekodeProvider[] {
  return [...NEKODE_ENABLED_AGENT_PROVIDERS];
}

export function normalizeCommandAgentSourceToNekodeAgent(
  _agentSource?: CommandAgentSource | null,
): CommandAgentSource {
  return NEKODE_COMMAND_AGENT_SOURCE;
}

export function isNekodeAgentProvider(
  provider: NekodeProvider | null | undefined,
): provider is typeof NEKODE_AGENT_PROVIDER {
  return provider === NEKODE_AGENT_PROVIDER;
}
