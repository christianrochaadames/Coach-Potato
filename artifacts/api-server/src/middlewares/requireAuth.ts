import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

// Extend Express Request with userId
declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

/** Require a valid Clerk session and scope the request to that Clerk user. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
}
