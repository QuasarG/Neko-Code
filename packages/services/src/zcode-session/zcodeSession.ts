import { ServiceChannels } from "@zcode/shared";
import type {
  TraceId,
  NekodeAgentMcpServer,
  NekodeDeliveryKind,
  NekodeMessageWithParts,
  ModelSelection,
  NekodePermissionRequestParams,
  NekodeProviderRuntimeHeadersRequestParams,
  NekodeUserInputRequestParams,
  NekodeUserInputResponse,
  NekodeSessionInfo,
  NekodeSessionImportHistory,
  NekodeSessionEvent,
  NekodeSessionMode,
  NekodeSessionPersistence,
  NekodeSessionStateSnapshot,
  NekodeStateUpdatedNotification,
  NekodeWorkspacePresentation,
} from "@zcode/shared";
import { createServiceDescriptor } from "#src/descriptors.js";
import type { ProviderRuntimeHeadersUiResponse } from "#src/zcode-agent/zcodeAgent.js";

export interface NekodeSessionWorkspaceTarget {
  workspacePath: string;
  workspaceIdentity?: string;
  remoteSessionId?: string;
}

export type NekodeSessionReadWorkspacePresentationParams = NekodeSessionWorkspaceTarget;

export interface NekodeTaskTarget extends NekodeSessionWorkspaceTarget {
  sessionId: string;
}

export interface NekodeSessionCreateParams extends NekodeSessionWorkspaceTarget {
  /** 仅导入事务使用的预分配 ID；普通新会话继续由 Agent 分配。 */
  sessionId?: string;
  sessionTraceId?: TraceId;
  parentSessionId?: string;
  mode?: NekodeSessionMode;
  model?: ModelSelection;
  persistence?: NekodeSessionPersistence;
  thoughtLevel?: string;
  mcpServers?: NekodeAgentMcpServer[];
  importedHistory?: NekodeSessionImportHistory;
}

export interface NekodeSessionResumeParams extends NekodeTaskTarget {
  model?: ModelSelection;
  thoughtLevel?: string;
  mcpServers?: NekodeAgentMcpServer[];
  /**
   * 默认广播 resume 得到的历史快照，并让 shadow 订阅请求初始 snapshot。
   * 续聊发送前的 runtime 预恢复会关闭它，避免旧终态快照覆盖本地已开始的新输入运行态。
   */
  broadcastSnapshot?: boolean;
}

export interface NekodeSessionListParams extends NekodeSessionWorkspaceTarget {
  limit?: number;
}

export interface NekodeSessionReadParams extends NekodeTaskTarget {
  deliveryKind?: NekodeDeliveryKind;
  messageLimit?: number;
  afterSeq?: number;
}

export interface NekodeSessionMessagesParams extends NekodeTaskTarget {
  afterMessageId?: string;
  limit?: number;
}

export interface NekodeSessionEventsParams extends NekodeTaskTarget {
  afterSeq?: number;
  limit?: number;
}

export interface NekodeSessionSetModelParams extends NekodeTaskTarget {
  model: ModelSelection;
  expectedRevision?: number;
  persistAsWorkspaceLastUsed?: boolean;
}

export interface NekodeSessionSetThoughtLevelParams extends NekodeTaskTarget {
  thoughtLevel?: string;
  expectedRevision?: number;
  persistAsWorkspaceLastUsed?: boolean;
}

export interface NekodeSessionSetModeParams extends NekodeTaskTarget {
  mode: NekodeSessionMode;
  expectedRevision?: number;
}

export interface NekodeSessionRespondProviderRuntimeHeadersParams extends NekodeTaskTarget {
  requestId: string;
  response: ProviderRuntimeHeadersUiResponse;
}

export interface NekodeSessionSubscribeParams extends NekodeTaskTarget {
  deliveryKind: NekodeDeliveryKind;
  afterSeq?: number;
  includeSnapshot?: boolean;
  eventCoalescing?: {
    mode: "background-summary";
    intervalMs?: number;
  };
}

export type NekodeSessionServiceEvent =
  | { type: "session.event"; event: NekodeSessionEvent }
  | { type: "state.updated"; notification: NekodeStateUpdatedNotification }
  | { type: "permission.request"; request: NekodePermissionRequestParams }
  | { type: "userInput.request"; request: NekodeUserInputRequestParams }
  | {
      type: "userInput.response";
      requestId: string;
      response: NekodeUserInputResponse;
    }
  | { type: "providerRuntimeHeaders.request"; request: NekodeProviderRuntimeHeadersRequestParams }
  | { type: "snapshot"; snapshot: NekodeSessionStateSnapshot };

export interface NekodeSessionInitializeResult {
  available: boolean;
  workspaceKey: string;
  protocolName?: string;
  protocolVersion?: number;
  transportKind?: "stdio" | "websocket";
  reason?: string;
  reasonCode?: "provider_not_ready";
}

export interface NekodeSessionWorkspaceRuntimeIdentity {
  generation: number;
  identity: string;
  processId?: number;
  workspaceKey: string;
}

export interface INekodeSessionService {
  initializeWorkspace(params: NekodeSessionWorkspaceTarget): Promise<NekodeSessionInitializeResult>;
  getWorkspaceRuntimeIdentity(
    params: NekodeSessionWorkspaceTarget,
  ): Promise<NekodeSessionWorkspaceRuntimeIdentity>;
  readWorkspacePresentation(
    params: NekodeSessionReadWorkspacePresentationParams,
  ): Promise<NekodeWorkspacePresentation>;
  createSession(params: NekodeSessionCreateParams): Promise<NekodeSessionStateSnapshot>;
  resumeSession(params: NekodeSessionResumeParams): Promise<NekodeSessionStateSnapshot>;
  listSessions(params: NekodeSessionListParams): Promise<NekodeSessionInfo[]>;
  readSession(params: NekodeSessionReadParams): Promise<NekodeSessionStateSnapshot>;
  readSessionMessages(params: NekodeSessionMessagesParams): Promise<NekodeMessageWithParts[]>;
  readSessionEvents(params: NekodeSessionEventsParams): Promise<NekodeSessionEvent[]>;
  promoteDeferredDraftSession(params: NekodeTaskTarget): Promise<void>;
  closeSession(params: NekodeTaskTarget): Promise<void>;
  closeDeferredDraftSession(params: NekodeTaskTarget): Promise<boolean>;
  setModel(params: NekodeSessionSetModelParams): Promise<NekodeSessionStateSnapshot>;
  setThoughtLevel(params: NekodeSessionSetThoughtLevelParams): Promise<NekodeSessionStateSnapshot>;
  setMode(params: NekodeSessionSetModeParams): Promise<NekodeSessionStateSnapshot>;
  respondProviderRuntimeHeaders(
    params: NekodeSessionRespondProviderRuntimeHeadersParams,
  ): Promise<void>;
  // M5 删波次 2：onDynamicSessionEvent（旧 session/subscribe 词表的 renderer 订阅面）
  // 已删除——v4 UI 走 agentService 的 conversation/sessions-index 帧通道，
  // 该方法在 renderer 侧已无任何调用者（grep packages/ui packages/desktop 为零）。
}

export const INekodeSessionService = createServiceDescriptor<INekodeSessionService>(
  ServiceChannels.NekodeSession,
);
