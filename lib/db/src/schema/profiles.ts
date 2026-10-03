import { pgTable, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const profilesTable = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  username: text("username").unique(),
  bio: text("bio"),
  topTvShows: jsonb("top_tv_shows").$type<string[]>().default([]),
  topMovies: jsonb("top_movies").$type<string[]>().default([]),
  topTvShowPosters: jsonb("top_tv_show_posters").$type<(string | null)[]>().default([]),
  topMoviePosters: jsonb("top_movie_posters").$type<(string | null)[]>().default([]),
  /** Which Spud variant the user chose: "2"–"15". null = use initials. */
  avatarId: text("avatar_id"),
  /** base64 data-URL of a custom uploaded photo. Takes priority over avatarId. */
  avatarUrl: text("avatar_url"),
  /** Private app-scoped identity; only the verified Facebook callback may set it. */
  facebookId: text("facebook_id").unique(),
  /** Only IDs belonging to other members who have connected Facebook to Spud. */
  facebookFriendIds: jsonb("facebook_friend_ids").$type<string[]>().default([]),
  facebookSyncedAt: timestamp("facebook_synced_at", { withTimezone: true }),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Profile = typeof profilesTable.$inferSelect;
