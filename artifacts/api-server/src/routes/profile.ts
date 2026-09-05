import { Router } from "express";
import {
  db,
  entriesTable,
  profilesTable,
  recommendationFeedbackTable,
  recommendationHistoryTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { mergeLatestAccountSnapshot } from "../lib/latestAccountRecovery";

const router = Router();

// One-time recovery for the production account whose Clerk identity was
// replaced while its database rows remained intact. The exact destination
// guard means only the newly authenticated owner can trigger the transfer.
const DETACHED_ACCOUNT_SOURCE_ID = "user_3HfiC02ptq8kehSa15I5uShXj2H";
const RECOVERED_ACCOUNT_TARGET_ID = "user_3IuJSgUX7FQCRz3x5NVuM85dZcd";

async function recoverDetachedAccount(userId: string) {
  if (
    process.env.NODE_ENV !== "production" ||
    userId !== RECOVERED_ACCOUNT_TARGET_ID
  ) {
    return false;
  }

  const [sourceProfile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, DETACHED_ACCOUNT_SOURCE_ID))
    .limit(1);

  // The source row disappears after a successful transaction, making this
  // recovery idempotent on every later profile request.
  if (!sourceProfile) return false;

  await db.transaction(async (tx) => {
    const [targetProfile] = await tx
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, RECOVERED_ACCOUNT_TARGET_ID))
      .limit(1);

    await tx
      .update(entriesTable)
      .set({ userId: RECOVERED_ACCOUNT_TARGET_ID })
      .where(eq(entriesTable.userId, DETACHED_ACCOUNT_SOURCE_ID));

    // Recommendation tables are unique by (user_id, tmdb_id). Merge first,
    // then remove the detached rows so onboarding history on the new account
    // is retained without duplicate-key failures.
    await tx.execute(sql`
      INSERT INTO recommendation_feedback (user_id, tmdb_id, signal, created_at)
      SELECT
        ${RECOVERED_ACCOUNT_TARGET_ID},
        tmdb_id,
        signal,
        created_at
      FROM recommendation_feedback
      WHERE user_id = ${DETACHED_ACCOUNT_SOURCE_ID}
      ON CONFLICT (user_id, tmdb_id) DO NOTHING
    `);
    await tx
      .delete(recommendationFeedbackTable)
      .where(
        eq(
          recommendationFeedbackTable.userId,
          DETACHED_ACCOUNT_SOURCE_ID,
        ),
      );

    await tx.execute(sql`
      INSERT INTO recommendation_history (user_id, tmdb_id, shown_at)
      SELECT
        ${RECOVERED_ACCOUNT_TARGET_ID},
        tmdb_id,
        shown_at
      FROM recommendation_history
      WHERE user_id = ${DETACHED_ACCOUNT_SOURCE_ID}
      ON CONFLICT (user_id, tmdb_id) DO NOTHING
    `);
    await tx
      .delete(recommendationHistoryTable)
      .where(
        eq(
          recommendationHistoryTable.userId,
          DETACHED_ACCOUNT_SOURCE_ID,
        ),
      );

    const recoveredProfile = {
      firstName: sourceProfile.firstName ?? targetProfile?.firstName ?? null,
      lastName: sourceProfile.lastName ?? targetProfile?.lastName ?? null,
      bio: sourceProfile.bio ?? targetProfile?.bio ?? null,
      topTvShows:
        sourceProfile.topTvShows?.length
          ? sourceProfile.topTvShows
          : targetProfile?.topTvShows ?? [],
      topMovies:
        sourceProfile.topMovies?.length
          ? sourceProfile.topMovies
          : targetProfile?.topMovies ?? [],
      avatarId: sourceProfile.avatarId ?? targetProfile?.avatarId ?? null,
      avatarUrl: sourceProfile.avatarUrl ?? targetProfile?.avatarUrl ?? null,
      facebookId:
        sourceProfile.facebookId ?? targetProfile?.facebookId ?? null,
      onboardingCompleted:
        sourceProfile.onboardingCompleted ||
        targetProfile?.onboardingCompleted ||
        false,
      updatedAt: new Date(),
    };

    await tx
      .insert(profilesTable)
      .values({
        userId: RECOVERED_ACCOUNT_TARGET_ID,
        username: targetProfile?.username ?? sourceProfile.username,
        ...recoveredProfile,
      })
      .onConflictDoUpdate({
        target: profilesTable.userId,
        set: recoveredProfile,
      });

    await tx
      .delete(profilesTable)
      .where(eq(profilesTable.userId, DETACHED_ACCOUNT_SOURCE_ID));
  });

  return true;
}

// GET /check-username?username=xxx — public, no auth required
// Returns { available: true } if the username is free to use.
router.get('/check-username', async (req, res) => {
  const username = (req.query.username as string | undefined)?.trim();
  if (!username || username.length < 2) {
    res.json({ available: false });
    return;
  }
  try {
    const [existing] = await db
      .select({ id: profilesTable.userId })
      .from(profilesTable)
      .where(eq(profilesTable.username, username))
      .limit(1);
    res.json({ available: !existing });
  } catch {
    res.json({ available: true }); // optimistic fallback
  }
});

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
  topTvShows: z.array(z.string().trim().min(1).max(100)).max(3).optional(),
  topMovies: z.array(z.string().trim().min(1).max(100)).max(3).optional(),
  topTvShowPosters: z.array(z.string().max(500).nullable()).max(3).optional(),
  topMoviePosters: z.array(z.string().max(500).nullable()).max(3).optional(),
  /** Spud variant id ("2"–"15"). null clears the selection. */
  avatarId: z.string().max(10).optional().nullable(),
  /** base64 data-URL for a custom uploaded photo. */
  avatarUrl: z.string().max(4000000).optional().nullable(),
  onboardingCompleted: z.boolean().optional(),
});

// GET /profile — get or create profile for the current user
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const recovered = await recoverDetachedAccount(req.userId);
    if (recovered) {
      req.log.info(
        { userId: req.userId },
        "recovered detached account data",
      );
    }
    const latestSnapshot = await mergeLatestAccountSnapshot(req.userId);
    if (latestSnapshot) {
      req.log.info(
        { userId: req.userId, entryCount: latestSnapshot.entryCount },
        "merged latest account recovery snapshot",
      );
    }

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

    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "getProfile error");
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
    const normalizedData = {
      ...parsed.data,
      ...(parsed.data.topTvShows
        ? { topTvShows: [...new Set(parsed.data.topTvShows)].slice(0, 3) }
        : {}),
      ...(parsed.data.topMovies
        ? { topMovies: [...new Set(parsed.data.topMovies)].slice(0, 3) }
        : {}),
    };
    const [profile] = await db
      .insert(profilesTable)
      .values({ userId: req.userId, ...normalizedData, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: profilesTable.userId,
        set: { ...normalizedData, updatedAt: new Date() },
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
