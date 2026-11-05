import type { ModelSelectionView } from "@zcode/provider";
import {
  DEFAULT_NEKODE_MODEL_CONTEXT_BUDGET_STRATEGY,
  resolveDynamicWorkflowClientConfig,
  type CodingPlanBatchPreviewRequest,
  type CodingPlanBatchPreviewResponse,
  type CodingPlanBillingDiscountConfig,
  type CodingPlanCreateSignRequest,
  type CodingPlanPaymentCheckRequest,
  type CodingPlanPaymentCheckResponse,
  type CodingPlanPaypalSubscribeRequest,
  type CodingPlanPaypalSubscribeResponse,
  type CodingPlanPaypalSupportResponse,
  type CodingPlanPaypalSetupTokenRequest,
  type CodingPlanPaypalSetupTokenResponse,
  type CodingPlanPendingOrderCheckResponse,
  type CodingPlanPreviewRequest,
  type CodingPlanPreviewResponse,
  type CodingPlanProductInfo,
  type CodingPlanProductInfoRequest,
  type CodingPlanStaticProductsConfig,
  type CodingPlanStaticTeamProductsConfig,
  type CodingPlanStripeBindRequest,
  type CodingPlanStripeBindResponse,
  type CodingPlanStripeCard,
  type CodingPlanStripePayRequest,
  type CodingPlanStripePayResponse,
  type CodingPlanStripeUnbindRequest,
  type CodingPlanUpdateSignRequest,
  type CodingPlanAgreementResponse,
  type DynamicWorkflowClientConfig,
  type EnterpriseCodingPlanBalanceResponse,
  type EnterpriseCodingPlanCancelOrderRequest,
  type EnterpriseCodingPlanCancelOrderResponse,
  type EnterpriseCodingPlanContinuePayRequest,
  type EnterpriseCodingPlanCreateOrderRequest,
  type EnterpriseCodingPlanCreateOrderResponse,
  type EnterpriseCodingPlanOrderCalculateRequest,
  type EnterpriseCodingPlanOrderCalculateResponse,
  type EnterpriseCodingPlanOrderStatusRequest,
  type EnterpriseCodingPlanOrderStatusResponse,
  type EnterpriseCodingPlanPendingOrder,
  type EnterpriseCodingPlanPricingRequest,
  type EnterpriseCodingPlanPricingResponse,
  type ForceUpdateConfig,
  type ManualClaimPlanClaimRequest,
  type ManualClaimPlanClaimResult,
  type ManualClaimPlanPreviewSnapshot,
  type RequestVerificationConfig,
  type StartPlanPreviewConfig,
} from "@zcode/shared";
import type { ICodingPlanSubscriptionService, OffPeakClientConfig } from "./codingPlanSubscription.js";

interface CodingPlanSubscriptionServiceDependencies {
  /**
   * 闲时模型的候选视图。账号后端下线后闲时任务不再开通，但视图仍要能构造出来，
   * 让设置页与 agent 侧读到一致的「已关闭」事实。
   */
  resolveOffPeakModelSelectionView?: () => Promise<ModelSelectionView>;
  /** 用户在设置里选的动态工作流模式（纯本地设置，不涉及远端）。 */
  resolveDynamicWorkflowUserMode?: () => Promise<unknown>;
}

const EMPTY_MODEL_SELECTION_VIEW: ModelSelectionView = Object.freeze({
  revision: 0,
  providers: Object.freeze([]),
});

/**
 * 账号与订阅后端在本构建中不可用。
 *
 * 这里保留 `ICodingPlanSubscriptionService` 的完整形状（UI 与 agent 装配继续按原接口
 * 编译），但所有实现都不发请求：
 *   - 产品/定价/订阅/支付/企业订单一律返回空结果，不访问 z.ai / bigmodel；
 *   - 闲时任务与动态工作流只读本地设置与环境覆盖，fail-closed。
 */
export function createCodingPlanSubscriptionService(
  dependencies: CodingPlanSubscriptionServiceDependencies = {},
): ICodingPlanSubscriptionService {
  const resolveModelSelectionView = async (): Promise<ModelSelectionView> =>
    (await dependencies.resolveOffPeakModelSelectionView?.()) ?? EMPTY_MODEL_SELECTION_VIEW;

  return {
    async batchPreview(
      _request?: CodingPlanBatchPreviewRequest,
    ): Promise<CodingPlanBatchPreviewResponse> {
      return { productList: [], isSubscribed: false, isAuthenticated: false };
    },
    async getStaticProducts(): Promise<CodingPlanStaticProductsConfig> {
      return {};
    },
    async getStaticTeamProducts(): Promise<CodingPlanStaticTeamProductsConfig> {
      return {};
    },
    async getStartPlanPreview(): Promise<StartPlanPreviewConfig | null> {
      return null;
    },
    async getManualClaimPlanPreviews(): Promise<ManualClaimPlanPreviewSnapshot> {
      return { plans: [] };
    },
    async claimManualPlan(_request: ManualClaimPlanClaimRequest): Promise<ManualClaimPlanClaimResult> {
      return { success: false, code: 0, message: "coding_plan_unavailable" };
    },
    async getOffPeakClientConfig(_options?: { forceRefresh?: boolean }): Promise<OffPeakClientConfig> {
      const modelSelectionView = await resolveModelSelectionView();
      const hasModels = modelSelectionView.providers.some((provider) => provider.models.length > 0);
      if (process.env["NEKODE_OFFPEAK_MOCK"] === "1") {
        // 离线 E2E 用环境变量替代远端曝光配置，保持既有 mock 语义。
        return {
          enabled: hasModels,
          modelSelectionView,
          codingPlanActive: process.env["NEKODE_OFFPEAK_MOCK_NO_PLAN"] !== "1",
        };
      }
      return { enabled: false, modelSelectionView };
    },
    async getDynamicWorkflowClientConfig(
      _options?: { forceRefresh?: boolean },
    ): Promise<DynamicWorkflowClientConfig> {
      // 远端配置面已下线；只保留本地覆盖（NEKODE_DYNAMIC_WORKFLOW_MODE）与用户选择。
      const userMode = dependencies.resolveDynamicWorkflowUserMode
        ? await dependencies.resolveDynamicWorkflowUserMode()
        : undefined;
      return resolveDynamicWorkflowClientConfig({
        remote: undefined,
        env: process.env,
        userMode,
      });
    },
    async getModelContextBudgetStrategy() {
      return DEFAULT_NEKODE_MODEL_CONTEXT_BUDGET_STRATEGY;
    },
    async getBillingDiscount(): Promise<CodingPlanBillingDiscountConfig | undefined> {
      return undefined;
    },
    async getRequestVerificationConfig(): Promise<RequestVerificationConfig | null> {
      return null;
    },
    async getForceUpdateConfig(): Promise<ForceUpdateConfig | null> {
      return null;
    },
    async productInfo(request: CodingPlanProductInfoRequest): Promise<CodingPlanProductInfo> {
      return { productId: request.productId };
    },
    async preview(request: CodingPlanPreviewRequest): Promise<CodingPlanPreviewResponse> {
      return { productId: request.productId, bizId: "" };
    },
    async createSign(_request: CodingPlanCreateSignRequest): Promise<CodingPlanAgreementResponse> {
      return { sign: "" };
    },
    async updateSign(_request: CodingPlanUpdateSignRequest): Promise<CodingPlanAgreementResponse> {
      return { sign: "" };
    },
    async checkPayment(
      _request: CodingPlanPaymentCheckRequest,
    ): Promise<CodingPlanPaymentCheckResponse> {
      return { status: "unavailable" };
    },
    async checkPendingOrders(): Promise<CodingPlanPendingOrderCheckResponse> {
      return { hasPendingOrders: false };
    },
    async queryStripeCards(): Promise<CodingPlanStripeCard[]> {
      return [];
    },
    async bindStripeCard(request: CodingPlanStripeBindRequest): Promise<CodingPlanStripeBindResponse> {
      return { paymentMethodId: request.paymentMethodId };
    },
    async unbindStripeCard(_request: CodingPlanStripeUnbindRequest): Promise<string> {
      return "";
    },
    async payStripe(_request: CodingPlanStripePayRequest): Promise<CodingPlanStripePayResponse> {
      return { status: "unavailable" };
    },
    async checkPaypalSupport(): Promise<CodingPlanPaypalSupportResponse> {
      return { isSupport: false };
    },
    async createPaypalSetupToken(
      _request: CodingPlanPaypalSetupTokenRequest,
    ): Promise<CodingPlanPaypalSetupTokenResponse> {
      return {};
    },
    async subscribePaypal(
      _request: CodingPlanPaypalSubscribeRequest,
    ): Promise<CodingPlanPaypalSubscribeResponse> {
      return {};
    },
    async getEnterprisePricing(
      _request?: EnterpriseCodingPlanPricingRequest,
    ): Promise<EnterpriseCodingPlanPricingResponse> {
      return { productList: [] };
    },
    async getEnterpriseBalance(): Promise<EnterpriseCodingPlanBalanceResponse> {
      return { giveBalance: 0, cashBalance: 0, totalBalance: 0 };
    },
    async calculateEnterpriseOrder(
      _request: EnterpriseCodingPlanOrderCalculateRequest,
    ): Promise<EnterpriseCodingPlanOrderCalculateResponse> {
      return { totalOriginalAmount: 0, totalPayAmount: 0, thirdPayAmount: 0 };
    },
    async createEnterpriseOrder(
      _request: EnterpriseCodingPlanCreateOrderRequest,
    ): Promise<EnterpriseCodingPlanCreateOrderResponse> {
      return { orderNo: "", totalOriginalAmount: 0, totalPayAmount: 0, thirdPayAmount: 0 };
    },
    async getEnterprisePendingOrders(): Promise<EnterpriseCodingPlanPendingOrder[]> {
      return [];
    },
    async cancelEnterpriseOrder(
      request: EnterpriseCodingPlanCancelOrderRequest,
    ): Promise<EnterpriseCodingPlanCancelOrderResponse> {
      return { orderNo: request.orderNo, status: "CANCELLED" };
    },
    async continueEnterpriseOrderPayment(
      request: EnterpriseCodingPlanContinuePayRequest,
    ): Promise<EnterpriseCodingPlanCreateOrderResponse> {
      return {
        orderNo: request.orderNo,
        totalOriginalAmount: 0,
        totalPayAmount: 0,
        thirdPayAmount: 0,
      };
    },
    async checkEnterpriseOrderStatus(
      request: EnterpriseCodingPlanOrderStatusRequest,
    ): Promise<EnterpriseCodingPlanOrderStatusResponse> {
      return { orderNo: request.orderNo, paymentStatus: "CLOSED" };
    },
  };
}
