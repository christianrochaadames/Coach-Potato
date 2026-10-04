import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { after, before, test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { buddiesTable, db, facebookOauthAttemptsTable as attempts, pool, profilesTable as profiles } from "@workspace/db";
import router from "./facebook";
import { hashFacebookState } from "../lib/facebookProvider";

// REPLIT_ENVIRONMENT can say "production" inside this workspace. Require the
// workspace-only development domain; these fixtures must never run when published.
if (!process.env.REPLIT_DEV_DOMAIN) throw new Error("Run Facebook integration tests only inside the development workspace.");
const suffix = randomUUID();
const viewer = `fb-test-viewer-${suffix}`, friend = `fb-test-friend-${suffix}`, buddy = `fb-test-buddy-${suffix}`;
const facebookId = String(BigInt(`0x${randomUUID().replaceAll("-", "").slice(0, 12)}`));
const friendFacebookId = `${facebookId}1`;
const originalFetch = globalThis.fetch;
const envKeys = ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET", "FACEBOOK_REDIRECT_URI"] as const;
const originalEnv = envKeys.map(key => process.env[key]);
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });

// Invoke only the route body, with synthetic authenticated identity. Live HTTP
// checks separately verify that the unchanged Clerk middleware returns 401.
async function call(method: string, path: string, options: { query?: object; body?: object } = {}) {
  const route = router.stack.find(layer => layer.route?.path === path
    && (layer.route as typeof layer.route & { methods: Record<string, boolean> }).methods[method])?.route;
  assert.ok(route, `Missing ${method} ${path}`);
  const result = {
    statusCode: 200, body: null as any, headers: {} as Record<string, string>, location: "",
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    send(body: unknown) { this.body = body; return this; },
    type(_type: string) { return this; },
    setHeader(name: string, value: string) { this.headers[name] = value; },
    redirect(code: number, location: string) { this.statusCode = code; this.location = location; },
  };
  await route.stack.at(-1)!.handle({
    userId: viewer, query: {}, body: {}, log: { error() {} }, ...options,
  } as any, result as any, (() => {}) as any);
  return result;
}

const graph: typeof fetch = async input => {
  const url = new URL(String(input));
  assert.equal(url.hostname, "graph.facebook.com");
  if (url.pathname.endsWith("/oauth/access_token")) return json({ access_token: "fake-ephemeral-token" });
  if (url.pathname.endsWith("/permissions")) return json({ data: [{ permission: "user_friends", status: "granted" }] });
  if (url.pathname.endsWith("/me")) return json({ id: facebookId });
  return json({ data: [{ id: friendFacebookId }, { id: "999999999999999" }] });
};

async function begin() {
  const response = await call("post", "/buddies/facebook/connect", { body: { returnTo: "native" } });
  assert.equal(response.statusCode, 200);
  return new URL(response.body.authorizationUrl).searchParams.get("state")!;
}

before(async () => {
  process.env.FACEBOOK_APP_ID = "12345";
  process.env.FACEBOOK_APP_SECRET = "fake-test-secret";
  process.env.FACEBOOK_REDIRECT_URI = "https://example.test/api/facebook/callback";
  globalThis.fetch = graph;
  await db.insert(profiles).values([
    { userId: viewer, username: `viewer-${suffix}`, firstName: "Test viewer" },
    { userId: friend, username: `friend-${suffix}`, firstName: "Test friend", facebookId: friendFacebookId, bio: "Private test bio", topMovies: ["Private test favorite"] },
    { userId: buddy, username: `buddy-${suffix}`, firstName: "Test buddy" },
  ]);
  const [low, high] = [viewer, buddy].sort();
  await db.insert(buddiesTable).values({ userIdLow: low, userIdHigh: high, requesterId: viewer, status: "accepted" });
});

after(async () => {
  globalThis.fetch = originalFetch;
  envKeys.forEach((key, index) => originalEnv[index] === undefined ? delete process.env[key] : process.env[key] = originalEnv[index]);
  await db.delete(profiles).where(inArray(profiles.userId, [viewer, friend, buddy]));
  await pool.end();
});

test("Facebook lifecycle protects privacy, cancellation and existing buddies", async t => {
  await t.test("Unconfigured discovery is honest and cannot start OAuth", async () => {
    delete process.env.FACEBOOK_APP_SECRET;
    const read = await call("get", "/buddies/facebook");
    assert.equal(read.body.configured, false);
    assert.deepEqual(read.body.results, []);
    assert.equal((await call("post", "/buddies/facebook/connect", { body: { returnTo: "native" } })).statusCode, 503);
    process.env.FACEBOOK_APP_SECRET = "fake-test-secret";
  });
  await t.test("Only hashed, expiring state is persisted; callback stores only consenting Spud matches", async () => {
    const state = await begin();
    const [attempt] = await db.select().from(attempts).where(eq(attempts.userId, viewer));
    assert.equal(attempt.stateHash, hashFacebookState(state));
    assert.notEqual(attempt.stateHash, state);
    assert.equal((await call("get", "/buddies/facebook")).body.pending, true);
    const callback = await call("get", "/facebook/callback", { query: { state, code: "fake-code" } });
    assert.equal(callback.statusCode, 200);
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, viewer));
    assert.equal(profile.facebookId, facebookId);
    assert.deepEqual(profile.facebookFriendIds, [friendFacebookId]);
    const matches = await call("get", "/buddies/facebook");
    assert.equal(matches.body.connected, true);
    assert.equal(matches.body.results.length, 1);
    assert.equal(matches.body.results[0].userId, friend);
    assert.equal(matches.body.results[0].status, "none");
    assert.deepEqual(Object.keys(matches.body.results[0]).sort(), ["avatarId", "avatarUrl", "firstName", "lastName", "status", "userId", "username"]);
    assert.equal((await call("get", "/facebook/callback", { query: { state, code: "fake-code" } })).statusCode, 400);
  });
  await t.test("Pagination is bounded and invalid input is rejected", async () => {
    assert.equal((await call("get", "/buddies/facebook", { query: { limit: "31" } })).statusCode, 400);
    const page = await call("get", "/buddies/facebook", { query: { limit: "1", offset: "1" } });
    assert.equal(page.body.total, 1);
    assert.deepEqual(page.body.results, []);
  });
  await t.test("Disconnect removes own and other discovery references without removing buddies", async () => {
    await db.update(profiles).set({ facebookFriendIds: [facebookId] }).where(eq(profiles.userId, friend));
    assert.equal((await call("delete", "/buddies/facebook")).body.success, true);
    const rows = await db.select().from(profiles).where(inArray(profiles.userId, [viewer, friend]));
    assert.equal(rows.find(row => row.userId === viewer)?.facebookId, null);
    assert.deepEqual(rows.find(row => row.userId === friend)?.facebookFriendIds, []);
    const [low] = [viewer, buddy].sort();
    assert.equal((await db.select().from(buddiesTable).where(eq(buddiesTable.userIdLow, low))).length, 1);
  });
  await t.test("Cancelling an in-flight provider callback cannot restore the connection", async () => {
    const state = await begin();
    let started!: () => void, release!: () => void;
    const entered = new Promise<void>(resolve => { started = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    globalThis.fetch = async (input, init) => {
      if (new URL(String(input)).pathname.endsWith("/oauth/access_token")) { started(); await gate; }
      return graph(input, init);
    };
    const callback = call("get", "/facebook/callback", { query: { state, code: "fake-code" } });
    await entered;
    await call("delete", "/buddies/facebook/connect");
    release();
    await callback;
    globalThis.fetch = graph;
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, viewer));
    assert.equal(profile.facebookId, null);
  });
  await t.test("Denied permission gives an actionable error without linking", async () => {
    const state = await begin();
    globalThis.fetch = async (input, init) => new URL(String(input)).pathname.endsWith("/permissions")
      ? json({ data: [{ permission: "user_friends", status: "declined" }] }) : graph(input, init);
    await call("get", "/facebook/callback", { query: { state, code: "fake-code" } });
    globalThis.fetch = graph;
    const result = await call("get", "/buddies/facebook");
    assert.equal(result.body.connected, false);
    assert.match(result.body.error, /Allow Facebook friends access/);
  });
  await t.test("Verified deauthorisation removes discovery data; forged requests do nothing", async () => {
    const state = await begin();
    await call("get", "/facebook/callback", { query: { state, code: "fake-code" } });
    assert.equal((await call("post", "/facebook/deauthorize", { body: { signed_request: "fake" } })).statusCode, 400);
    const payload = Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: facebookId, issued_at: Math.floor(Date.now() / 1000) })).toString("base64url");
    const signed_request = `${createHmac("sha256", "fake-test-secret").update(payload).digest("base64url")}.${payload}`;
    assert.equal((await call("post", "/facebook/deauthorize", { body: { signed_request } })).body.success, true);
    assert.equal((await call("get", "/buddies/facebook")).body.connected, false);
  });
});