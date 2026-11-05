import type { PluginUiToolResultNotification } from "@zcode/shared/mcp-apps";
import type {
  BackgroundBashOutputResult,
  SessionDebugSnapshot,
  NekodeSessionContentProfile,
} from "@zcode/shared";
/* eslint-disable max-lines -- Nekode agent service 接口集中声明 protocol/session/workspace 方法，拆分会增加 service descriptor 迁移成本。 */
import type { RemoteConversationTelemetryEvent } from "@zcode/shared/conversation-telemetry";
import type { Event, IDisposable } from "@zcode/rpc";
import { ServiceChannels } from "@zcode/shared";
import type { AppUsageRange, AppUsageSnapshot, NekodeTaskTokenUsageResult } from "@zcode/shared";
import type { DynamicWorkflowMode } from "@zcode/shared";
import type { NekodeAutomation, NekodeAutomationRun } from "@zcode/shared";
import type {
  NekodeStorageStartupState,
  NekodeDeliveryKind,
  NekodeAgentMcpServer,
  NekodeBackgroundTurnAttribution,
  TraceId,
  NekodeSessionCompactResult,
  NekodeSessionGoalAction,
  NekodeSessionGoalResult,
  NekodeMessageWithParts,
  ModelSelection,
  NekodeSessionImportHistory,
  NekodePermissionRequestParams,
  AgentLaneResourceSample,
  NekodeMcpTelemetryEvent,
  NekodeMcpResourceSample,
  NekodeToolExecResource,
  NekodeProcessChildProcess,
  NekodeMcpListResult,
  WorkspaceMcpTrustDecision,
  NekodeWorkspaceMcpTrustResult,
  NekodePluginsListResult,
  NekodePluginsOverviewResult,
  NekodePluginsMarketplaceMutationResult,
  NekodePluginsInstallResult,
  NekodePluginsReferenceCatalogResult,
  NekodeSkillsReferenceCatalogResult,
  NekodeMcpReadResourceResult,
  NekodeMcpUiCallToolResult,
  NekodeMcpUiCancelCallResult,
  NekodeMcpUiReadResourceResult,
  NekodeMcpUiListResourcesResult,
  NekodeMcpUiAppToolAcceptedResult,
  NekodeMcpUiRegisterAppToolsResult,
  NekodeMcpUiUnregisterAppToolsResult,
  NekodeMcpUiListResourceTemplatesResult,
  NekodePluginsListUiSurfacesResult,
  NekodeWorkflowsDeleteResult,
  NekodeWorkflowsForRunResult,
  NekodeWorkflowsGetResult,
  NekodeWorkflowsListResult,
  NekodeWorkflowsMoveResult,
  NekodeWorkflowsRunsResult,
  NekodeWorkflowsSaveResult,
  NekodeWorkflowsUpdateMetaResult,
  NekodePluginsUninstallResult,
  NekodePluginsRestoreBuiltinResult,
  NekodePluginsConfigureResult,
  NekodePluginsDescribeResult,
  NekodePluginsValidateResult,
  NekodePluginsSetEnabledResult,
  NekodePluginsCancelOperationResult,
  NekodePluginOperationProgressNotification,
  NekodeProviderRuntimeHeadersRequestParams,
  RequestVerificationConfig,
  NekodeProviderRuntimeHeadersCancelled,
  NekodeProviderTestModelConnectivityParams,
  NekodeProviderTestModelConnectivityResult,
  NekodeUserInputRequestParams,
  NekodeUserInputResponse,
  NekodeSessionEvent,
  NekodeSessionInfo,
  NekodeSessionMode,
  NekodeSessionPersistence,
  NekodeSessionSendResult,
  NekodeSessionRequestRuntimePreferencesParams,
  NekodeSessionRuntimePreferencesResult,
  NekodeSessionStateSnapshot,
  NekodeSessionSubagentsResult,
  NekodeStateUpdatedNotification,
  NekodeTaskClientMode,
  NekodeBrowserAmbientContext,
  NekodeWorkspacePresentation,
  NekodeWorkspaceGenerateTextResult,
  NekodeWorkspaceGenerateTextParams,
  NekodeWorkspaceHookTrustGrantResult,
} from "@zcode/shared";
import type {
  ClientHello,
  CommandAck,
  CommandEnvelope,
  CommandKey,
  CommandsQueryResult,
  ConversationTopicWireCandidate,
  ConversationTelemetryFact,
  CuaPermissionObservation,
  ConversationRowTarget,
  HelloMessage,
  SessionsIndexTopicWireCandidate,
  SessionsIndexReconcileResult,
  V4AttachmentBeginResult,
  V4AttachmentChunkResult,
  V4AttachmentCommitResult,
  V4AttachmentPreviewSourceResult,
  V4AttachmentReadResult,
  V4ConversationAttachmentReadResult,
  V4ConversationAttachmentStatResult,
  V4ConnectionFlowState,
  V4ConversationFileChangesResult,
  V4ConversationFileRewindPreviewResult,
  V4ConversationInputPredictionResult,
  V4ConversationPlansResult,
  V4ConversationWorkflowRunEventsResult,
  V4ConversationWorkflowRunArtifactDataResult,
  V4ConversationWorkflowRunArtifactReadResult,
  V4ConversationWorkflowRunArtifactsResult,
  V4ConversationWorkflowRunNodeResultResult,
  V4ConversationWorkflowRunWorkspaceResult,
  V4ConversationWorkflowRunsResult,
  V4ConversationRowsRangeResult,
  V4ConversationResyncResult,
  V4ConversationSubscribeResult,
  V4SessionsIndexSubscribeResult,
  V4WorkspaceConfigSubscribeResult,
  WorkspaceConfigTopicWireCandidate,
} from "@zcode/shared/zcode-protocol-v4";
import type {
  V4SessionDataMeasureResult,
  V4SessionDataParams,
  V4SessionDataPurgeResult,
} from "@zcode/shared/zcode-protocol-v4";
import { createServiceDescriptor } from "../descriptors.js";

export * from "./zcodeAgentPluginParams.js";
export * from "./zcodeAgentWorkflowParams.js";
import type {
  NekodeAgentAddPluginMarketplaceParams,
  NekodeAgentAutomationIdParams,
  NekodeAgentCancelPluginOperationParams,
  NekodeAgentConfigurePluginParams,
  NekodeAgentResetPluginConfigParams,
  NekodeAgentCreateAutomationParams,
  NekodeAgentDeleteAutomationRunParams,
  NekodeAgentDescribePluginParams,
  NekodeAgentInstallPluginParams,
  NekodeAgentListMcpServerStatusesParams,
  NekodeAgentPluginViewParams,
  NekodeAgentPluginReferenceCatalogParams,
  NekodeAgentSkillReferenceCatalogParams,
  NekodeAgentReadMcpResourceParams,
  NekodeAgentReadMcpResourceForUiParams,
  NekodeAgentListMcpResourcesForUiParams,
  NekodeAgentAppToolCallForUiParams,
  NekodeAgentAppToolInstanceForUiParams,
  NekodeAgentRegisterAppToolsForUiParams,
  NekodeAgentResolveAppToolCallForUiParams,
  NekodeAgentMcpResourceSubscriptionForUiParams,
  NekodeAgentCallMcpToolForUiParams,
  NekodeAgentCancelMcpToolCallForUiParams,
  NekodeAgentResolveSuggestedPluginReferenceParams,
  NekodeAgentRemovePluginMarketplaceParams,
  NekodeAgentRestoreBuiltinPluginParams,
  NekodeAgentSetPluginEnabledParams,
  NekodeAgentSetAutomationEnabledParams,
  NekodeAgentUninstallPluginParams,
  NekodeAgentUpdatePluginMarketplaceParams,
  NekodeAgentUpdatePluginParams,
  NekodeAgentUpdateAutomationParams,
  NekodeAgentValidatePluginParams,
  NekodeAgentWorkspaceTarget,
} from "./zcodeAgentPluginParams.js";
import type {
  NekodeAgentDeleteSavedWorkflowParams,
  NekodeAgentFindSavedWorkflowForRunParams,
  NekodeAgentGetSavedWorkflowParams,
  NekodeAgentListSavedWorkflowRunsParams,
  NekodeAgentListSavedWorkflowsParams,
  NekodeAgentMoveSavedWorkflowParams,
  NekodeAgentSaveSavedWorkflowFromRunParams,
  NekodeAgentUpdateSavedWorkflowMetaParams,
} from "./zcodeAgentWorkflowParams.js";

export interface NekodeAgentSessionTarget extends NekodeAgentWorkspaceTarget {
  sessionId: string;
}

export interface NekodeAgentResumeSessionParams extends NekodeAgentSessionTarget {
  additionalDirectories?: string[];
  model?: ModelSelection;
  thoughtLevel?: string;
  mcpServers?: NekodeAgentMcpServer[];
  // 冷恢复会重建 runtime，工具面隔离必须和 create 保持同一安全边界（CUA 只放行 zcode-cua 工具、
  // 禁 Bash 等）。否则 resume 后模型可见工具面/执行权限会比创建时更宽。
  toolAllowlist?: string[];
  toolDenylist?: string[];
}

export interface NekodeAgentInitializeResult {
  available: boolean;
  workspaceKey: string;
  protocolName?: string;
  protocolVersion?: number;
  transportKind?: "stdio" | "websocket";
  reason?: string;
  reasonCode?: "provider_not_ready";
}

export interface NekodeAgentRunAutomationNowResult {
  status: "queued" | "duplicate";
}

export interface NekodeAgentWorkspaceRuntimeIdentity {
  generation: number;
  identity: string;
  processId?: number;
  workspaceKey: string;
}

export const NEKODE_AGENT_RUNTIME_UNAVAILABLE_CODE = "NEKODE_AGENT_RUNTIME_UNAVAILABLE";

export type NekodeAgentRuntimePolicy = "start-if-needed" | "existing-only";

export interface NekodeAgentRuntimeLifecycleEvent extends NekodeAgentWorkspaceTarget {
  workspaceKey: string;
  runtimeIdentity: NekodeAgentWorkspaceRuntimeIdentity;
  state: "available" | "unavailable";
}

export type NekodeAgentCuaPermissionObservation = CuaPermissionObservation &
  NekodeAgentWorkspaceTarget;

export interface NekodeAgentCreateSessionParams extends NekodeAgentWorkspaceTarget {
  projectId?: string | null;
  additionalDirectories?: string[];
  sessionId?: string;
  sessionTraceId?: TraceId;
  parentSessionId?: string;
  mode?: NekodeSessionMode;
  model?: ModelSelection;
  persistence?: NekodeSessionPersistence;
  thoughtLevel?: string;
  /** automation 执行会话关闭模型二次命名，保持首条用户 query 作为稳定标题。 */
  titleGenerationEnabled?: boolean;
  mcpServers?: NekodeAgentMcpServer[];
  toolAllowlist?: string[];
  toolDenylist?: string[];
  importedHistory?: NekodeSessionImportHistory;
}

export interface NekodeAgentListSessionsParams extends NekodeAgentWorkspaceTarget {
  sessionIds?: string[];
  runtimePolicy?: NekodeAgentRuntimePolicy;
  limit?: number;
}

export interface NekodeAgentListSessionSubagentsParams extends NekodeAgentSessionTarget {
  endedCursor?: string;
  endedLimit?: number;
  /** 远程 workspace 的宿主连接身份；只用于选择现有 Host，不进入 CLI wire query。 */
  remoteSessionId?: string;
}

export interface NekodeAgentAppUsageParams {
  range: AppUsageRange;
  timeZone?: string;
}

export interface NekodeAgentTaskTokenUsageParams extends NekodeAgentSessionTarget {}

export interface NekodeAgentReadSessionParams extends NekodeAgentSessionTarget {
  deliveryKind?: NekodeDeliveryKind;
  messageLimit?: number;
  afterSeq?: number;
  /** 被动索引/观察者只能读取现有 runtime，禁止为了读快照拉起 session。 */
  runtimePolicy?: NekodeAgentRuntimePolicy;
  /** "index" 仅供 task index：返回剥离大载荷的同结构 snapshot，禁止回写 UI 状态。 */
  contentProfile?: NekodeSessionContentProfile;
}

export interface NekodeAgentReadSessionMessagesParams extends NekodeAgentSessionTarget {
  afterMessageId?: string;
  limit?: number;
}

export interface NekodeAgentReadSessionEventsParams extends NekodeAgentSessionTarget {
  afterSeq?: number;
  limit?: number;
}

export type NekodeAgentReadWorkspacePresentationParams = NekodeAgentWorkspaceTarget;

export interface NekodeAgentGrantWorkspaceHookTrustParams extends NekodeAgentWorkspaceTarget {
  bundleDigest: string;
  hookDeclarationDigest: string;
}

export interface NekodeAgentSendPromptParamsBase extends NekodeAgentSessionTarget {
  modelSelection?: ModelSelection;
  modelExecution?: import("@zcode/shared/zcode-protocol-v4").CommandPayloadMap["sendText"]["modelExecution"];
  inputId?: string;
  queryId?: string;
  messageId?: string;
  sessionTraceId?: TraceId;
  content: string;
  attachments?: Record<string, unknown>[];
  /** provider-only 的当前 IAB 状态；UI/session persistence 仍使用 content 原文。 */
  browserAmbientContext?: NekodeBrowserAmbientContext;
  clientMode?: NekodeTaskClientMode;
  expectedRevision?: number;
  expectedProviderRevision?: string;
  runtimeProviderHeaders?: Record<string, string>;
  toolDenylist?: string[];
}

export type NekodeAgentSendPromptParams = NekodeAgentSendPromptParamsBase &
  NekodeBackgroundTurnAttribution;

export interface NekodeAgentCompactParams extends NekodeAgentSessionTarget {
  inputId?: string;
  instructions?: string;
  expectedRevision?: number;
}

export interface NekodeAgentGoalParams extends NekodeAgentSessionTarget {
  inputId?: string;
  action: NekodeSessionGoalAction;
  objective?: string;
  expectedRevision?: number;
}

export interface NekodeAgentSetModelParams extends NekodeAgentSessionTarget {
  model: ModelSelection;
  expectedRevision?: number;
  persistAsWorkspaceLastUsed?: boolean;
}

export interface NekodeAgentSetThoughtLevelParams extends NekodeAgentSessionTarget {
  thoughtLevel?: string;
  expectedRevision?: number;
  persistAsWorkspaceLastUsed?: boolean;
}

export interface NekodeAgentSetModeParams extends NekodeAgentSessionTarget {
  mode: NekodeSessionMode;
  expectedRevision?: number;
}

export interface NekodeAgentGenerateWorkspaceTextParams extends NekodeAgentWorkspaceTarget {
  selection: NekodeWorkspaceGenerateTextParams["selection"];
  prompt?: string;
  messages?: NekodeWorkspaceGenerateTextParams["messages"];
  tools?: NekodeWorkspaceGenerateTextParams["tools"];
  querySource: string;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  /**
   * 协议层 RPC 超时。thinking 模型的长请求会超过协议 client 默认的
   * 3 分钟；调用方必须把自身 deadline 透传到这里，否则默认超时先触发、
   * 还会被 onRequestTimeout 误判 stale 杀进程。
   */
  requestTimeoutMs?: number;
}

export interface NekodeAgentTestModelConnectivityParams extends NekodeAgentWorkspaceTarget {
  selection: NekodeProviderTestModelConnectivityParams["selection"];
  signal?: AbortSignal;
}

// 合并时曾混用 Agent 完整鉴权响应；UI 只能回传请求校验，账号鉴权必须由 Host 合成。
export type ProviderRuntimeHeadersUiResponse =
  | { headersApplied: true; runtimeProviderHeaders: Record<string, string>; errorMessage?: string }
  | { headersApplied: false; errorMessage?: string };

export interface NekodeAgentRespondProviderRuntimeHeadersParams extends NekodeAgentSessionTarget {
  requestId: string;
  response: ProviderRuntimeHeadersUiResponse;
}

export interface NekodeAgentSessionRuntimePreferencesRequest extends NekodeSessionRequestRuntimePreferencesParams {
  requestId: string;
}

export interface NekodeAgentRespondSessionRuntimePreferencesParams {
  requestId: string;
  resolution:
    | { status: "resolved"; preferences: NekodeSessionRuntimePreferencesResult }
    | { status: "failed"; message: string };
}

export interface NekodeAgentSessionSubscribeParams extends NekodeAgentSessionTarget {
  deliveryKind: NekodeDeliveryKind;
  afterSeq?: number;
  includeSnapshot?: boolean;
  eventCoalescing?: {
    mode: "background-summary";
    intervalMs?: number;
  };
}

// ── v4 conversation 通道（竖切）──
// host 只做转发：subscribe/unsubscribe/command 透传给 CLI v4 gateway，
// v4/conversation/frame 通知按 workspace fan-out 给 renderer。

export interface NekodeAgentConversationSubscribeParams extends NekodeAgentSessionTarget {
  retryInitialization?: string;
  /** 水位不变量：仅当客户端真持有该时刻一致状态才允许带。 */
  base?: { logEpoch: string; seq: number };
  visibility?: "foreground" | "background";
}

export interface NekodeAgentConversationUnsubscribeParams extends NekodeAgentWorkspaceTarget {
  subscriptionId: string;
  runtimePolicy?: NekodeAgentRuntimePolicy;
}

export interface NekodeAgentConversationResyncParams extends NekodeAgentWorkspaceTarget {
  subscriptionId: string;
  base: { logEpoch: string; seq: number } | null;
  forceSnapshot?: boolean;
  runtimePolicy?: NekodeAgentRuntimePolicy;
}

/** 行分页 query（rows/range）：按游标向上取一窗历史行。 */
export interface NekodeAgentConversationRowsRangeParams extends NekodeAgentSessionTarget {
  /** 取 rowId < beforeRowId 的行；缺省 = 从当前尾部向前。 */
  beforeRowId?: number;
  /** 1..rowsRangeMaxLimit（200）。 */
  limit: number;
  /**
   * 手机预加载：只读热会话。工作区 CLI 未运行、执行端不支持、会话不在内存都报
   * proto.sessionNotResident，不拉起进程、不冷恢复。
   */
  residency?: "resident-only";
}

/** 当前有效分支里的终态 ExitPlanMode 目录。 */
export type NekodeAgentConversationPlansParams = NekodeAgentSessionTarget;

/** 手机远控输入预测（ghost hint）；线格式见 docs/web-remote-control/mobile-input-prediction.md。 */
export interface NekodeAgentConversationInputPredictionParams extends NekodeAgentSessionTarget {
  /** 手机当前看到的会话 revision；参与 CLI 侧缓存键，回包据此丢弃过期结果。 */
  revision: number;
  /** 当前草稿；缺省/空 = 预测下一条输入，非空 = 续写草稿。 */
  draft?: string;
  /** 手机侧请求 id，原样回声，用于丢弃过期回包。 */
  requestId?: string;
}

/** workflow run 的事件日志分页（详情页审计面）；cursor = journal sequence。 */
export interface NekodeAgentConversationWorkflowRunEventsParams extends NekodeAgentSessionTarget {
  runId: string;
  afterSequence?: number;
  limit?: number;
}

/** dwf run 的枚举（重启后的发现查询）。 */
export interface NekodeAgentConversationWorkflowRunsParams extends NekodeAgentSessionTarget {
  limit?: number;
}

// ── dwf 用户面产物──
// ⚠ 术语：artifact = 脚本经 `artifact.*` 发布给**用户**看的产出（文件 / markdown / 预置看板），
// 不是 run 的顶层返回值（引擎内部对后者的同名叫法）。

/** 产物清单；UI 冷恢复与中枢详情的 durable 读法。 */
export interface NekodeAgentConversationWorkflowRunArtifactsParams extends NekodeAgentSessionTarget {
  runId: string;
}

/** 预置看板的取数面；cursor = journal sequence（严格大于）。 */
export interface NekodeAgentConversationWorkflowRunArtifactDataParams extends NekodeAgentSessionTarget {
  runId: string;
  artifactId: string;
  afterSequence?: number;
  limit?: number;
}

/** 内容产物的字节，一次一块（≤ 512 KiB，形状逐字照 attachmentRead）。 */
export interface NekodeAgentConversationWorkflowRunArtifactReadParams extends NekodeAgentSessionTarget {
  runId: string;
  artifactId: string;
  version: number;
  offset: number;
  limit: number;
}

// ── dwf 工作区 transcript──
/** 轻行清单：一个 run 的 files.* / git.* / world.run 行，不带正文。 */
export interface NekodeAgentConversationWorkflowRunWorkspaceParams extends NekodeAgentSessionTarget {
  runId: string;
}

/** 一个工作区节点的正文，按 maxBytes 保形有界化（缺省与上限在 CLI 网关侧）。 */
export interface NekodeAgentConversationWorkflowRunNodeResultParams extends NekodeAgentSessionTarget {
  runId: string;
  siteId: string;
  ordinal: number;
  maxBytes?: number;
}

export interface NekodeAgentBackgroundBashOutputParams extends NekodeAgentSessionTarget {
  workId: string;
}

export interface NekodeAgentConversationFileChangesParams extends NekodeAgentSessionTarget {
  target: ConversationRowTarget;
  baseRevision: number;
  baseLogEpoch: string;
}

export interface NekodeAgentConversationFileRewindPreviewParams extends NekodeAgentSessionTarget {
  target: ConversationRowTarget;
  baseRevision: number;
  baseLogEpoch: string;
}

export interface NekodeAgentConversationCommandParams extends NekodeAgentWorkspaceTarget {
  /** 仅 Host 消费；显式 NULL 表示全局任务，不向 CLI 发送项目概念。 */
  projectId?: string | null;
  envelope: CommandEnvelope;
  /** 仅 host 内部用于 Browser Use runtime 边界，不进入 v4 wire envelope。 */
  clientMode?: NekodeTaskClientMode;
}

export interface NekodeAgentCommandsQueryParams extends NekodeAgentWorkspaceTarget {
  clock?: true;
  commands: CommandKey[];
}

/** UI 不携带 connectionId；connection scope 以 trusted carrier 注入 wire identity。 */
export interface NekodeAgentAttachmentBeginParams extends NekodeAgentSessionTarget {
  uploadId: string;
  fileName: string;
  mime: string;
  totalBytes: number;
  totalChunks: number;
  checksum: string;
}

export interface NekodeAgentAttachmentChunkParams extends NekodeAgentSessionTarget {
  uploadId: string;
  chunkIndex: number;
  dataBase64: string;
}

export interface NekodeAgentAttachmentTerminalParams extends NekodeAgentSessionTarget {
  uploadId: string;
}

export interface NekodeAgentAttachmentReadParams extends NekodeAgentSessionTarget {
  ref: string;
  target?: ConversationRowTarget;
  attachmentIndex?: number;
  offset: number;
  limit: number;
}

export interface NekodeAgentConversationAttachmentReadParams extends NekodeAgentSessionTarget {
  ref: string;
  target: ConversationRowTarget;
  attachmentIndex: number;
  offset: number;
  limit: number;
}

export interface NekodeAgentConversationAttachmentStatParams extends NekodeAgentSessionTarget {
  ref: string;
  target: ConversationRowTarget;
  attachmentIndex: number;
}

export interface NekodeAgentAttachmentPreviewSourceParams extends NekodeAgentSessionTarget {
  ref: string;
  target?: ConversationRowTarget;
  attachmentIndex?: number;
}

/** host scope 内部 transport 控制面；connectionId 只能经 trusted carrier 注入。 */
export interface NekodeAgentConnectionFlowParams extends NekodeAgentWorkspaceTarget {
  state: V4ConnectionFlowState;
}

/** sessions-index：workspace 级列表订阅（无 sessionId 维度）。 */
export interface NekodeAgentSessionsIndexSubscribeParams extends NekodeAgentWorkspaceTarget {
  base?: { logEpoch: string; seq: number };
  visibility?: "foreground" | "background";
  /**
   * 订阅者作用域后缀：CLI 侧重订阅替换按 (connectionId, topic) 判定，
   * host 进程内多个独立消费者（renderer 侧栏 / task-index syncer）订阅同一 topic 时
   * 必须用不同 connectionId，否则互相替换对方的订阅代际。缺省共享 host 连接 id。
   */
  subscriberScope?: string;
  /**
   * task-list 等被动观察者必须使用 existing-only；runtime 不存在时返回稳定 unavailable，
   * 禁止为了建立列表订阅而启动 Agent。缺省保持显式会话入口的旧行为。
   */
  runtimePolicy?: NekodeAgentRuntimePolicy;
}

/** workspace-config：workspace 级配置目录订阅（config options + slash 目录）。 */
export interface NekodeAgentWorkspaceConfigSubscribeParams extends NekodeAgentWorkspaceTarget {
  base?: { logEpoch: string; seq: number };
  visibility?: "foreground" | "background";
  subscriberScope?: string;
  runtimePolicy?: NekodeAgentRuntimePolicy;
}

/** Host 为 App 应答方绑定的本次配置；不扩展 Agent wire 协议。 */
export type NekodeAgentProviderRuntimeHeadersRequest = NekodeProviderRuntimeHeadersRequestParams & {
  requestVerificationConfig?: RequestVerificationConfig;
};

export type NekodeAgentServiceEvent =
  | { type: "session.event"; event: NekodeSessionEvent }
  | { type: "state.updated"; notification: NekodeStateUpdatedNotification }
  | { type: "permission.request"; request: NekodePermissionRequestParams }
  | { type: "userInput.request"; request: NekodeUserInputRequestParams }
  | {
      type: "userInput.response";
      requestId: string;
      response: NekodeUserInputResponse;
    }
  | { type: "providerRuntimeHeaders.request"; request: NekodeAgentProviderRuntimeHeadersRequest }
  | { type: "snapshot"; snapshot: NekodeSessionStateSnapshot };

export interface NekodeAgentAppRuntimePreferences {
  askUserQuestionAutoResolutionEnabled: boolean;
  modelIoFullRetentionEnabled?: boolean;
}

export interface NekodeAgentLocalRuntimeChildProcesses {
  pid: number;
  provider: string;
  workspacePath: string;
  lane?: string;
  children: NekodeProcessChildProcess[];
}

export interface NekodeAgentStorageStartupSnapshot {
  generation: number;
  state: NekodeStorageStartupState | null;
}

export interface INekodeAgentService {
  /** 控制面不需要账号或模型，且不发送普通协议请求。 */
  prepareStorage(params: NekodeAgentWorkspaceTarget): Promise<void>;
  getStorageStartupState(
    params: NekodeAgentWorkspaceTarget,
  ): Promise<NekodeAgentStorageStartupSnapshot | null>;
  onDynamicStorageStartupState(
    params: NekodeAgentWorkspaceTarget,
  ): Event<NekodeAgentStorageStartupSnapshot>;
  initialize(params: NekodeAgentWorkspaceTarget): Promise<NekodeAgentInitializeResult>;
  /**
   * 同步 App 全局运行时偏好到所有已活动 workspace；不得为此启动空闲 Agent。
   */
  syncAppRuntimePreferences(preferences: NekodeAgentAppRuntimePreferences): Promise<void>;
  /**
   * 动态工作流用户选择变化的信号（docs/dynamic-workflow/launch.md「The user's choice」）：Host 重新计算
   * 生效模式并串行重发 workspace/updateDynamicWorkflowPolicy。有本机设置权威的 Host 以设置文件为准；
   * desktop-attached remote Host 以传入值为准（缺席 = 跟随服务端）。不得为此启动空闲 Agent。
   */
  syncDynamicWorkflowUserMode(params: { mode?: DynamicWorkflowMode }): Promise<void>;
  getWorkspaceRuntimeIdentity(
    params: NekodeAgentWorkspaceTarget,
  ): Promise<NekodeAgentWorkspaceRuntimeIdentity>;
  createSession(params: NekodeAgentCreateSessionParams): Promise<NekodeSessionStateSnapshot>;
  resumeSession(params: NekodeAgentResumeSessionParams): Promise<NekodeSessionStateSnapshot>;
  listSessions(params: NekodeAgentListSessionsParams): Promise<NekodeSessionInfo[]>;
  listSessionSubagents(
    params: NekodeAgentListSessionSubagentsParams,
  ): Promise<NekodeSessionSubagentsResult>;
  getAppUsageStats(params: NekodeAgentAppUsageParams): Promise<AppUsageSnapshot>;
  /** 项目数据删除前的测量：只读，用本机已有 runtime 或管理面进程，不为某个项目拉起 Agent。 */
  measureSessionData?(params: V4SessionDataParams): Promise<V4SessionDataMeasureResult>;
  /**
   * 彻底删除会话与目录记忆。workspace 已有 Agent 进程时交给它（它持有会话运行态，能判断运行中
   * 并释放已加载会话）；否则交给管理面进程。只用于本机。
   */
  purgeSessionData?(
    params: V4SessionDataParams & { workspace: NekodeAgentWorkspaceTarget },
  ): Promise<V4SessionDataPurgeResult>;
  getTaskTokenUsage(params: NekodeAgentTaskTokenUsageParams): Promise<NekodeTaskTokenUsageResult>;
  readSession(params: NekodeAgentReadSessionParams): Promise<NekodeSessionStateSnapshot>;
  readSessionMessages(
    params: NekodeAgentReadSessionMessagesParams,
  ): Promise<NekodeMessageWithParts[]>;
  readSessionDebug(params: NekodeAgentSessionTarget): Promise<SessionDebugSnapshot>;
  readSessionEvents(params: NekodeAgentReadSessionEventsParams): Promise<NekodeSessionEvent[]>;
  readWorkspacePresentation(
    params: NekodeAgentReadWorkspacePresentationParams,
  ): Promise<NekodeWorkspacePresentation>;
  /** 无 task/session 的 Settings 预信任；Agent 会重新发现并校验 canonical snapshot。 */
  grantWorkspaceHookTrust(
    params: NekodeAgentGrantWorkspaceHookTrustParams,
  ): Promise<NekodeWorkspaceHookTrustGrantResult>;
  setWorkspaceMcpTrust(params: WorkspaceMcpTrustDecision): Promise<NekodeWorkspaceMcpTrustResult>;
  listMcpServerStatuses(params: NekodeAgentListMcpServerStatusesParams): Promise<NekodeMcpListResult>;
  listPlugins(params: NekodeAgentPluginViewParams): Promise<NekodePluginsListResult>;
  /**
   * Plugin 对话引用 catalog：session-scoped 只读投影。
   * 走 workspace 级 agent client（session 记录只存在于该进程），不走独立插件管理进程。
   */
  getPluginReferenceCatalog(
    params: NekodeAgentPluginReferenceCatalogParams,
  ): Promise<NekodePluginsReferenceCatalogResult>;
  /** Composer Skill 引用 catalog；带 sessionId 时读取该 runtime 的冻结快照。 */
  getSkillReferenceCatalog(
    params: NekodeAgentSkillReferenceCatalogParams,
  ): Promise<NekodeSkillsReferenceCatalogResult>;
  /** 插件 UI：读取插件 MCP 的 `ui://` 资源；走 session 所在 workspace agent 进程。 */
  openMcpUiInstance(
    params: import("../plugin-ui-bridge/contract.js").PluginUiPrepareSandboxParams & {
      accountContext?: string;
    },
  ): Promise<import("@zcode/shared/mcp-apps").McpAppInstance>;
  validateMcpUiInstance(
    params: import("../plugin-ui-bridge/contract.js").PluginUiPluginScope,
  ): Promise<void>;
  recycleMcpUiInstance(
    params: import("../plugin-ui-bridge/contract.js").PluginUiPluginScope,
  ): Promise<boolean>;
  closeMcpUiInstance(
    params: import("../plugin-ui-bridge/contract.js").PluginUiPluginScope,
  ): Promise<void>;
  readMcpResource(params: NekodeAgentReadMcpResourceParams): Promise<NekodeMcpReadResourceResult>;
  /** 插件 UI：UI 发起的工具调用；复用既有权限审批，不产生 transcript row。 */
  sampleMcpApp(
    params: import("../plugin-ui-bridge/samplingContract.js").PluginUiSamplingParams,
  ): Promise<import("@zcode/shared/mcp-apps").McpAppsSamplingResult>;
  cancelMcpAppSampling(
    params: import("../plugin-ui-bridge/samplingContract.js").PluginUiCancelSamplingParams,
  ): Promise<{ cancelled: boolean }>;
  callMcpToolForUi(params: NekodeAgentCallMcpToolForUiParams): Promise<NekodeMcpUiCallToolResult>;
  /** 插件 UI 取消带 callId 的进行中 UI 工具调用；agent 侧 abort 到 MCP client。 */
  cancelMcpToolCallForUi(
    params: NekodeAgentCancelMcpToolCallForUiParams,
  ): Promise<NekodeMcpUiCancelCallResult>;
  /** 插件 UI 页面发起的 `resources/read`，agent 侧限同插件服务器、8 MiB、mimeType 白名单。 */
  readMcpResourceForUi(
    params: NekodeAgentReadMcpResourceForUiParams,
  ): Promise<NekodeMcpUiReadResourceResult>;
  /** 插件 UI 页面发起的 resources/list、resources/templates/list、subscribe、unsubscribe 代理。 */
  listMcpResourcesForUi(
    params: NekodeAgentListMcpResourcesForUiParams,
  ): Promise<NekodeMcpUiListResourcesResult>;
  listMcpResourceTemplatesForUi(
    params: NekodeAgentListMcpResourcesForUiParams,
  ): Promise<NekodeMcpUiListResourceTemplatesResult>;
  subscribeMcpResourceForUi(params: NekodeAgentMcpResourceSubscriptionForUiParams): Promise<void>;
  unsubscribeMcpResourceForUi(params: NekodeAgentMcpResourceSubscriptionForUiParams): Promise<void>;
  /** App-Provided Tools：页面工具登记 / 注销与模型调用的认领 / 回传（信箱投递走 v4 live 增量）。 */
  registerAppToolsForUi(
    params: NekodeAgentRegisterAppToolsForUiParams,
  ): Promise<NekodeMcpUiRegisterAppToolsResult>;
  unregisterAppToolsForUi(
    params: NekodeAgentAppToolInstanceForUiParams,
  ): Promise<NekodeMcpUiUnregisterAppToolsResult>;
  claimAppToolCallForUi(
    params: NekodeAgentAppToolCallForUiParams,
  ): Promise<NekodeMcpUiAppToolAcceptedResult>;
  resolveAppToolCallForUi(
    params: NekodeAgentResolveAppToolCallForUiParams,
  ): Promise<NekodeMcpUiAppToolAcceptedResult>;
  /** 插件 UI 工作区级面板入口（已启用插件清单 `ui.surfaces[]`）。 */
  listPluginUiSurfaces(
    params: NekodeAgentWorkspaceTarget,
  ): Promise<NekodePluginsListUiSurfacesResult>;
  // 已保存工作流的 GUI 中枢：workspace 级、无会话，每次调用现扫 `<cwd>/.nekode/workflows/`。
  // 全局档传 `scope: "global"`：带 workspace 就用它当载体，不带则由 services 层自选本机载体运行时。
  listSavedWorkflows(params: NekodeAgentListSavedWorkflowsParams): Promise<NekodeWorkflowsListResult>;
  getSavedWorkflow(params: NekodeAgentGetSavedWorkflowParams): Promise<NekodeWorkflowsGetResult>;
  updateSavedWorkflowMeta(
    params: NekodeAgentUpdateSavedWorkflowMetaParams,
  ): Promise<NekodeWorkflowsUpdateMetaResult>;
  deleteSavedWorkflow(
    params: NekodeAgentDeleteSavedWorkflowParams,
  ): Promise<NekodeWorkflowsDeleteResult>;
  listSavedWorkflowRuns(
    params: NekodeAgentListSavedWorkflowRunsParams,
  ): Promise<NekodeWorkflowsRunsResult>;
  // 在项目档 / 全局档之间移动同名文件：
  // `workspace` 是载体（移到项目传目标项目、移到全局传源项目），`to` 是落点档；不覆盖已存在的目标。
  moveSavedWorkflow(params: NekodeAgentMoveSavedWorkflowParams): Promise<NekodeWorkflowsMoveResult>;
  // 完成卡的「直接保存」（docs/dynamic-workflow/transcript-and-notifications.md）：按 runId 从
  // journal 取这次 run 实际跑过的脚本落盘，不经模型回合。两者都必带 workspace（journal 在那里）。
  saveSavedWorkflowFromRun(
    params: NekodeAgentSaveSavedWorkflowFromRunParams,
  ): Promise<NekodeWorkflowsSaveResult>;
  /** 这次 run 对应哪个已保存工作流（推导，不记忆）；顺带回 run 的实参供「再次运行」预填。 */
  findSavedWorkflowForRun(
    params: NekodeAgentFindSavedWorkflowForRunParams,
  ): Promise<NekodeWorkflowsForRunResult>;
  resolveSuggestedPluginReference(
    params: NekodeAgentResolveSuggestedPluginReferenceParams,
  ): Promise<import("@zcode/shared").NekodePluginsResolveSuggestedReferenceResult>;
  /** 推荐项 Plugin 首次本地检查缺失后的 operation-scoped 刷新进度。 */
  onDynamicPluginOperationProgress(
    operationId: string,
  ): Event<NekodePluginOperationProgressNotification>;
  getPluginsOverview(params: NekodeAgentPluginViewParams): Promise<NekodePluginsOverviewResult>;
  /**
   * 资源管理器：枚举本 Host 内全部本地 Agent 进程（含 plugin / mcp-status 泳道），
   * 并向每个存活 runtime 请求 `process/childProcesses`；单个 runtime 失败只让它的 children 为空。
   */
  collectLocalRuntimeChildProcesses(
    signal?: AbortSignal,
  ): Promise<NekodeAgentLocalRuntimeChildProcesses[]>;
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
  // ---- 定时任务(automation)管理 ----
  listAutomations(params: NekodeAgentWorkspaceTarget): Promise<NekodeAutomation[]>;
  listAllAutomations(): Promise<NekodeAutomation[]>;
  createAutomation(params: NekodeAgentCreateAutomationParams): Promise<NekodeAutomation>;
  updateAutomation(params: NekodeAgentUpdateAutomationParams): Promise<NekodeAutomation | null>;
  deleteAutomation(params: NekodeAgentAutomationIdParams): Promise<void>;
  setAutomationEnabled(params: NekodeAgentSetAutomationEnabledParams): Promise<void>;
  restartAutomation(params: NekodeAgentAutomationIdParams): Promise<void>;
  runAutomationNow(params: NekodeAgentAutomationIdParams): Promise<NekodeAgentRunAutomationNowResult>;
  listAutomationRuns(params: NekodeAgentAutomationIdParams): Promise<NekodeAutomationRun[]>;
  deleteAutomationRun(params: NekodeAgentDeleteAutomationRunParams): Promise<void>;
  generateWorkspaceText(
    params: NekodeAgentGenerateWorkspaceTextParams,
  ): Promise<NekodeWorkspaceGenerateTextResult>;
  testModelConnectivity(
    params: NekodeAgentTestModelConnectivityParams,
  ): Promise<NekodeProviderTestModelConnectivityResult>;
  /**
   * @deprecated：send 主路径已收敛 v4 sendText 命令。仅剩两个消费点——
   * adapter 带附件输入回退（待附件命令面落地后移除）与 zcodeSessionService
   * pass-through；新代码禁止回用。
   */
  sendPrompt(params: NekodeAgentSendPromptParams): Promise<NekodeSessionSendResult>;
  compactSession(params: NekodeAgentCompactParams): Promise<NekodeSessionCompactResult>;
  goalSession(params: NekodeAgentGoalParams): Promise<NekodeSessionGoalResult>;
  closeSession(
    params: NekodeAgentSessionTarget & { expectedPersistence?: "deferred" | "immediate" },
  ): Promise<boolean>;
  setModel(params: NekodeAgentSetModelParams): Promise<NekodeSessionStateSnapshot>;
  setThoughtLevel(params: NekodeAgentSetThoughtLevelParams): Promise<NekodeSessionStateSnapshot>;
  setMode(params: NekodeAgentSetModeParams): Promise<NekodeSessionStateSnapshot>;
  respondProviderRuntimeHeaders(
    params: NekodeAgentRespondProviderRuntimeHeadersParams,
  ): Promise<void>;
  respondSessionRuntimePreferences(
    params: NekodeAgentRespondSessionRuntimePreferencesParams,
  ): Promise<void>;
  /**
   * v4 UI 的 Start Plan runtime-auth bridge 只需要本地 pending request 事件，
   * 不能为此额外打开旧 `session/subscribe`，否则会把旧 replay/continuous 读路径
   * 重新带回 v4 pane。
   */
  onDynamicProviderRuntimeHeadersRequest(
    params: NekodeAgentSessionTarget,
  ): Event<NekodeAgentProviderRuntimeHeadersRequest>;
  /**
   * Start Plan runtime headers 的 workspace 级订阅入口（生产应答方使用）。
   * Bug 原因（2026-08-16 web 远控卡死）：session 级入口只随桌面 pane 挂载订阅，
   * web 远控新建会话在桌面没有 pane、web 端无应答方，请求校验请求滞留 pending，
   * 任务永久「工作中」。桌面窗口用本入口为每个打开的 workspace tab 维持常驻应答方；
   * 订阅时先注册 live listener 再按 workspaceKey 前缀补投 pending，与 session 级同语义。
   */
  onDynamicWorkspaceProviderRuntimeHeadersRequest(
    params: NekodeAgentWorkspaceTarget,
  ): Event<NekodeAgentProviderRuntimeHeadersRequest>;
  /** 只投递本 workspace 的校验取消，不属于 conversation stream。 */
  onDynamicWorkspaceProviderRuntimeHeadersCancelled(
    params: NekodeAgentWorkspaceTarget,
  ): Event<NekodeProviderRuntimeHeadersCancelled>;
  onDynamicSessionRuntimePreferencesRequest(): Event<NekodeAgentSessionRuntimePreferencesRequest>;
  /**
   * CLI 进程级资源样本，带 services 打的 lane 标签（CLI 自己不知道 lane）。
   * 使用 dynamic event 避免 RPC 服务在无人订阅时缓冲周期事件；
   * 该事件不属于 session/conversation continuous 或 replayable 状态。
   */
  onDynamicProcessResourceSample(): Event<AgentLaneResourceSample>;
  /** MCP 进程生命周期与低频内存事件，仅供可信 Host relay 上报 ARMS。 */
  /** 仅 trusted Host relay 订阅；手机统计不依赖 renderer 生命周期。 */
  onDynamicRemoteConversationTelemetry(): Event<RemoteConversationTelemetryEvent>;

  onDynamicMcpTelemetry(): Event<NekodeMcpTelemetryEvent>;
  /** MCP 进程树资源事实，只供可信 Host 汇总上报。 */
  onDynamicMcpResourceSamples(): Event<NekodeMcpResourceSample[]>;
  /** Bash 完成事实，仅可信 Host 资源旁路订阅。 */
  onDynamicToolExecResource(): Event<NekodeToolExecResource>;
  /**
   * @deprecated 旧协议订阅面（session/subscribe + session/event + state.updated）。
   * task-index syncer 已迁 v4 sessions-index/workspace-config 帧；
   * 仅剩 zcodeTaskServiceAdapter.onDynamicTaskEvent（replayable 读路径）消费。
   * 写路径已收敛 v4 命令面；本订阅是读路径投影源。
   */
  onDynamicSessionEvent(params: NekodeAgentSessionSubscribeParams): Event<NekodeAgentServiceEvent>;
  // ── v4 conversation 通道（竖切）──
  /** RPC attachment 建立后先读取 host 可信 hello。 */
  helloConversationV4(): Promise<HelloMessage>;
  /** hello 校验后回送 clientHello；metadata 不能覆盖 connection mode/profile。 */
  initializeConversationV4(clientHello: ClientHello): Promise<void>;
  /** 仅供 trusted host relay/facade；terminal RPC caller 必须被 connection scope 拒绝。 */
  setConnectionFlowStateV4(params: NekodeAgentConnectionFlowParams): Promise<void>;
  subscribeConversationV4(
    params: NekodeAgentConversationSubscribeParams,
  ): Promise<V4ConversationSubscribeResult>;
  resyncConversationV4(
    params: NekodeAgentConversationResyncParams,
  ): Promise<V4ConversationResyncResult>;
  unsubscribeConversationV4(params: NekodeAgentConversationUnsubscribeParams): Promise<void>;
  /** rows/range 行分页 query（loadOlder 游标向上补历史）。 */
  conversationRowsRangeV4(
    params: NekodeAgentConversationRowsRangeParams,
  ): Promise<V4ConversationRowsRangeResult>;
  conversationPlansV4(
    params: NekodeAgentConversationPlansParams,
  ): Promise<V4ConversationPlansResult>;
  /** 输入预测：只读、无状态；Host 开关关闭 / 无运行时 / 失败一律回空结果，不抛错。 */
  conversationInputPredictionV4(
    params: NekodeAgentConversationInputPredictionParams,
  ): Promise<V4ConversationInputPredictionResult>;
  /** workflow run 事件日志分页；与 plans 同族（只读、无状态、超时重发安全）。 */
  conversationWorkflowRunEventsV4(
    params: NekodeAgentConversationWorkflowRunEventsParams,
  ): Promise<V4ConversationWorkflowRunEventsResult>;
  /** workflow run 枚举；journal-backed 的重启后发现面。 */
  conversationWorkflowRunsV4(
    params: NekodeAgentConversationWorkflowRunsParams,
  ): Promise<V4ConversationWorkflowRunsResult>;
  /** workflow run 的用户面产物清单；与 plans 同族（只读、无状态、超时重发安全）。 */
  conversationWorkflowRunArtifactsV4(
    params: NekodeAgentConversationWorkflowRunArtifactsParams,
  ): Promise<V4ConversationWorkflowRunArtifactsResult>;
  /** 预置看板的条目分页；hook 以 itemCount 变化为信号增量拉取。 */
  conversationWorkflowRunArtifactDataV4(
    params: NekodeAgentConversationWorkflowRunArtifactDataParams,
  ): Promise<V4ConversationWorkflowRunArtifactDataResult>;
  /** 内容产物的字节，一次一块；授权在 CLI 侧（journal 行才是取字节的依据）。 */
  conversationWorkflowRunArtifactReadV4(
    params: NekodeAgentConversationWorkflowRunArtifactReadParams,
  ): Promise<V4ConversationWorkflowRunArtifactReadResult>;
  /** dwf 工作区 transcript 的清单。 */
  conversationWorkflowRunWorkspaceV4(
    params: NekodeAgentConversationWorkflowRunWorkspaceParams,
  ): Promise<V4ConversationWorkflowRunWorkspaceResult>;
  /** 一个工作区节点的有界正文。 */
  conversationWorkflowRunNodeResultV4(
    params: NekodeAgentConversationWorkflowRunNodeResultParams,
  ): Promise<V4ConversationWorkflowRunNodeResultResult>;
  backgroundBashOutputV4(
    params: NekodeAgentBackgroundBashOutputParams,
  ): Promise<BackgroundBashOutputResult>;
  conversationFileChangesV4(
    params: NekodeAgentConversationFileChangesParams,
  ): Promise<V4ConversationFileChangesResult>;
  conversationFileRewindPreviewV4(
    params: NekodeAgentConversationFileRewindPreviewParams,
  ): Promise<V4ConversationFileRewindPreviewResult>;
  sendConversationCommandV4(params: NekodeAgentConversationCommandParams): Promise<CommandAck>;
  queryConversationCommandsV4(params: NekodeAgentCommandsQueryParams): Promise<CommandsQueryResult>;
  attachmentBeginV4(params: NekodeAgentAttachmentBeginParams): Promise<V4AttachmentBeginResult>;
  attachmentChunkV4(params: NekodeAgentAttachmentChunkParams): Promise<V4AttachmentChunkResult>;
  attachmentCommitV4(params: NekodeAgentAttachmentTerminalParams): Promise<V4AttachmentCommitResult>;
  attachmentAbortV4(params: NekodeAgentAttachmentTerminalParams): Promise<void>;
  /** Desktop local 已发送视频 source query；远端与 Web 返回 chunked。 */
  attachmentPreviewSourceV4(
    params: NekodeAgentAttachmentPreviewSourceParams,
  ): Promise<V4AttachmentPreviewSourceResult>;
  /** 已发送 image/video 只读分块查询；connection scope 注入可信 workspace 连接。 */
  attachmentReadV4(params: NekodeAgentAttachmentReadParams): Promise<V4AttachmentReadResult>;
  /** Share 读取 userInput 附件，允许 text/plain 等非媒体类型。 */
  conversationAttachmentReadV4(
    params: NekodeAgentConversationAttachmentReadParams,
  ): Promise<V4ConversationAttachmentReadResult>;
  /** Share 选择阶段只读 userInput 附件元数据，不读取完整内容。 */
  conversationAttachmentStatV4(
    params: NekodeAgentConversationAttachmentStatParams,
  ): Promise<V4ConversationAttachmentStatResult>;
  getSessionLifecycle(
    params: NekodeAgentSessionTarget,
  ): Promise<import("@zcode/shared").SessionLifecycleSnapshot | null>;
  ensureSessionReady(params: NekodeAgentSessionTarget): Promise<void>;
  stopSessionRuntime(params: NekodeAgentSessionTarget): Promise<void>;
  restartSessionRuntime(params: NekodeAgentSessionTarget): Promise<void>;
  /** 独立于可被释放的 conversation publisher 的生命周期事实。 */
  onDynamicSessionLifecycle(
    params: NekodeAgentWorkspaceTarget,
  ): Event<import("@zcode/shared").SessionLifecycleSnapshot>;
  /** workspace 级下行帧流（v4/conversation/frame），renderer 侧按 topic 自行路由。 */
  onDynamicConversationFrame(
    params: NekodeAgentWorkspaceTarget,
  ): Event<ConversationTopicWireCandidate>;
  /** workspace 级 live telemetry 事实；connection facade 仅向可信 desktop-continuous 下游暴露。 */
  onDynamicLocalTtftFacts(
    params: NekodeAgentWorkspaceTarget,
  ): Event<import("@zcode/shared").LocalTtftFacts>;
  onDynamicConversationTelemetryFact(
    params: NekodeAgentWorkspaceTarget,
  ): Event<ConversationTelemetryFact>;
  /** Host 消费驻留 CLI 的闲时生命周期；不参与聊天快照恢复。 */
  onDynamicOffPeakLifecycle(
    params: NekodeAgentWorkspaceTarget,
  ): Event<import("@zcode/shared").OffPeakLifecycleNotification>;
  controlOffPeakExecutionV4(
    params: NekodeAgentWorkspaceTarget & { control: import("@zcode/shared").OffPeakControlParams },
  ): Promise<import("@zcode/shared").OffPeakControlResult>;
  /** 当前窗口全部本地 live task 的 CUA 权限观察；历史、远程与 replayable 不在此事件面。 */
  onDynamicCuaPermissionObservation(): Event<NekodeAgentCuaPermissionObservation>;
  /** 本地桌面窗口创建插件页面，不依赖 conversation 订阅。 */
  onDynamicPluginUiToolResult(): Event<
    PluginUiToolResultNotification & { workspacePath: string; workspaceIdentity?: string }
  >;
  /** 只读 CLI 持久事实；不恢复会话运行实例。旧远端可以不提供此能力。 */
  reconcileSessionsIndexV4?(
    params: NekodeAgentWorkspaceTarget & { sessionIds: string[] },
  ): Promise<SessionsIndexReconcileResult>;
  // ── M5 sessions-index 通道（列表活性）──
  subscribeSessionsIndexV4(
    params: NekodeAgentSessionsIndexSubscribeParams,
  ): Promise<V4SessionsIndexSubscribeResult>;
  resyncSessionsIndexV4(
    params: NekodeAgentConversationResyncParams,
  ): Promise<V4ConversationResyncResult>;
  unsubscribeSessionsIndexV4(params: NekodeAgentConversationUnsubscribeParams): Promise<void>;
  /** workspace 级 sessions-index 下行帧流（与 conversation 同一通知，按 topic 前缀分流）。 */
  onDynamicSessionsIndexFrame(
    params: NekodeAgentWorkspaceTarget,
  ): Event<SessionsIndexTopicWireCandidate>;
  // ── workspace-config 通道（配置目录活性；task-index syncer 消费）──
  subscribeWorkspaceConfigV4(
    params: NekodeAgentWorkspaceConfigSubscribeParams,
  ): Promise<V4WorkspaceConfigSubscribeResult>;
  resyncWorkspaceConfigV4(
    params: NekodeAgentConversationResyncParams,
  ): Promise<V4ConversationResyncResult>;
  unsubscribeWorkspaceConfigV4(params: NekodeAgentConversationUnsubscribeParams): Promise<void>;
  /** workspace 级 workspace-config 下行帧流（与 conversation 同一通知，按 topic 前缀分流）。 */
  onDynamicWorkspaceConfigFrame(
    params: NekodeAgentWorkspaceTarget,
  ): Event<WorkspaceConfigTopicWireCandidate>;
  /**
   * （CLI 重连重订）：agent 进程换代通知（超时回收/崩溃后重新拉起）。
   * v4 订阅活在 CLI 进程内存，进程换代即失效；订阅方（task-index syncer 等）
   * 收到后必须对该 workspaceKey 重发 subscribe，否则帧流静默中断。
   */
  onAgentRuntimeRestarted(listener: (event: { workspaceKey: string }) => void): IDisposable;
  /**
   * Agent client 在 service 内完成登记后发布 available，当前 client 关闭后发布 unavailable。
   * 这是被动 observer attach/detach 的唯一生命周期信号，不表达用户使用租约。
   */
  onAgentRuntimeLifecycle?: (
    listener: (event: NekodeAgentRuntimeLifecycleEvent) => void,
  ) => IDisposable;
  /** 当前 desktop-local CUA turn 是否仍在执行，用于 Helper recovery 避免中途回收 Agent。 */
  hasActiveCuaOperationTurn(): boolean;
  disposeWorkspace(
    params: NekodeAgentWorkspaceTarget & { releasePreparation?: boolean },
  ): Promise<void>;
  disposeAll(): void;
}

export const INekodeAgentService = createServiceDescriptor<INekodeAgentService>(
  ServiceChannels.NekodeAgent,
);
