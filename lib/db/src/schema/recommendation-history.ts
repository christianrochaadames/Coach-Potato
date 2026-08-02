import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const recommendationHistoryTable = pgTable(
  "recommendation_history",
  {
    id:       serial("id").primaryKey(),
    userId:   text("user_id").notNull(),
    tmdbId:   integer("tmdb_id").notNull(),
    shownAt:  timestamp("shown_at").defaultNow().notNull(),
  },
  (t) => ({ uniq: unique().on(t.userId, t.tmdbId) })
);
