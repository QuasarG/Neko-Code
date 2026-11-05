import type { OAuthProviderId } from "@zcode/shared";

interface OAuthProviderLogoutDependencies {
  readonly accountProviderCredentialStore?: { deleteApiKey(key: string): Promise<void> };
  readonly refreshAccountProviders?: (reason: string) => Promise<unknown>;
}

/**
 * 账号登出的派生清理入口。
 *
 * 账号登录已下线：这里不再删除任何派生 Coding Plan API Key，也不再触发账号 Provider
 * 刷新（避免任何账号后端的连带请求）。函数签名保持不变，既有装配可以继续调用。
 */
export function createOAuthProviderLogoutHandler(
  _dependencies: OAuthProviderLogoutDependencies,
): (provider: OAuthProviderId, accountIdentity?: string | null) => Promise<void> {
  return async () => {};
}
