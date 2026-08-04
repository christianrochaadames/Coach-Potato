import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { eq, inArray, isNotNull } from "drizzle-orm";

const router = Router();

// ── POST /api/facebook/connect ────────────────────────────────────────────────
// Verifies a Facebook access token, then saves the user's Facebook ID to their
// profile so friends-discovery can match them later.

router.post("/facebook/connect", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { facebookId, accessToken } = req.body as {
    facebookId?: string;
    accessToken?: string;
  };

  if (!facebookId || !accessToken) {
    return res.status(400).json({ error: "facebookId and accessToken are required" });
  }

  // Verify token with Facebook — the returned id must match the claimed id
  let fbData: { id?: string; error?: { message: string } };
  try {
    const resp = await fetch(
      `https://graph.facebook.com/me?access_token=${encodeURIComponent(accessToken)}&fields=id`
    );
    fbData = await resp.json();
  } catch {
    return res.status(502).json({ error: "Could not reach Facebook API" });
  }

  if (fbData.error || fbData.id !== facebookId) {
    return res.status(401).json({ error: "Invalid Facebook token" });
  }

  await db
    .update(profilesTable)
    .set({ facebookId, updatedAt: new Date() })
    .where(eq(profilesTable.userId, userId));

  return res.json({ ok: true });
});

// ── DELETE /api/facebook/disconnect ──────────────────────────────────────────
// Removes the stored Facebook ID so the user's profile is no longer discoverable
// by friends.

router.delete("/facebook/disconnect", requireAuth, async (req, res) => {
  const userId = req.userId!;

  await db
    .update(profilesTable)
    .set({ facebookId: null, updatedAt: new Date() })
    .where(eq(profilesTable.userId, userId));

  return res.json({ ok: true });
});

// ── GET /api/facebook/friends ─────────────────────────────────────────────────
// Given a Facebook access token (query param), calls the Graph API for the
// authenticated user's friends who also authorized this app, then returns the
// subset that are registered CouchPotato users.

router.get("/facebook/friends", requireAuth, async (req, res) => {
  const { accessToken } = req.query as { accessToken?: string };

  if (!accessToken) {
    return res.status(400).json({ error: "accessToken query param is required" });
  }

  // /me/friends only returns friends who also installed the same Facebook app
  let friendsData: {
    data?: Array<{ id: string; name: string; picture?: { data?: { url?: string } } }>;
    error?: { message: string };
  };
  try {
    const resp = await fetch(
      `https://graph.facebook.com/me/friends?access_token=${encodeURIComponent(accessToken)}&fields=id,name,picture`
    );
    friendsData = await resp.json();
  } catch {
    return res.status(502).json({ error: "Could not reach Facebook API" });
  }

  if (friendsData.error) {
    return res.status(400).json({ error: friendsData.error.message });
  }

  const fbFriends = friendsData.data ?? [];
  if (fbFriends.length === 0) {
    return res.json({ friends: [] });
  }

  const fbIds = fbFriends.map((f) => f.id);
  const fbMap = new Map(fbFriends.map((f) => [f.id, f]));

  // Find CouchPotato profiles whose facebookId is in the friends list
  const matched = await db
    .select({
      userId: profilesTable.userId,
      firstName: profilesTable.firstName,
      lastName: profilesTable.lastName,
      username: profilesTable.username,
      avatarId: profilesTable.avatarId,
      facebookId: profilesTable.facebookId,
    })
    .from(profilesTable)
    .where(inArray(profilesTable.facebookId, fbIds));

  const friends = matched.map((profile) => {
    const fb = fbMap.get(profile.facebookId!);
    return {
      userId: profile.userId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      username: profile.username,
      avatarId: profile.avatarId,
      fbName: fb?.name ?? null,
      fbPicture: fb?.picture?.data?.url ?? null,
    };
  });

  return res.json({ friends });
});

// ── GET /api/facebook/status ──────────────────────────────────────────────────
// Returns whether the current user has a Facebook account connected.

router.get("/facebook/status", requireAuth, async (req, res) => {
  const userId = req.userId!;

  const [profile] = await db
    .select({ facebookId: profilesTable.facebookId })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  return res.json({ connected: !!profile?.facebookId });
});

export default router;
