import { Router } from "express";
import { db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";

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
