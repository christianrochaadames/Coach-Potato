import { Router } from "express";
import { db, entriesTable } from "@workspace/db";
import { sql, desc, isNotNull, eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// GET /years
router.get("/years", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select({
        year: entriesTable.year,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(entriesTable)
      .where(and(isNotNull(entriesTable.year), eq(entriesTable.userId, req.userId)))
      .groupBy(entriesTable.year)
      .orderBy(desc(entriesTable.year));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "listYears error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
