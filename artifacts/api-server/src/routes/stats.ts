import { Router } from "express";
import { db, entriesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

// GET /stats?year=2026
router.get("/stats", async (req, res) => {
  const year = Number(req.query.year);
  if (isNaN(year) || year < 1900 || year > 2200) {
    res.status(400).json({ error: "Valid year parameter required" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(entriesTable)
      .where(eq(entriesTable.year, year));

    const total = rows.length;
    const movies = rows.filter((r) => r.type === "movie").length;
    const shows = rows.filter((r) => r.type === "show").length;

    const rated = rows.filter((r) => r.rating !== null);
    const averageRating =
      rated.length > 0
        ? rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length
        : null;

    // By month
    const monthMap = new Map<number, number>();
    for (const row of rows) {
      const month = Number(row.dateWatched.split("-")[1]);
      monthMap.set(month, (monthMap.get(month) ?? 0) + 1);
    }
    const byMonth = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      count: monthMap.get(i + 1) ?? 0,
    }));

    // By tag
    const tagMap = new Map<string, number>();
    for (const row of rows) {
      const tags = (row.tags as string[]) ?? [];
      for (const tag of tags) {
        tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
      }
    }
    const byTag = Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      year,
      total,
      movies,
      shows,
      averageRating: averageRating !== null ? Math.round(averageRating * 10) / 10 : null,
      byMonth,
      byTag,
    });
  } catch (err) {
    req.log.error({ err }, "getStats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
