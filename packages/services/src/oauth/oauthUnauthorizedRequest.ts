/**
 * 账号登录下线后，这里不再判定任何请求是否属于当前账号凭据。
 *
 * 保留同名导出是为了让 Host 装配（ApiClient 的 401 分类、JWT 失效广播）继续按原
 * 形状接线；所有判定都返回 false / null，调用方因此永远不会触发账号登出、
 * 凭据清理或派生 provider 刷新。
 */

interface OAuthCredentialRequestOptions {
  input: string | URL;
  headers: Headers;
  credentialService: { load(key: string): Promise<string | null> };
  env?: NodeJS.ProcessEnv;
  provider?: string | null;
}

export async function isOAuthBusinessRequest(
  _options: OAuthCredentialRequestOptions,
): Promise<boolean> {
  return false;
}

/** Host 私有的只读身份核验材料；账号登录下线后不再提供。 */
export async function resolveOAuthBusinessCredentialValidationRequest(
  _options: OAuthCredentialRequestOptions,
): Promise<{ url: string; authorization: string; emptyBodyMeansInvalid: boolean } | null> {
  return null;
}

export async function isCurrentOAuthCredentialRequest(
  _options: OAuthCredentialRequestOptions,
): Promise<boolean> {
  return false;
}
