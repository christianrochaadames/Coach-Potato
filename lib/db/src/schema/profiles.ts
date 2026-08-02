import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const profilesTable = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  username: text("username").unique(),
  bio: text("bio"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Profile = typeof profilesTable.$inferSelect;
