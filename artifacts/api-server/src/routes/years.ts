import { Router } from "express";
import { db, entriesTable } from "@workspace/db";
import { sql, desc, isNotNull } from "drizzle-orm";

const router = Router();

// GET /years — list all years with entry counts (only entries with a known year)
router.get("/years", async (req, res) => {
  try {
    const rows = await db
      .select({
        year: entriesTable.year,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(entriesTable)
      .where(isNotNull(entriesTable.year))
      .groupBy(entriesTable.year)
      .orderBy(desc(entriesTable.year));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "listYears error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
