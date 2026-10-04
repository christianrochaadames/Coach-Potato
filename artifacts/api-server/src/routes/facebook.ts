import { randomBytes } from "node:crypto";
import { Router, urlencoded } from "express";
import { and, count, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { BeginFacebookConnectionBody, GetFacebookConnectionQueryParams } from "@workspace/api-zod";
import { buddiesTable, db, facebookOauthAttemptsTable as attempts, profilesTable as profiles } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { serializeIdentity } from "../lib/buddyIdentity";
import {
  FacebookProviderError, facebookAuthorizationUrl, fetchFacebookIdentity,
  getFacebookConfig, getFacebookInviteUrl, hashFacebookState, verifyFacebookSignedRequest,
} from "../lib/facebookProvider";

const router = Router();
const identityFields = {
  userId: profiles.userId, firstName: profiles.firstName, lastName: profiles.lastName,
  username: profiles.username, avatarId: profiles.avatarId, avatarUrl: profiles.avatarUrl,
};

async function deleteConnectionData(tx: Pick<typeof db, "delete" | "update">, userId: string, facebookId: string | null) {
  await tx.delete(attempts).where(eq(attempts.userId, userId));
  if (facebookId) {
    await tx.update(profiles).set({
      facebookFriendIds: sql`coalesce((select jsonb_agg(friend_id) from jsonb_array_elements_text(coalesce(${profiles.facebookFriendIds}, '[]'::jsonb)) as f(friend_id) where friend_id <> ${facebookId}), '[]'::jsonb)`,
    }).where(sql`${profiles.facebookFriendIds} @> ${JSON.stringify([facebookId])}::jsonb`);
  }
  await tx.update(profiles).set({
    facebookId: null, facebookFriendIds: [], facebookSyncedAt: null, updatedAt: new Date(),
  }).where(eq(profiles.userId, userId));
}

router.get("/buddies/facebook", requireAuth, async (req, res): Promise<void> => {
  const query = GetFacebookConnectionQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid pagination" }); return; }
  try {
    const [profile] = await db.select({
      facebookId: profiles.facebookId, facebookFriendIds: profiles.facebookFriendIds,
      syncedAt: profiles.facebookSyncedAt,
    }).from(profiles).where(eq(profiles.userId, req.userId)).limit(1);
    const [attempt] = await db.select().from(attempts).where(eq(attempts.userId, req.userId))
      .orderBy(desc(attempts.createdAt)).limit(1);
    const attemptInProgress = attempt?.status === "pending" || attempt?.status === "processing";
    const pending = !!attemptInProgress && attempt.expiresAt.getTime() > Date.now();
    const friendIds = profile?.facebookId ? profile.facebookFriendIds ?? [] : [];
    const where = friendIds.length ? and(
      inArray(profiles.facebookId, friendIds), sql`${profiles.userId} <> ${req.userId}`,
    ) : undefined;
    const [people, totalRows] = where ? await Promise.all([
      db.select(identityFields).from(profiles).where(where).orderBy(profiles.username, profiles.userId)
        .limit(query.data.limit).offset(query.data.offset),
      db.select({ total: count() }).from(profiles).where(where),
    ]) : [[], [{ total: 0 }]];
    const ids = people.map(person => person.userId);
    const relationships = ids.length ? await db.select().from(buddiesTable).where(or(
      and(eq(buddiesTable.userIdLow, req.userId), inArray(buddiesTable.userIdHigh, ids)),
      and(eq(buddiesTable.userIdHigh, req.userId), inArray(buddiesTable.userIdLow, ids)),
    )) : [];
    res.json({
      configured: !!getFacebookConfig(), connected: !!profile?.facebookId, pending,
      error: attemptInProgress && !pending ? "Facebook connection expired. Try again." : attempt?.error ?? null,
      lastSyncedAt: profile?.syncedAt?.toISOString() ?? null, inviteUrl: getFacebookInviteUrl(),
      results: people.map(person => {
        const relationship = relationships.find(item => item.userIdLow === person.userId || item.userIdHigh === person.userId);
        const status = !relationship ? "none" : relationship.status === "accepted" ? "accepted"
          : relationship.requesterId === req.userId ? "outgoing" : "incoming";
        return { ...serializeIdentity(person), status };
      }),
      total: totalRows[0]?.total ?? 0, ...query.data,
    });
  } catch {
    req.log.error("Facebook discovery read failed");
    res.status(500).json({ error: "Could not load Facebook friends. Please try again." });
  }
});

router.post("/buddies/facebook/connect", requireAuth, async (req, res): Promise<void> => {
  const config = getFacebookConfig();
  if (!config) { res.status(503).json({ error: "Facebook friend finding is not available yet. You can still invite friends or search by name." }); return; }
  const body = BeginFacebookConnectionBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid connection request" }); return; }
  try {
    const [profile] = await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.userId, req.userId)).limit(1);
    if (!profile) { res.status(404).json({ error: "Create your Spud profile before connecting Facebook." }); return; }
    const state = randomBytes(32).toString("base64url");
    await db.transaction(async tx => {
      await tx.delete(attempts).where(or(eq(attempts.userId, req.userId), lt(attempts.expiresAt, new Date())));
      await tx.insert(attempts).values({
        stateHash: hashFacebookState(state), userId: req.userId, returnTo: body.data.returnTo,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      });
    });
    res.json({ authorizationUrl: facebookAuthorizationUrl(config, state) });
  } catch {
    req.log.error("Facebook connection start failed");
    res.status(500).json({ error: "Could not start Facebook connection. Please try again." });
  }
});

router.delete("/buddies/facebook/connect", requireAuth, async (req, res): Promise<void> => {
  try {
    await db.delete(attempts).where(eq(attempts.userId, req.userId));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Could not cancel Facebook connection. Please try again." });
  }
});

router.delete("/buddies/facebook", requireAuth, async (req, res): Promise<void> => {
  try {
    await db.transaction(async tx => {
      // Delete attempts before touching profiles: an in-flight callback must not reconnect after removal.
      await tx.delete(attempts).where(eq(attempts.userId, req.userId));
      const [profile] = await tx.select({ facebookId: profiles.facebookId }).from(profiles)
        .where(eq(profiles.userId, req.userId)).limit(1).for("update");
      await deleteConnectionData(tx, req.userId, profile?.facebookId ?? null);
    });
    res.json({ success: true });
  } catch {
    req.log.error("Facebook disconnect failed");
    res.status(500).json({ error: "Could not disconnect Facebook. Please try again." });
  }
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
}

function resultHtml(message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spud Facebook connection</title></head><body style="margin:0;background:#0F2D1C;color:#fff;font-family:system-ui;padding:40px 24px"><main style="max-width:480px;margin:auto"><h1>Spud buddies</h1><p>${escapeHtml(message)}</p><p><a style="color:#D4F5A0" href="couchpotato://buddies">Return to Spud</a></p><p>You can also close this browser window to return to the app.</p></main></body></html>`;
}

router.get("/facebook/callback", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  const state = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/).safeParse(req.query.state);
  if (!state.success) { res.status(400).type("html").send(resultHtml("This Facebook connection is invalid. Return to Spud and try again.")); return; }
  const stateHash = hashFacebookState(state.data);
  const [attempt] = await db.update(attempts).set({ status: "processing" }).where(and(
    eq(attempts.stateHash, stateHash), eq(attempts.status, "pending"), gt(attempts.expiresAt, new Date()),
  )).returning();
  if (!attempt) { res.status(400).type("html").send(resultHtml("This Facebook connection expired or was cancelled. Return to Spud and try again.")); return; }
  let message = "Facebook connected. Your friends on Spud are ready to find.";
  let success = false;
  try {
    if (req.query.error) throw new FacebookProviderError("Facebook connection cancelled. You can still search for buddies by name.");
    const code = z.string().min(1).max(4096).safeParse(req.query.code);
    const config = getFacebookConfig();
    if (!config || !code.success) throw new FacebookProviderError("Facebook connection is unavailable. Please try again later.");
    const identity = await fetchFacebookIdentity(code.data, config);
    await db.transaction(async tx => {
      const [active] = await tx.select().from(attempts).where(and(
        eq(attempts.stateHash, stateHash), eq(attempts.status, "processing"), gt(attempts.expiresAt, new Date()),
      )).limit(1).for("update");
      if (!active) throw new FacebookProviderError("Facebook connection was cancelled. Return to Spud to try again.");
      const [owner] = await tx.select({ facebookId: profiles.facebookId }).from(profiles)
        .where(eq(profiles.userId, attempt.userId)).limit(1).for("update");
      if (!owner) throw new FacebookProviderError("Your Spud profile could not be found.");
      if (owner.facebookId && owner.facebookId !== identity.facebookId) {
        throw new FacebookProviderError("Disconnect your current Facebook account in Spud before connecting a different one.");
      }
      const [conflict] = await tx.select({ userId: profiles.userId }).from(profiles).where(and(
        eq(profiles.facebookId, identity.facebookId), sql`${profiles.userId} <> ${attempt.userId}`,
      )).limit(1);
      if (conflict) throw new FacebookProviderError("This Facebook account is connected to another Spud account. Disconnect it there first.");
      const matches = identity.friendIds.length ? await tx.select({ facebookId: profiles.facebookId }).from(profiles)
        .where(inArray(profiles.facebookId, identity.friendIds)) : [];
      await tx.update(profiles).set({
        facebookId: identity.facebookId,
        facebookFriendIds: matches.map(person => person.facebookId!).filter(id => id !== identity.facebookId),
        facebookSyncedAt: new Date(), updatedAt: new Date(),
      }).where(eq(profiles.userId, attempt.userId));
      await tx.update(attempts).set({ status: "complete", error: null }).where(eq(attempts.stateHash, stateHash));
    });
    success = true;
  } catch (error) {
    if (error instanceof FacebookProviderError) {
      req.log.warn({
        phase: error.phase,
        providerCode: error.providerCode,
        providerSubcode: error.providerSubcode,
      }, "Facebook connection failed");
    }
    message = error instanceof FacebookProviderError ? error.message : "Facebook connection could not be saved. Please try again.";
    await db.update(attempts).set({ status: "error", error: message }).where(eq(attempts.stateHash, stateHash));
    if (!(error instanceof FacebookProviderError)) req.log.error("Facebook callback failed");
  }
  const inviteUrl = getFacebookInviteUrl();
  if (attempt.returnTo === "web" && inviteUrl) {
    res.redirect(303, `${inviteUrl}buddies?facebook=${success ? "connected" : "error"}`);
    return;
  }
  res.type("html").send(resultHtml(message));
});

router.post("/facebook/deauthorize", urlencoded({ extended: false, limit: "8kb" }), async (req, res): Promise<void> => {
  const config = getFacebookConfig();
  const signed = z.string().max(8192).safeParse(req.body?.signed_request);
  const facebookId = config && signed.success ? verifyFacebookSignedRequest(signed.data, config.appSecret) : null;
  if (!facebookId) { res.status(400).json({ error: "Invalid Facebook request" }); return; }
  try {
    await db.transaction(async tx => {
      const [profile] = await tx.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.facebookId, facebookId)).limit(1);
      if (profile) await deleteConnectionData(tx, profile.userId, facebookId);
    });
    res.json({ success: true });
  } catch {
    req.log.error("Facebook data removal failed");
    res.status(500).json({ error: "Could not remove Facebook connection data" });
  }
});

router.get("/facebook/data-deletion", (_req, res) => {
  res.type("html").send(resultHtml("To delete your Facebook connection data, open Spud → Profile → Find & manage buddies → Disconnect Facebook. This deletes your Facebook identity and discovery matches. It does not remove buddies you already accepted or delete your Spud watch history. Removing Spud from Facebook’s Apps and Websites also disconnects Facebook when Facebook sends its deauthorization request."));
});

export default router;