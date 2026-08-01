import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";

// Extend Express Request with userId
declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

/**
 * Require a valid Clerk session. Sets req.userId on success.
 * Also auto-claims any "seed_data" entries (legacy single-user data) for the
 * first authenticated user — this is a one-time migration that becomes a no-op
 * once all existing rows have a real userId.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;

  // One-time data migration: claim any unclaimed seed rows for the first user
  pool
    .query(`UPDATE entries SET user_id = $1 WHERE user_id = 'seed_data'`, [userId])
    .catch(() => {});

  next();
}
