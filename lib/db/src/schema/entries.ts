import { pgTable, serial, text, integer, date, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const entriesTable = pgTable("entries", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type", { enum: ["movie", "show"] }).notNull(),
  status: text("status", { enum: ["watching", "plan_to_watch", "completed"] })
    .notNull()
    .default("completed"),
  posterUrl: text("poster_url"),
  // nullable — watchlist entries may not have a watched date yet
  dateWatched: date("date_watched"),
  year: integer("year"),
  rating: integer("rating"),
  notes: text("notes"),
  synopsis: text("synopsis"),
  tmdbId: integer("tmdb_id"),
  platform: text("platform"),
  tags: jsonb("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEntrySchema = createInsertSchema(entriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEntry = z.infer<typeof insertEntrySchema>;
export type Entry = typeof entriesTable.$inferSelect;
