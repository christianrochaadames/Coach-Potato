import { pgTable, text, timestamp, unique, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * A friendship is stored once per canonical (lexically sorted) user pair.
 * requesterId preserves which side initiated the request until it is accepted.
 */
export const buddiesTable = pgTable(
  "buddies",
  {
    userIdLow: text("user_id_low").notNull(),
    userIdHigh: text("user_id_high").notNull(),
    requesterId: text("requester_id").notNull(),
    status: text("status", { enum: ["pending", "accepted"] }).notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pairUnique: unique("buddies_user_pair_unique").on(table.userIdLow, table.userIdHigh),
    canonicalPair: check("buddies_canonical_pair_check", sql`${table.userIdLow} < ${table.userIdHigh}`),
    requesterInPair: check(
      "buddies_requester_in_pair_check",
      sql`${table.requesterId} = ${table.userIdLow} OR ${table.requesterId} = ${table.userIdHigh}`,
    ),
    statusCheck: check("buddies_status_check", sql`${table.status} IN ('pending', 'accepted')`),
    lowUserIndex: index("buddies_user_id_low_idx").on(table.userIdLow),
    highUserIndex: index("buddies_user_id_high_idx").on(table.userIdHigh),
  }),
);

export type BuddyRelationship = typeof buddiesTable.$inferSelect;