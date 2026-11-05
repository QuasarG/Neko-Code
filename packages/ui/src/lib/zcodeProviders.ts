import {
  NEKODE_AGENT_PROVIDER,
  NEKODE_AGENT_PROVIDER_LABEL,
  type NekodeProvider,
} from "@zcode/shared";

export const NEKODE_AGENT_PROVIDERS: NekodeProvider[] = [NEKODE_AGENT_PROVIDER];

export const NEKODE_AGENT_PROVIDER_LABELS: Record<NekodeProvider, string> = {
  glm: NEKODE_AGENT_PROVIDER_LABEL,
};

export function supportsNekodeSessionFork(provider: NekodeProvider): boolean {
  void provider;
  // 功能开关：fork 入口恢复对所有 Nekode provider 开放；实际可操作性仍由 task 状态、
  // assistant 目标和运行中保护 guard 控制，避免把 active/failed 分支暴露为可 fork。
  return true;
}

export function shouldHideNekodeSessionForkAction(provider: NekodeProvider): boolean {
  return !supportsNekodeSessionFork(provider);
}
