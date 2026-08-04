import { pgTable, serial, text, integer, timestamp, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const recommendationFeedbackTable = pgTable(
  "recommendation_feedback",
  {
    id:        serial("id").primaryKey(),
    userId:    text("user_id").notNull(),
    tmdbId:    integer("tmdb_id").notNull(),
    signal:    text("signal").notNull(), // 'like' | 'skip'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniq:         unique().on(t.userId, t.tmdbId),
    signalCheck:  check("signal_check", sql`${t.signal} IN ('like', 'skip')`),
  })
);
