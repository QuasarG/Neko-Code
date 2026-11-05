import type {
  ModelSelection,
  NekodeAgentMcpServer,
  NekodeAutomationScheduleRule,
  NekodeMcpListMode,
} from "@zcode/shared";
import type { McpAppsAppToolCallResult, McpAppsAppToolDescriptor } from "@zcode/shared/mcp-apps";

export interface NekodeAgentWorkspaceTarget {
  workspacePath: string;
  workspaceIdentity?: string;
  /** 远程 workspace 的运行时会话身份；只用于隔离/路由，不能替代 workspacePath。 */
  remoteSessionId?: string;
}

export interface NekodeAgentPluginMutationTarget extends NekodeAgentWorkspaceTarget {
  /** 仅 Host 观测使用；不会传给 CLI。 */
  telemetry?: {
    entry?:
      | "store_list"
      | "store_detail"
      | "side_pane_market"
      | "recommended_prompt"
      | "recommended_ui"
      | "component_settings";
    client_kind?: "desktop" | "mobile";
    trigger?: "user" | "automatic" | "dependency" | "restore" | "sync";
  };
}

export interface NekodeAgentPluginViewParams extends NekodeAgentWorkspaceTarget {
  configScope?: "user" | "workspace";
}

export interface NekodeAgentListMcpServerStatusesParams extends NekodeAgentWorkspaceTarget {
  mcpServers?: NekodeAgentMcpServer[];
  mode?: NekodeMcpListMode;
}

export interface NekodeAgentAddPluginMarketplaceParams extends NekodeAgentPluginMutationTarget {
  dryRun?: boolean;
  operationId?: string;
  source: string;
}

export interface NekodeAgentRemovePluginMarketplaceParams extends NekodeAgentPluginMutationTarget {
  marketplace: string;
}

export interface NekodeAgentUpdatePluginMarketplaceParams extends NekodeAgentPluginMutationTarget {
  marketplace?: string;
  operationId?: string;
}

export interface NekodeAgentInstallPluginParams extends NekodeAgentPluginMutationTarget {
  dryRun?: boolean;
  marketplace: string;
  operationId?: string;
  pluginName: string;
  scope?: "user" | "workspace";
}

export interface NekodeAgentCancelPluginOperationParams {
  operationId: string;
}

export interface NekodeAgentUninstallPluginParams extends NekodeAgentPluginMutationTarget {
  marketplace?: string;
  pluginId?: string;
  pluginName?: string;
  removeCache?: boolean;
}

export interface NekodeAgentUpdatePluginParams extends NekodeAgentPluginMutationTarget {
  pluginId?: string;
  marketplace?: string;
}

export interface NekodeAgentRestoreBuiltinPluginParams extends NekodeAgentPluginMutationTarget {
  pluginId: string;
}

export interface NekodeAgentConfigurePluginParams extends NekodeAgentPluginMutationTarget {
  clearOptionKeys?: string[];
  dryRun?: boolean;
  options: Record<string, unknown>;
  pluginId: string;
  scope?: "user" | "workspace";
}

export interface NekodeAgentResetPluginConfigParams extends NekodeAgentPluginMutationTarget {
  pluginId: string;
  scope?: "user" | "workspace";
}

export interface NekodeAgentValidatePluginParams extends NekodeAgentWorkspaceTarget {
  marketplace?: string;
  pluginName?: string;
  source?: string;
}

export interface NekodeAgentDescribePluginParams extends NekodeAgentWorkspaceTarget {
  marketplace: string;
  pluginName: string;
}

export interface NekodeAgentSetPluginEnabledParams extends NekodeAgentPluginMutationTarget {
  enabled: boolean;
  operationId?: string;
  pluginId: string;
  scope?: "user" | "workspace";
}

// Plugin 对话引用 catalog：
// 带 sessionId → session-owned 冻结 catalog（必须路由到持有该 session 的 workspace client）；
// 不带 → workspace 当前 catalog（新建草稿 Picker）。
export interface NekodeAgentPluginReferenceCatalogParams extends NekodeAgentWorkspaceTarget {
  sessionId?: string;
}

// Composer Skill catalog：与 Plugin 引用相同，以 sessionId 区分 workspace 当前目录和
// resident Session runtime 快照；不参与 Settings 管理目录。
export interface NekodeAgentSkillReferenceCatalogParams extends NekodeAgentWorkspaceTarget {
  sessionId?: string;
}

/** 插件 UI：UI 发起的 `ui://` 资源读取。 */
export interface NekodeAgentReadMcpResourceParams extends NekodeAgentWorkspaceTarget {
  instance: import("@zcode/shared/mcp-apps").McpAppInstance;
  sessionId: string;
  pluginId: string;
  serverName: string;
  uri: string;
}

/** 插件 UI 页面发起的 `resources/read`；参数与 readMcpResource 同形，结果受 8 MiB 与 mimeType 白名单约束。 */
export type NekodeAgentReadMcpResourceForUiParams = NekodeAgentReadMcpResourceParams;

/** 插件 UI：UI 回调本插件工具；不进审批流，归属由 agent 侧 catalog fail closed。 */
export interface NekodeAgentCallMcpToolForUiParams extends NekodeAgentWorkspaceTarget {
  instance: import("@zcode/shared/mcp-apps").McpAppInstance;
  sessionId: string;
  pluginId: string;
  serverName: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  /** 宿主生成的调用 id，配合 cancelMcpToolCallForUi。 */
  callId: string;
}
/** 插件 UI 页面发起的 resources/list、resources/templates/list、subscribe、unsubscribe。 */
export interface NekodeAgentListMcpResourcesForUiParams extends NekodeAgentWorkspaceTarget {
  instance: import("@zcode/shared/mcp-apps").McpAppInstance;
  sessionId: string;
  pluginId: string;
  serverName: string;
  cursor?: string;
}
/** App-Provided Tools：实例身份 = 会话 + 沙箱作用域 + 代际。 */
export interface NekodeAgentAppToolInstanceForUiParams extends NekodeAgentWorkspaceTarget {
  instance: import("@zcode/shared/mcp-apps").McpAppInstance;
  sessionId: string;
  pluginId: string;
  serverName: string;
  scopeId: string;
  generation: number;
}
export interface NekodeAgentRegisterAppToolsForUiParams extends NekodeAgentAppToolInstanceForUiParams {
  tools: McpAppsAppToolDescriptor[];
}
export interface NekodeAgentAppToolCallForUiParams extends NekodeAgentAppToolInstanceForUiParams {
  callId: string;
}
export interface NekodeAgentResolveAppToolCallForUiParams extends NekodeAgentAppToolCallForUiParams {
  result?: McpAppsAppToolCallResult;
  error?: { message: string };
}
export interface NekodeAgentMcpResourceSubscriptionForUiParams extends NekodeAgentWorkspaceTarget {
  instance: import("@zcode/shared/mcp-apps").McpAppInstance;
  sessionId: string;
  pluginId: string;
  serverName: string;
  scopeId: string;
  generation: number;
  uri: string;
}
export interface NekodeAgentCancelMcpToolCallForUiParams extends NekodeAgentWorkspaceTarget {
  instance: import("@zcode/shared/mcp-apps").McpAppInstance;
  sessionId: string;
  pluginId: string;
  serverName: string;
  callId: string;
}
export interface NekodeAgentResolveSuggestedPluginReferenceParams extends NekodeAgentWorkspaceTarget {
  stableId: string;
  operationId: string;
  clientMode: "desktop-continuous" | "web-remote-replayable";
  deliveryKind: "desktop-continuous" | "web-remote-replayable";
}

// ---- 定时任务(automation)管理参数 ----

export interface NekodeAgentCreateAutomationParams extends NekodeAgentWorkspaceTarget {
  projectId?: string | null;
  title: string;
  cronExpr: string;
  relativeDelayMinutes?: number;
  prompt: string;
  modelSelection?: ModelSelection;
  mode?: string;
  recurring?: boolean;
  maxRuns?: number;
  endAt?: number;
  scheduleRule?: NekodeAutomationScheduleRule;
}

export interface NekodeAgentUpdateAutomationParams extends NekodeAgentWorkspaceTarget {
  automationId: string;
  title?: string;
  cronExpr?: string;
  prompt?: string;
  modelSelection?: ModelSelection | null;
  mode?: string | null;
  recurring?: boolean;
  maxRuns?: number | null;
  endAt?: number | null;
  scheduleRule?: NekodeAutomationScheduleRule | null;
  scheduleEditedByUser?: boolean;
}

export interface NekodeAgentAutomationIdParams extends NekodeAgentWorkspaceTarget {
  automationId: string;
}

export interface NekodeAgentSetAutomationEnabledParams extends NekodeAgentWorkspaceTarget {
  automationId: string;
  enabled: boolean;
}

export interface NekodeAgentDeleteAutomationRunParams extends NekodeAgentWorkspaceTarget {
  runId: string;
}
