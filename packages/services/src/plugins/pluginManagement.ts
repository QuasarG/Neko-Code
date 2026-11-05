// 平台能力面收敛：设置页「插件管理」的薄服务接口。
//
// 背景：pluginManagementStore / usePluginUninstall 过去直接注入 INekodeAgentService，
// UI 层因此散布 13 个 plugins/* 旧协议词的消费点。收敛为独立薄 service 后，UI 只依赖
// 本接口；plugins/* 词表的 host 侧消费点收拢到 pluginManagementService 一处（插件的
// 事实源在 zcode-cli 进程，服务实现仍经 agent 协议往返——plugins 词表的收口归属
// 插件能力面自身的协议演进，不在会话 v4 词表范围内）。
// 注意与既有 IPluginsService（已 retired 的 marketplace pluginStore 通道）区分：
// 那套接口按 pluginName+marketplace 寻址且方法语义过时，不复用避免签名冲突。
import type { Event } from "@zcode/rpc";
import type {
  NekodePluginOperationProgressNotification,
  NekodePluginsConfigureResult,
  NekodePluginsCancelOperationResult,
  NekodePluginsDescribeResult,
  NekodePluginsInstallResult,
  NekodePluginsListResult,
  NekodePluginsMarketplaceMutationResult,
  NekodePluginsOverviewResult,
  NekodePluginsReferenceCatalogResult,
  NekodePluginsRestoreBuiltinResult,
  NekodePluginsSetEnabledResult,
  NekodePluginsUninstallResult,
  NekodePluginsValidateResult,
} from "@zcode/shared";
import { ServiceChannels } from "@zcode/shared";
import { createServiceDescriptor } from "../descriptors.js";
import type {
  NekodeAgentAddPluginMarketplaceParams,
  NekodeAgentConfigurePluginParams,
  NekodeAgentCancelPluginOperationParams,
  NekodeAgentDescribePluginParams,
  NekodeAgentInstallPluginParams,
  NekodeAgentPluginReferenceCatalogParams,
  NekodeAgentResolveSuggestedPluginReferenceParams,
  NekodeAgentResetPluginConfigParams,
  NekodeAgentPluginViewParams,
  NekodeAgentRemovePluginMarketplaceParams,
  NekodeAgentRestoreBuiltinPluginParams,
  NekodeAgentSetPluginEnabledParams,
  NekodeAgentUninstallPluginParams,
  NekodeAgentUpdatePluginMarketplaceParams,
  NekodeAgentUpdatePluginParams,
  NekodeAgentValidatePluginParams,
} from "../zcode-agent/zcodeAgentPluginParams.js";

export interface IPluginManagementService {
  listPlugins(params: NekodeAgentPluginViewParams): Promise<NekodePluginsListResult>;
  /**
   * Plugin 对话引用 catalog：
   * 带 sessionId → session-owned 冻结 catalog；不带 → workspace 当前 catalog。
   * 实现路由到 workspace 级 agent client，不走插件管理独立进程。
   */
  getPluginReferenceCatalog(
    params: NekodeAgentPluginReferenceCatalogParams,
  ): Promise<NekodePluginsReferenceCatalogResult>;
  resolveSuggestedPluginReference(
    params: NekodeAgentResolveSuggestedPluginReferenceParams,
  ): Promise<import("@zcode/shared").NekodePluginsResolveSuggestedReferenceResult>;
  onDynamicPluginOperationProgress(
    operationId: string,
  ): Event<NekodePluginOperationProgressNotification>;
  getPluginsOverview(params: NekodeAgentPluginViewParams): Promise<NekodePluginsOverviewResult>;
  addPluginMarketplace(
    params: NekodeAgentAddPluginMarketplaceParams,
  ): Promise<NekodePluginsMarketplaceMutationResult>;
  removePluginMarketplace(
    params: NekodeAgentRemovePluginMarketplaceParams,
  ): Promise<NekodePluginsMarketplaceMutationResult>;
  updatePluginMarketplace(
    params: NekodeAgentUpdatePluginMarketplaceParams,
  ): Promise<NekodePluginsMarketplaceMutationResult>;
  installPlugin(params: NekodeAgentInstallPluginParams): Promise<NekodePluginsInstallResult>;
  cancelPluginOperation(
    params: NekodeAgentCancelPluginOperationParams,
  ): Promise<NekodePluginsCancelOperationResult>;
  uninstallPlugin(params: NekodeAgentUninstallPluginParams): Promise<NekodePluginsUninstallResult>;
  updatePlugin(params: NekodeAgentUpdatePluginParams): Promise<NekodePluginsInstallResult>;
  restoreBuiltinPlugin(
    params: NekodeAgentRestoreBuiltinPluginParams,
  ): Promise<NekodePluginsRestoreBuiltinResult>;
  configurePlugin(params: NekodeAgentConfigurePluginParams): Promise<NekodePluginsConfigureResult>;
  resetPluginConfig(
    params: NekodeAgentResetPluginConfigParams,
  ): Promise<NekodePluginsConfigureResult>;
  validatePlugin(params: NekodeAgentValidatePluginParams): Promise<NekodePluginsValidateResult>;
  describePlugin(params: NekodeAgentDescribePluginParams): Promise<NekodePluginsDescribeResult>;
  setPluginEnabled(params: NekodeAgentSetPluginEnabledParams): Promise<NekodePluginsSetEnabledResult>;
}

export const IPluginManagementService = createServiceDescriptor<IPluginManagementService>(
  ServiceChannels.PluginManagement,
);

/** 入口只附加观测上下文；RPC 方法由 Proxy 动态提供，不能通过对象展开复制。 */
export function withPluginTelemetry(
  service: IPluginManagementService,
  telemetry: NonNullable<NekodeAgentInstallPluginParams["telemetry"]>,
): IPluginManagementService {
  const mutations = new Set<PropertyKey>([
    "addPluginMarketplace",
    "removePluginMarketplace",
    "updatePluginMarketplace",
    "installPlugin",
    "uninstallPlugin",
    "updatePlugin",
    "restoreBuiltinPlugin",
    "configurePlugin",
    "resetPluginConfig",
    "setPluginEnabled",
  ]);
  return new Proxy(service, {
    get(target, property) {
      const method = Reflect.get(target, property, target);
      if (typeof method !== "function") return method;
      if (!mutations.has(property)) return method.bind(target);
      return (params: NekodeAgentInstallPluginParams) =>
        method.call(target, { ...params, telemetry });
    },
  });
}
