import { Emitter } from "@zcode/rpc";
import type {
  OAuthCachedSessionRestoreResult,
  OAuthCallbackResult,
  OAuthProviderId,
  OAuthProviderMeta,
  OAuthSessionState,
  OAuthStartResponse,
  UserInfo,
} from "@zcode/shared";
import type { ICredentialService } from "../credential/credential.js";
import type { IOAuthService } from "./oauth.js";

/**
 * 账号登录在本构建中不可用。
 *
 * 这里保留 `IOAuthService` 的完整形状，是为了让 UI / 其他包继续按原接口编译和调用；
 * 但所有实现都是惰性的：不生成 state、不打开浏览器、不请求 z.ai / bigmodel 的
 * authorize / token / userinfo 端点，也不安排任何 token 刷新定时器。
 */
export const ACCOUNT_LOGIN_UNAVAILABLE_MESSAGE =
  "Account login is not available in this build. Configure a provider API key instead.";

interface OAuthServiceDependencies {
  /** 账号登录已下线；保留字段仅为兼容既有装配。 */
  apiClient?: unknown;
  now?: () => number;
  env?: NodeJS.ProcessEnv;
  onProviderLogout?:
    | ((provider: OAuthProviderId, accountIdentity?: string | null) => Promise<void>)
    | null;
}

export class OAuthService implements IOAuthService {
  // 从不触发：账号会话不会再变化，订阅方保持挂载即可。
  private readonly sessionChanges = new Emitter<OAuthSessionState>();
  readonly onDidChangeSession = this.sessionChanges.event;

  constructor(_credentialService: ICredentialService, _dependencies: OAuthServiceDependencies = {}) {}

  async getProviders(): Promise<OAuthProviderMeta[]> {
    return [];
  }

  async getActiveProvider(): Promise<OAuthProviderId | null> {
    return null;
  }

  async restoreCachedSession(): Promise<UserInfo | null> {
    return null;
  }

  async restoreCachedSessionState(): Promise<OAuthCachedSessionRestoreResult> {
    return { status: "signed-out" };
  }

  async restoreSession(): Promise<UserInfo | null> {
    return null;
  }

  async startOAuth(_provider: OAuthProviderId): Promise<OAuthStartResponse> {
    throw new Error(ACCOUNT_LOGIN_UNAVAILABLE_MESSAGE);
  }

  async startOAuthWithPolling(_provider: OAuthProviderId): Promise<OAuthStartResponse> {
    throw new Error(ACCOUNT_LOGIN_UNAVAILABLE_MESSAGE);
  }

  async pollPendingOAuth(): Promise<OAuthCallbackResult | null> {
    return null;
  }

  async handleCallback(_url: string): Promise<OAuthCallbackResult | null> {
    return null;
  }

  async refreshToken(_provider?: OAuthProviderId): Promise<void> {}

  async logout(_provider?: OAuthProviderId): Promise<void> {}

  async logoutAll(): Promise<void> {}

  async cancelPending(_provider?: OAuthProviderId): Promise<void> {}
}

/**
 * 工厂函数：创建惰性的 OAuthService 实例
 */
export function createOAuthService(
  credentialService: ICredentialService,
  dependencies: OAuthServiceDependencies = {},
): OAuthService {
  return new OAuthService(credentialService, dependencies);
}
