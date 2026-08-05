import { Router } from "express";
import { db, profilesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { clerkClient } from "@clerk/express";

const router = Router();

const profileUpdateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().max(50).optional().nullable(),
  username: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores — no spaces")
    .optional(),
  bio: z.string().max(200).optional().nullable(),
  /** Spud variant id ("2"–"15"). null clears the selection. */
  avatarId: z.string().max(10).optional().nullable(),
  /** base64 data-URL for a custom uploaded photo. Can be large (up to ~200 KB). */
  avatarUrl: z.string().max(300000).optional().nullable(),
  onboardingCompleted: z.boolean().optional(),
});

// GET /profile — get or create profile for the current user
router.get("/profile", requireAuth, async (req, res) => {
  try {
    let [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, req.userId));

    if (!profile) {
      [profile] = await db
        .insert(profilesTable)
        .values({ userId: req.userId })
        .onConflictDoNothing()
        .returning();

      if (!profile) {
        [profile] = await db
          .select()
          .from(profilesTable)
          .where(eq(profilesTable.userId, req.userId));
      }
    }

    // Auto-sync Facebook user ID from Clerk external accounts (non-fatal)
    if (profile && !profile.facebookId) {
      try {
        const tokens = await clerkClient.users.getUserOauthAccessToken(
          req.userId,
          "oauth_facebook"
        );
        const tokenList = Array.isArray(tokens) ? tokens : (tokens as any)?.data ?? [];
        const fbToken = tokenList[0]?.token;
        if (fbToken) {
          const fbRes = await fetch(
            `https://graph.facebook.com/v19.0/me?fields=id&access_token=${fbToken}`
          );
          if (fbRes.ok) {
            const fbData = (await fbRes.json()) as { id?: string };
            if (fbData.id) {
              [profile] = await db
                .update(profilesTable)
                .set({ facebookId: fbData.id, updatedAt: new Date() })
                .where(eq(profilesTable.userId, req.userId))
                .returning();
            }
          }
        }
      } catch {
        // Non-fatal — user may not have Facebook connected
      }
    }

    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "getProfile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /profile/friends — return CouchPotato profiles for the user's FB friends
router.get("/profile/friends", requireAuth, async (req, res) => {
  try {
    // Get the user's Facebook access token from Clerk
    let fbToken: string | undefined;
    try {
      const tokens = await clerkClient.users.getUserOauthAccessToken(
        req.userId,
        "oauth_facebook"
      );
      const tokenList = Array.isArray(tokens) ? tokens : (tokens as any)?.data ?? [];
      fbToken = tokenList[0]?.token;
    } catch {
      // User hasn't connected Facebook — fall through
    }

    if (!fbToken) {
      res.json({ friends: [], status: "not_connected" });
      return;
    }

    // Fetch the current user's friend list from Facebook Graph API.
    // NOTE: /me/friends only returns friends who have also authorised this app
    // with the user_friends permission (requires Meta App Review).
    let friendFbIds: string[] = [];
    try {
      const fbRes = await fetch(
        `https://graph.facebook.com/v19.0/me/friends?fields=id&limit=500&access_token=${fbToken}`
      );
      if (fbRes.ok) {
        const fbData = (await fbRes.json()) as { data?: { id: string }[] };
        friendFbIds = (fbData.data ?? []).map((f) => f.id);
      }
    } catch {
      res.json({ friends: [], status: "fb_error" });
      return;
    }

    if (friendFbIds.length === 0) {
      // Either no friends use the app yet or user_friends permission not granted
      res.json({ friends: [], status: "no_friends" });
      return;
    }

    // Match Facebook IDs against CouchPotato profiles
    const matched = await db
      .select({
        userId: profilesTable.userId,
        username: profilesTable.username,
        firstName: profilesTable.firstName,
        lastName: profilesTable.lastName,
        avatarId: profilesTable.avatarId,
        avatarUrl: profilesTable.avatarUrl,
        bio: profilesTable.bio,
      })
      .from(profilesTable)
      .where(inArray(profilesTable.facebookId, friendFbIds));

    // Never include the requesting user's own profile
    const friends = matched.filter((p) => p.userId !== req.userId);

    res.json({ friends, status: "ok" });
  } catch (err) {
    req.log.error({ err }, "getProfileFriends error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /profile — update profile fields
router.patch("/profile", requireAuth, async (req, res) => {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    // Return the first human-readable error message
    const firstError = parsed.error.errors[0];
    res.status(400).json({ error: firstError?.message ?? "Invalid input" });
    return;
  }

  try {
    const [profile] = await db
      .insert(profilesTable)
      .values({ userId: req.userId, ...parsed.data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: profilesTable.userId,
        set: { ...parsed.data, updatedAt: new Date() },
      })
      .returning();

    res.json(profile);
  } catch (err: any) {
    // Unique constraint violation on username
    if (err?.code === "23505" || err?.message?.includes("unique")) {
      res.status(400).json({ error: "That username is already taken — try another one" });
      return;
    }
    req.log.error({ err }, "updateProfile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
