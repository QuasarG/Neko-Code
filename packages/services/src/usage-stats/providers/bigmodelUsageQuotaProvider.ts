import {
  isZaiCodingPlanProviderId,
  type ApiClient,
  type CodingPlanRegularTpsRequest,
  type CodingPlanResetOpportunityRequest,
  type CodingPlanResetOpportunityResult,
  type CodingPlanResetScopeRequest,
  type CodingPlanResetStatusSnapshot,
  type CodingPlanResetUseRequest,
  type CodingPlanResetUseResult,
  type CodingPlanUsageRequest,
  type CodingPlanUsageSnapshot,
  type UsageEntitlementRequest,
  type UsageEntitlementSnapshot,
  type UsageStatsRequest,
  type UsageStatsSnapshot,
} from "@zcode/shared";
import type { ICredentialService } from "../../credential/credential.js";
import type { IAccountRequestAuthService } from "../../model-provider/accountRequestAuthService.js";
import type { OfficialMcpCredentialSource } from "./zcodeMcpQuotaProvider.js";

export interface UsageApiAuthorizationRequest {
  readonly preferredProviderId?: string;
  readonly requirePreferredProvider: boolean;
}

export interface UsageApiAuthorization {
  readonly authorization: string;
  readonly quotaUrl: string;
  readonly provider: {
    id: string;
    name: string;
  };
}

interface BigModelUsageQuotaProviderOptions {
  apiClient: ApiClient;
  accountRequestAuthService: Pick<
    IAccountRequestAuthService,
    "resolveAccessCurrent" | "resolveCurrent" | "assertCurrent"
  >;
  resolveApiAuthorization?: (
    request: UsageApiAuthorizationRequest,
  ) => Promise<UsageApiAuthorization | null>;
  credentialService?: Pick<ICredentialService, "load">;
  env?: NodeJS.ProcessEnv;
  officialMcpCredentialSource?: OfficialMcpCredentialSource;
}

/** 账号后端下线后额度接口恒定的失败码；UI 已有「没有可用额度数据」的分支。 */
const QUOTA_UNAVAILABLE_ERROR = "no_bigmodel_api_key";
const RESET_ACCOUNT_REQUIRED_ERROR = "coding_plan_reset_account_access_required";

/** 保留原实现的 provider 维度错误码，UI 据此区分 Z.ai / BigModel 的缺失 Key 文案。 */
function resolveCodingPlanApiKeyError(providerId: string | undefined): string {
  return providerId && isZaiCodingPlanProviderId(providerId)
    ? "zai_coding_plan_api_key_required"
    : "bigmodel_coding_plan_api_key_required";
}

function assertValidResetIdempotencyKey(idempotencyKey: string): void {
  const trimmed = idempotencyKey.trim();
  if (!trimmed || trimmed.length > 64) {
    throw new Error("coding_plan_reset_invalid_idempotency_key");
  }
}

function createUnavailableEntitlementSnapshot(): UsageEntitlementSnapshot {
  return {
    generatedAt: Date.now(),
    authenticated: false,
    unavailableReason: "unavailable",
    context: null,
    provider: null,
    remaining: null,
    subscription: null,
    quota: null,
    mcpQuota: null,
  };
}

function createUnavailableResetStatus(): CodingPlanResetStatusSnapshot {
  return {
    availableFiveHourResets: [],
    availableWeekResets: [],
    latestFiveHourResetHistory: null,
    latestWeekResetHistory: null,
    hasUnreadHistory: false,
  };
}

/**
 * Coding Plan 额度 / 重置查询。
 *
 * 账号登录与订阅后端已下线，这里不再发起任何 z.ai / bigmodel 请求：
 * 权益快照固定返回 `unavailableReason: "unavailable"`（不抛错，Provider 选择照常工作），
 * 监控类接口保持既有的「无凭据」失败码，重置类接口返回空状态。
 */
export class BigModelUsageQuotaProvider {
  constructor(_options: BigModelUsageQuotaProviderOptions) {}

  async getSnapshot(): Promise<UsageEntitlementSnapshot> {
    return createUnavailableEntitlementSnapshot();
  }

  async getSnapshotForRequest(
    _request: UsageEntitlementRequest = {},
  ): Promise<UsageEntitlementSnapshot> {
    return createUnavailableEntitlementSnapshot();
  }

  async getUsageStatsSnapshot(_request: UsageStatsRequest): Promise<UsageStatsSnapshot> {
    throw new Error(QUOTA_UNAVAILABLE_ERROR);
  }

  async getCodingPlanUsageSnapshot(
    request: CodingPlanUsageRequest,
  ): Promise<CodingPlanUsageSnapshot> {
    throw new Error(resolveCodingPlanApiKeyError(request.preferredProviderId));
  }

  async getCodingPlanResetStatus(
    _request: CodingPlanResetScopeRequest,
  ): Promise<CodingPlanResetStatusSnapshot> {
    return createUnavailableResetStatus();
  }

  async useCodingPlanReset(request: CodingPlanResetUseRequest): Promise<CodingPlanResetUseResult> {
    assertValidResetIdempotencyKey(request.idempotencyKey);
    throw new Error(RESET_ACCOUNT_REQUIRED_ERROR);
  }

  async requestCodingPlanResetOpportunity(
    request: CodingPlanResetOpportunityRequest,
  ): Promise<CodingPlanResetOpportunityResult> {
    assertValidResetIdempotencyKey(request.idempotencyKey);
    return { granted: false, nextTryAt: null };
  }

  async markCodingPlanResetHistoryRead(_request: CodingPlanResetScopeRequest): Promise<void> {}

  async getCodingPlanRegularTps(
    _request: CodingPlanRegularTpsRequest,
  ): Promise<number | undefined> {
    return undefined;
  }
}
