import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const facebookOauthAttemptsTable = pgTable("facebook_oauth_attempts", {
  stateHash: text("state_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => profilesTable.userId, { onDelete: "cascade" }),
  returnTo: text("return_to").$type<"web" | "native">().notNull(),
  status: text("status").$type<"pending" | "processing" | "complete" | "error">().notNull().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type FacebookOauthAttempt = typeof facebookOauthAttemptsTable.$inferSelect;
export type InsertFacebookOauthAttempt = typeof facebookOauthAttemptsTable.$inferInsert;