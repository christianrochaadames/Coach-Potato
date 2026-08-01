import { Router } from "express";
import { db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const profileUpdateSchema = z.object({
  username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  bio: z.string().max(200).optional().nullable(),
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

      // If onConflictDoNothing() returned nothing, fetch the existing row
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
    res.status(400).json({ error: parsed.error.message });
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
  } catch (err) {
    req.log.error({ err }, "updateProfile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
