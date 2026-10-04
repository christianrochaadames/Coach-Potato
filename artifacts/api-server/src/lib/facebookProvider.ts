import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const GRAPH_VERSION = "v23.0";
const GRAPH_ORIGIN = "https://graph.facebook.com";
const ID_PATTERN = /^[0-9]{1,32}$/;

export type FacebookConfig = { appId: string; appSecret: string; redirectUri: string };
export class FacebookProviderError extends Error {
  constructor(message: string, readonly phase?: string, readonly providerCode?: number, readonly providerSubcode?: number) {
    super(message);
  }
}

function configuredRedirectUri(): string | null {
  try {
    const uri = new URL(process.env.FACEBOOK_REDIRECT_URI ?? "");
    return uri.protocol === "https:" && uri.pathname === "/api/facebook/callback" && !uri.search && !uri.hash
      ? uri.toString() : null;
  } catch {
    return null;
  }
}

export function getFacebookConfig(): FacebookConfig | null {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = configuredRedirectUri();
  return appId && ID_PATTERN.test(appId) && appSecret && redirectUri
    ? { appId, appSecret, redirectUri } : null;
}

export function getFacebookInviteUrl(): string | null {
  const redirectUri = configuredRedirectUri();
  return redirectUri ? `${new URL(redirectUri).origin}/` : null;
}

export function hashFacebookState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

export function facebookAuthorizationUrl(config: FacebookConfig, state: string): string {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.search = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    state,
    response_type: "code",
    scope: "public_profile,user_friends",
    auth_type: "rerequest",
  }).toString();
  return url.toString();
}

async function graphJson(
  path: string,
  params: Record<string, string>,
  fetcher: typeof fetch,
  token?: string,
): Promise<Record<string, unknown>> {
  const url = new URL(`${GRAPH_ORIGIN}/${GRAPH_VERSION}/${path}`);
  url.search = new URLSearchParams(params).toString();
  try {
    const response = await fetcher(url, {
      signal: AbortSignal.timeout(12_000),
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const body = await response.json() as Record<string, unknown>;
    if (!response.ok || !body || typeof body !== "object" || body.error) {
      const detail = body?.error as Record<string, unknown> | undefined;
      const code = typeof detail?.code === "number" ? detail.code : undefined;
      const subcode = typeof detail?.error_subcode === "number" ? detail.error_subcode : undefined;
      // Inspect only to classify a setup problem. Never return or log Meta's raw message.
      const credentialsRejected = typeof detail?.message === "string"
        && /(?:invalid|validating|incorrect|rejected).*(?:client secret|app secret)|(?:client secret|app secret).*(?:invalid|incorrect|rejected)/i.test(detail.message);
      const message = code === 10 || code === 200
        ? "Facebook friends access is not available for Spud yet. You can still search for buddies by name."
        : credentialsRejected
          ? "Spud's Facebook app credentials were rejected. The app owner needs to update the published backend before Facebook can connect. You can still search for buddies by name."
          : code === 191
            ? "Spud's Facebook callback address is not approved by Facebook. The app owner needs to check the Facebook Login settings. You can still search for buddies by name."
            : "Facebook authorisation could not be completed. Please try connecting again.";
      throw new FacebookProviderError(message, path, code, subcode);
    }
    return body;
  } catch (error) {
    if (error instanceof FacebookProviderError) throw error;
    // Never attach provider errors, URLs, tokens, or personal data to an error/log.
    throw new FacebookProviderError("Facebook is temporarily unavailable. Please try again.");
  }
}

export async function fetchFacebookIdentity(
  code: string,
  config: FacebookConfig,
  fetcher: typeof fetch = fetch,
): Promise<{ facebookId: string; friendIds: string[] }> {
  const tokenResult = await graphJson("oauth/access_token", {
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.redirectUri,
    code,
  }, fetcher);
  if (typeof tokenResult.access_token !== "string" || !tokenResult.access_token) {
    throw new FacebookProviderError("Facebook authorisation could not be completed. Please reconnect.");
  }
  const token = tokenResult.access_token;
  const permissions = await graphJson("me/permissions", {}, fetcher, token);
  if (!Array.isArray(permissions.data) || !permissions.data.some((permission) =>
    typeof permission === "object" && permission !== null
    && "permission" in permission && permission.permission === "user_friends"
    && "status" in permission && permission.status === "granted")) {
    throw new FacebookProviderError("Allow Facebook friends access to find friends on Spud. You can still search by name or username.");
  }
  const identity = await graphJson("me", { fields: "id" }, fetcher, token);
  if (typeof identity.id !== "string" || !ID_PATTERN.test(identity.id)) {
    throw new FacebookProviderError("Facebook returned an invalid identity. Please reconnect.");
  }
  const friendIds = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const result = await graphJson("me/friends", {
      fields: "id",
      limit: "500",
      ...(cursor ? { after: cursor } : {}),
    }, fetcher, token);
    if (!Array.isArray(result.data)) throw new FacebookProviderError("Facebook friends could not be loaded. Please try again.");
    for (const friend of result.data) {
      if (!friend || typeof friend !== "object" || !("id" in friend)
        || typeof friend.id !== "string" || !ID_PATTERN.test(friend.id)) {
        throw new FacebookProviderError("Facebook friends could not be loaded. Please try again.");
      }
      friendIds.add(friend.id);
    }
    const paging = result.paging as { next?: unknown; cursors?: { after?: unknown } } | undefined;
    if (!paging?.next) return { facebookId: identity.id, friendIds: [...friendIds] };
    if (typeof paging.cursors?.after !== "string" || paging.cursors.after.length > 4096
      || cursors.has(paging.cursors.after)) {
      throw new FacebookProviderError("Facebook friends could not be loaded. Please try again.");
    }
    // Only reuse the cursor on a fixed Graph endpoint; never follow an arbitrary URL.
    cursor = paging.cursors.after;
    cursors.add(cursor);
  }
  throw new FacebookProviderError("Facebook returned too many pages of friends. Please try again.");
}

export function verifyFacebookSignedRequest(signedRequest: string, secret: string): string | null {
  try {
    const parts = signedRequest.split(".");
    if (parts.length !== 2) return null;
    const [signaturePart, payloadPart] = parts;
    const signature = Buffer.from(signaturePart, "base64url");
    const expected = createHmac("sha256", secret).update(payloadPart).digest();
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    if (payload.algorithm !== "HMAC-SHA256" || typeof payload.user_id !== "string"
      || !ID_PATTERN.test(payload.user_id) || typeof payload.issued_at !== "number"
      || payload.issued_at > Date.now() / 1000 + 300
      || Date.now() / 1000 - payload.issued_at > 86_400) return null;
    return payload.user_id;
  } catch {
    return null;
  }
}