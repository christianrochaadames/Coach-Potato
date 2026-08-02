import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const profilesTable = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  username: text("username").unique(),
  bio: text("bio"),
  /** Which Spud variant the user chose: "2"–"15". null = use initials. */
  avatarId: text("avatar_id"),
  /** base64 data-URL of a custom uploaded photo. Takes priority over avatarId. */
  avatarUrl: text("avatar_url"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Profile = typeof profilesTable.$inferSelect;
