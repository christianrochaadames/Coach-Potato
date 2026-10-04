import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { FacebookProviderError, facebookAuthorizationUrl, fetchFacebookIdentity, hashFacebookState, verifyFacebookSignedRequest } from "./facebookProvider";

const config = { appId: "12345", appSecret: "fake-test-secret", redirectUri: "https://example.test/api/facebook/callback" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

test("Facebook failures preserve only safe provider diagnostics", async () => {
  const fetcher: typeof fetch = async () => json({
    error: { code: 190, error_subcode: 123, message: "private token and provider details" },
  }, 400);
  await assert.rejects(fetchFacebookIdentity("fake-code", config, fetcher), error => {
    assert.ok(error instanceof FacebookProviderError);
    assert.equal(error.phase, "oauth/access_token");
    assert.equal(error.providerCode, 190);
    assert.equal(error.providerSubcode, 123);
    assert.ok(!error.message.includes("private token"));
    return true;
  });
});

test("Unavailable Facebook permissions explain that name search still works", async () => {
  const fetcher: typeof fetch = async () => json({ error: { code: 10 } }, 403);
  await assert.rejects(fetchFacebookIdentity("fake-code", config, fetcher),
    /Facebook friends access is not available for Spud yet/);
});

test("Rejected app secrets explain the publishing requirement without exposing Meta's message", async () => {
  const fetcher: typeof fetch = async () => json({
    error: { code: 1, message: "Error validating client secret. private-secret-value" },
  }, 400);
  await assert.rejects(fetchFacebookIdentity("fake-code", config, fetcher), error => {
    assert.ok(error instanceof FacebookProviderError);
    assert.match(error.message, /app credentials were rejected/);
    assert.match(error.message, /published backend/);
    assert.ok(!error.message.includes("private-secret-value"));
    return true;
  });
});

test("Unapproved callback addresses have a specific safe explanation", async () => {
  const fetcher: typeof fetch = async () => json({ error: { code: 191 } }, 400);
  await assert.rejects(fetchFacebookIdentity("fake-code", config, fetcher), /callback address is not approved/);
});

test("Generic Facebook failures use Australian spelling and do not guess their cause", async () => {
  const fetcher: typeof fetch = async () => json({ error: { code: 1, message: "Other private provider details" } }, 400);
  await assert.rejects(fetchFacebookIdentity("fake-code", config, fetcher), error => {
    assert.ok(error instanceof FacebookProviderError);
    assert.match(error.message, /Facebook authorisation could not be completed/);
    assert.ok(!error.message.includes("credentials"));
    return true;
  });
});

test("Facebook authorisation includes a hashed-state-compatible nonce and the exact consent scopes", () => {
  const url = new URL(facebookAuthorizationUrl(config, "state-for-test"));
  assert.equal(url.hostname, "www.facebook.com");
  assert.equal(url.searchParams.get("state"), "state-for-test");
  assert.equal(url.searchParams.get("redirect_uri"), config.redirectUri);
  assert.equal(url.searchParams.get("scope"), "public_profile,user_friends");
  assert.equal(url.searchParams.has("client_secret"), false);
  assert.equal(hashFacebookState("state-for-test").length, 64);
  assert.notEqual(hashFacebookState("state-for-test"), "state-for-test");
});

test("Graph discovery verifies permission, deduplicates, and never follows paging URLs", async () => {
  let pages = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "graph.facebook.com");
    if (url.pathname.endsWith("/oauth/access_token")) return json({ access_token: "ephemeral-test-token" });
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer ephemeral-test-token");
    assert.equal(url.searchParams.has("access_token"), false);
    if (url.pathname.endsWith("/permissions")) return json({ data: [{ permission: "user_friends", status: "granted" }] });
    if (url.pathname.endsWith("/me")) return json({ id: "100" });
    pages++;
    return pages === 1 ? json({ data: [{ id: "200" }], paging: { next: "https://untrusted.invalid/steal", cursors: { after: "cursor-one" } } })
      : json({ data: [{ id: "200" }, { id: "300" }] });
  };
  assert.deepEqual(await fetchFacebookIdentity("fake-code", config, fetcher), { facebookId: "100", friendIds: ["200", "300"] });
  assert.equal(pages, 2);
});

test("Declined friends permission fails explicitly without fetching identity or friends", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return calls === 1 ? json({ access_token: "ephemeral-test-token" })
      : json({ data: [{ permission: "user_friends", status: "declined" }] });
  };
  await assert.rejects(fetchFacebookIdentity("fake-code", config, fetcher), /Allow Facebook friends access/);
  assert.equal(calls, 2);
});

test("Provider failures never include raw credentials, URLs, or provider error text", async () => {
  const fetcher: typeof fetch = async () => { throw new Error("secret token https://graph.facebook.com"); };
  await assert.rejects(fetchFacebookIdentity("fake-code", config, fetcher), error =>
    error instanceof Error && error.message === "Facebook is temporarily unavailable. Please try again.");
});

test("Deauthorisation requires a valid recent Meta signature", () => {
  const make = (issued_at: number, secret = config.appSecret) => {
    const payload = Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "100", issued_at })).toString("base64url");
    return `${createHmac("sha256", secret).update(payload).digest("base64url")}.${payload}`;
  };
  const now = Math.floor(Date.now() / 1000);
  assert.equal(verifyFacebookSignedRequest(make(now), config.appSecret), "100");
  assert.equal(verifyFacebookSignedRequest(make(now, "wrong-secret"), config.appSecret), null);
  assert.equal(verifyFacebookSignedRequest(make(now - 100_000), config.appSecret), null);
  assert.equal(verifyFacebookSignedRequest(make(now + 1000), config.appSecret), null);
  assert.equal(verifyFacebookSignedRequest("invalid", config.appSecret), null);
});