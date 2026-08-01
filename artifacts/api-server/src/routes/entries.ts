import { Router } from "express";
import { db, entriesTable } from "@workspace/db";
import { eq, and, like, gte, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const seasonSchema = z.object({
  number: z.number().int().min(1),
  status: z.enum(["watched", "watching"]),
  dateWatched: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

const entryInputSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["movie", "show"]),
  status: z.enum(["watching", "plan_to_watch", "completed"]).optional(),
  posterUrl: z.string().optional(),
  dateWatched: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
  synopsis: z.string().optional(),
  tmdbId: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  platform: z.string().optional(),
  seasons: z.array(seasonSchema).optional(),
});

const entryUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.enum(["movie", "show"]).optional(),
  status: z.enum(["watching", "plan_to_watch", "completed"]).optional(),
  posterUrl: z.string().nullable().optional(),
  dateWatched: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
  synopsis: z.string().nullable().optional(),
  tmdbId: z.number().int().nullable().optional(),
  tags: z.array(z.string()).optional(),
  platform: z.string().nullable().optional(),
  seasons: z.array(seasonSchema).optional(),
});

function serializeEntry(entry: typeof entriesTable.$inferSelect) {
  return {
    ...entry,
    posterUrl: entry.posterUrl ?? null,
    dateWatched: entry.dateWatched ?? null,
    year: entry.year ?? null,
    rating: entry.rating ?? null,
    notes: entry.notes ?? null,
    synopsis: entry.synopsis ?? null,
    tmdbId: entry.tmdbId ?? null,
    tags: (entry.tags as string[]) ?? [],
    platform: (entry as any).platform ?? null,
    seasons: (entry as any).seasons ?? [],
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

// GET /entries
router.get("/entries", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const type = req.query.type as string | undefined;
    const search = req.query.search as string | undefined;
    const minRating = req.query.minRating ? Number(req.query.minRating) : undefined;
    const status = req.query.status as string | undefined;

    const conditions = [eq(entriesTable.userId, userId)];
    if (year) conditions.push(eq(entriesTable.year, year));
    if (type === "movie" || type === "show") conditions.push(eq(entriesTable.type, type));
    if (search) conditions.push(like(entriesTable.title, `%${search}%`));
    if (minRating) conditions.push(gte(entriesTable.rating, minRating));
    if (status === "watching" || status === "plan_to_watch" || status === "completed") {
      conditions.push(eq(entriesTable.status, status));
    }

    const rows = await db
      .select()
      .from(entriesTable)
      .where(and(...conditions))
      .orderBy(desc(entriesTable.createdAt));

    res.json(rows.map(serializeEntry));
  } catch (err) {
    req.log.error({ err }, "listEntries error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /entries
router.post("/entries", requireAuth, async (req, res) => {
  const parsed = entryInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    title, type, status, posterUrl, dateWatched, rating,
    notes, synopsis, tmdbId, tags, platform, seasons,
  } = parsed.data;

  const year = dateWatched ? Number(dateWatched.split("-")[0]) : null;

  try {
    const [row] = await db
      .insert(entriesTable)
      .values({
        userId: req.userId,
        title,
        type,
        status: status ?? "completed",
        posterUrl: posterUrl ?? null,
        dateWatched: dateWatched ?? null,
        year,
        rating: rating ?? null,
        notes: notes ?? null,
        synopsis: synopsis ?? null,
        tmdbId: tmdbId ?? null,
        tags: tags ?? [],
        platform: platform ?? null,
        seasons: seasons ?? [],
      } as any)
      .returning();

    res.status(201).json(serializeEntry(row));
  } catch (err) {
    req.log.error({ err }, "createEntry error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /entries/:id
router.get("/entries/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const [row] = await db
      .select()
      .from(entriesTable)
      .where(and(eq(entriesTable.id, id), eq(entriesTable.userId, req.userId)));
    if (!row) { res.status(404).json({ error: "Entry not found" }); return; }
    res.json(serializeEntry(row));
  } catch (err) {
    req.log.error({ err }, "getEntry error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /entries/:id
router.put("/entries/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = entryUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const { dateWatched, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() };
    if (dateWatched !== undefined) {
      updateData.dateWatched = dateWatched;
      updateData.year = dateWatched ? Number(dateWatched.split("-")[0]) : null;
    }

    const [row] = await db
      .update(entriesTable)
      .set(updateData)
      .where(and(eq(entriesTable.id, id), eq(entriesTable.userId, req.userId)))
      .returning();

    if (!row) { res.status(404).json({ error: "Entry not found" }); return; }
    res.json(serializeEntry(row));
  } catch (err) {
    req.log.error({ err }, "updateEntry error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /entries/:id
router.delete("/entries/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const [row] = await db
      .delete(entriesTable)
      .where(and(eq(entriesTable.id, id), eq(entriesTable.userId, req.userId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Entry not found" }); return; }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "deleteEntry error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
