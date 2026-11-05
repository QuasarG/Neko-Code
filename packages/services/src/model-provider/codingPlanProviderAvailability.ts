import type { ProviderFamilyDomain } from "@zcode/shared";

export type CodingPlanUnavailableReason =
  | "coding_plan_not_authenticated"
  | "coding_plan_not_connected"
  | "coding_plan_auth_failed"
  | "coding_plan_not_entitled";

interface CodingPlanAvailabilityCredentialService {
  load(key: string): Promise<string | null>;
}

interface CodingPlanAvailabilityContext {
  apiClient?: unknown;
  credentialService?: CodingPlanAvailabilityCredentialService;
  providerFamilyConnectionSelections?: unknown;
}

export type CodingPlanAvailabilityResult =
  | { kind: "available"; models?: readonly string[] }
  | { kind: "pending"; effectiveAt: number; models: readonly string[] }
  | { kind: "unavailable"; reason: CodingPlanUnavailableReason }
  | { kind: "unknown" };

export interface CodingPlanAvailabilityProvider {
  readonly providerId: string;
  readonly family: ProviderFamilyDomain;
  readonly planKind: "start-plan" | "individual-coding-plan" | "team-coding-plan";
  readonly apiKey?: string | null;
}

/**
 * 账号登录与订阅后端已下线。
 *
 * 这里不再查询 z.ai / bigmodel 的订阅、顾客权益或余额接口：所有 Coding Plan
 * 入口一律判为「未连接」，Provider 选择因此只依赖显式 API Key 配置。
 */
const NOT_CONNECTED: CodingPlanAvailabilityResult = {
  kind: "unavailable",
  reason: "coding_plan_not_connected",
};

export async function validateCodingPlanProviderAvailability(
  _provider: CodingPlanAvailabilityProvider,
  _context: CodingPlanAvailabilityContext,
): Promise<CodingPlanAvailabilityResult> {
  return NOT_CONNECTED;
}

export async function validateZaiAccountProviderAvailability(
  providers: readonly CodingPlanAvailabilityProvider[],
  _context: CodingPlanAvailabilityContext,
): Promise<Partial<Record<string, CodingPlanAvailabilityResult>>> {
  return resolveUnavailableProviders(providers, "zai");
}

export async function validateBigModelAccountProviderAvailability(
  providers: readonly CodingPlanAvailabilityProvider[],
  _context: CodingPlanAvailabilityContext,
): Promise<Partial<Record<string, CodingPlanAvailabilityResult>>> {
  return resolveUnavailableProviders(providers, "bigmodel");
}

function resolveUnavailableProviders(
  providers: readonly CodingPlanAvailabilityProvider[],
  family: ProviderFamilyDomain,
): Partial<Record<string, CodingPlanAvailabilityResult>> {
  const result: Record<string, CodingPlanAvailabilityResult> = {};
  for (const provider of providers) {
    if (provider.family !== family) continue;
    result[provider.providerId] = NOT_CONNECTED;
  }
  return result;
}
