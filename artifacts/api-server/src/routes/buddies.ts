import { Router } from "express";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { buddiesTable, db, entriesTable, profilesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { clerkClient } from "@clerk/express";
import { verifiedEmailUserIds } from "../lib/emailDiscovery";
import { serializeIdentity, type Identity } from "../lib/buddyIdentity";

const router = Router();
const buddyParamsSchema = z.object({ userId: z.string().min(1).max(255) });
const searchQuerySchema = z.object({ q: z.string().trim().min(2).max(254) });
const emailSearchWindows = new Map<string, { start: number; count: number }>();
const entryQuerySchema = z.object({
  status: z.enum(["watching", "plan_to_watch", "completed"]),
  limit: z.coerce.number().int().min(1).max(30).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

const identityFields = {
  userId: profilesTable.userId,
  firstName: profilesTable.firstName,
  lastName: profilesTable.lastName,
  username: profilesTable.username,
  avatarId: profilesTable.avatarId,
  avatarUrl: profilesTable.avatarUrl,
};

const listPersonFields = identityFields;
const detailPersonFields = {
  ...identityFields,
  bio: profilesTable.bio,
  topTvShows: profilesTable.topTvShows,
  topMovies: profilesTable.topMovies,
  topTvShowPosters: profilesTable.topTvShowPosters,
  topMoviePosters: profilesTable.topMoviePosters,
};

type BuddyStatus = "none" | "incoming" | "outgoing" | "accepted";

function canonicalPair(userA: string, userB: string) {
  return userA < userB
    ? { userIdLow: userA, userIdHigh: userB }
    : { userIdLow: userB, userIdHigh: userA };
}

function relationshipCondition(userA: string, userB: string) {
  const pair = canonicalPair(userA, userB);
  return and(eq(buddiesTable.userIdLow, pair.userIdLow), eq(buddiesTable.userIdHigh, pair.userIdHigh));
}

function parseBuddyId(req: { params: Record<string, string | string[]> }) {
  return buddyParamsSchema.safeParse({
    userId: Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId,
  });
}

async function findProfile(userId: string) {
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
  return profile;
}

async function lockRelationship(
  tx: Pick<typeof db, "select">,
  userA: string,
  userB: string,
) {
  // Hold this row lock until the surrounding transaction completes. A DELETE
  // (or status-changing UPDATE) must wait until the authorized private reads finish.
  const [relationship] = await tx
    .select()
    .from(buddiesTable)
    .where(relationshipCondition(userA, userB))
    .limit(1)
    .for("share");
  return relationship;
}

async function getActivitySummary(tx: Pick<typeof db, "select">, userId: string) {
  const [counts, ...itemGroups] = await Promise.all([
    tx
      .select({ status: entriesTable.status, total: count() })
      .from(entriesTable)
      .where(eq(entriesTable.userId, userId))
      .groupBy(entriesTable.status),
    ...(["watching", "plan_to_watch", "completed"] as const).map((status) =>
      tx
        .select({
          title: entriesTable.title,
          posterUrl: entriesTable.posterUrl,
          type: entriesTable.type,
          status: entriesTable.status,
          tmdbId: entriesTable.tmdbId,
        })
        .from(entriesTable)
        .where(and(eq(entriesTable.userId, userId), eq(entriesTable.status, status)))
        .orderBy(desc(entriesTable.createdAt))
        .limit(6),
    ),
  ]);
  const countByStatus = new Map(counts.map((row) => [row.status, row.total]));
  const statuses = ["watching", "plan_to_watch", "completed"] as const;
  return Object.fromEntries(
    statuses.map((status, index) => [
      status,
      {
        count: countByStatus.get(status) ?? 0,
        items: itemGroups[index].map((row) => ({
          ...row,
          posterUrl: row.posterUrl ?? null,
          tmdbId: row.tmdbId ?? null,
        })),
      },
    ]),
  );
}

function favorites(titles: string[] | null, posters: (string | null)[] | null) {
  return (titles ?? []).slice(0, 3).map((title, index) => ({
    title,
    posterUrl: posters?.[index] ?? null,
  }));
}

function getBuddyStatus(currentUserId: string, relationship?: typeof buddiesTable.$inferSelect): BuddyStatus {
  if (!relationship) return "none";
  if (relationship.status === "accepted") return "accepted";
  return relationship.requesterId === currentUserId ? "outgoing" : "incoming";
}

router.get("/buddies/search", requireAuth, async (req, res): Promise<void> => {
  const parsed = searchQuerySchema.safeParse({ q: req.query.q });
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a name, username or complete email address (2–254 characters)." });
    return;
  }
  try {
    let emailIds: string[] | null = null;
    if (parsed.data.q.includes("@")) {
      const address = z.string().email().safeParse(parsed.data.q.toLowerCase());
      if (!address.success) { res.json({ results: [] }); return; }
      const now = Date.now();
      const window = emailSearchWindows.get(req.userId);
      if (window && now - window.start < 60000 && window.count >= 15) {
        res.status(429).json({ error: "Too many email searches. Please wait a minute." }); return;
      }
      if (window && now - window.start < 60000) window.count++;
      else {
        if (emailSearchWindows.size >= 1000) emailSearchWindows.delete(emailSearchWindows.keys().next().value!);
        emailSearchWindows.set(req.userId, { start: now, count: 1 });
      }
      // Exact, authenticated lookup only. Never expose or index people's email addresses.
      const users = await clerkClient.users.getUserList({ emailAddress: [address.data], limit: 10 });
      emailIds = verifiedEmailUserIds(users.data, address.data);
      if (!emailIds.length) { res.json({ results: [] }); return; }
    }
    const escapedQuery = parsed.data.q.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escapedQuery}%`;
    const matches = await db
      .select(identityFields)
      .from(profilesTable)
      .where(
        and(
          sql`${profilesTable.userId} <> ${req.userId}`,
          emailIds ? inArray(profilesTable.userId, emailIds) : or(
            ilike(profilesTable.firstName, pattern),
            ilike(profilesTable.lastName, pattern),
            ilike(profilesTable.username, pattern),
            ilike(sql`concat_ws(' ', ${profilesTable.firstName}, ${profilesTable.lastName})`, pattern),
          ),
        ),
      )
      .orderBy(profilesTable.username)
      .limit(20);

    const ids = matches.map((profile) => profile.userId);
    const relationships = ids.length
      ? await db
          .select()
          .from(buddiesTable)
          .where(
            or(
              and(eq(buddiesTable.userIdLow, req.userId), inArray(buddiesTable.userIdHigh, ids)),
              and(eq(buddiesTable.userIdHigh, req.userId), inArray(buddiesTable.userIdLow, ids)),
            ),
          )
      : [];
    const statusByUser = new Map(
      relationships.map((relationship) => [
        relationship.userIdLow === req.userId ? relationship.userIdHigh : relationship.userIdLow,
        relationship.status,
      ]),
    );
    res.json({
      results: matches.map((profile) => ({
        ...serializeIdentity(profile),
        status: getBuddyStatus(
          req.userId,
          relationships.find((relationship) =>
            relationship.userIdLow === profile.userId || relationship.userIdHigh === profile.userId,
          ),
        ),
      })),
    });
  } catch (err) {
    req.log.error("Buddy search failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/buddies", requireAuth, async (req, res): Promise<void> => {
  try {
    const relationships = await db
      .select()
      .from(buddiesTable)
      .where(or(eq(buddiesTable.userIdLow, req.userId), eq(buddiesTable.userIdHigh, req.userId)));
    const acceptedIds: string[] = [];
    const incomingIds: string[] = [];
    const outgoingIds: string[] = [];
    for (const relationship of relationships) {
      const otherUserId = relationship.userIdLow === req.userId ? relationship.userIdHigh : relationship.userIdLow;
      if (relationship.status === "accepted") acceptedIds.push(otherUserId);
      else if (relationship.requesterId === req.userId) outgoingIds.push(otherUserId);
      else incomingIds.push(otherUserId);
    }
    const allIds = [...new Set([...acceptedIds, ...incomingIds, ...outgoingIds])];
    const profiles = allIds.length
      ? await db.select(listPersonFields).from(profilesTable).where(inArray(profilesTable.userId, allIds))
      : [];
    const byId = new Map(profiles.map((profile) => [profile.userId, profile]));
    res.json({
      accepted: acceptedIds.map((id) => byId.get(id)).filter((profile): profile is (typeof profiles)[number] => !!profile)
        .map((profile) => ({ ...serializeIdentity(profile), status: "accepted" as const })),
      incoming: incomingIds.map((id) => byId.get(id)).filter((profile): profile is (typeof profiles)[number] => !!profile)
        .map((profile) => ({ ...serializeIdentity(profile), status: "incoming" as const })),
      outgoing: outgoingIds.map((id) => byId.get(id)).filter((profile): profile is (typeof profiles)[number] => !!profile)
        .map((profile) => ({ ...serializeIdentity(profile), status: "outgoing" as const })),
    });
  } catch (err) {
    req.log.error({ err }, "listBuddies error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/buddies/:userId/entries", requireAuth, async (req, res): Promise<void> => {
  const params = parseBuddyId(req);
  const query = entryQuerySchema.safeParse({
    status: req.query.status,
    limit: req.query.limit,
    offset: req.query.offset,
  });
  if (!params.success || !query.success) {
    res.status(400).json({ error: "Invalid buddy id, status, or pagination" });
    return;
  }
  if (params.data.userId === req.userId) {
    res.status(400).json({ error: "Cannot view your own buddy entries" });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [target] = await tx
        .select({ userId: profilesTable.userId })
        .from(profilesTable)
        .where(eq(profilesTable.userId, params.data.userId))
        .limit(1);
      if (!target) return { error: "profile-not-found" as const };
      const relationship = await lockRelationship(tx, req.userId, params.data.userId);
      if (relationship?.status !== "accepted") return { error: "not-accepted" as const };

      const where = and(eq(entriesTable.userId, params.data.userId), eq(entriesTable.status, query.data.status));
      const [totalRow] = await tx.select({ total: count() }).from(entriesTable).where(where);
      const entries = await tx
        .select({
          title: entriesTable.title,
          type: entriesTable.type,
          tmdbId: entriesTable.tmdbId,
          status: entriesTable.status,
          posterUrl: entriesTable.posterUrl,
        })
        .from(entriesTable)
        .where(where)
        .orderBy(desc(entriesTable.createdAt))
        .limit(query.data.limit)
        .offset(query.data.offset);
      return {
        page: {
          items: entries.map((entry) => ({
            ...entry,
            tmdbId: entry.tmdbId ?? null,
            posterUrl: entry.posterUrl ?? null,
          })),
          total: totalRow?.total ?? 0,
          limit: query.data.limit,
          offset: query.data.offset,
        },
      };
    });
    if ("error" in result && result.error === "profile-not-found") {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    if ("error" in result) {
      res.status(403).json({ error: "An accepted buddy relationship is required" });
      return;
    }
    res.json(result.page);
  } catch (err) {
    req.log.error({ err }, "getBuddyEntries error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/buddies/:userId/request", requireAuth, async (req, res): Promise<void> => {
  const params = parseBuddyId(req);
  if (!params.success) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  const targetUserId = params.data.userId;
  if (targetUserId === req.userId) {
    res.status(400).json({ error: "You cannot send a buddy request to yourself" });
    return;
  }
  try {
    if (!(await findProfile(targetUserId))) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const pair = canonicalPair(req.userId, targetUserId);
    const [inserted] = await db
      .insert(buddiesTable)
      .values({ ...pair, requesterId: req.userId, status: "pending" })
      .onConflictDoNothing({ target: [buddiesTable.userIdLow, buddiesTable.userIdHigh] })
      .returning();
    if (!inserted) {
      res.status(409).json({ error: "A buddy relationship or pending request already exists" });
      return;
    }
    res.status(201).json({ userId: targetUserId, status: "pending", direction: "outgoing" });
  } catch (err) {
    req.log.error({ err }, "requestBuddy error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/buddies/:userId/accept", requireAuth, async (req, res): Promise<void> => {
  const params = parseBuddyId(req);
  if (!params.success) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  const targetUserId = params.data.userId;
  if (targetUserId === req.userId) {
    res.status(404).json({ error: "Incoming buddy request not found" });
    return;
  }
  try {
    if (!(await findProfile(targetUserId))) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const pair = canonicalPair(req.userId, targetUserId);
    const [accepted] = await db
      .update(buddiesTable)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(
        and(
          eq(buddiesTable.userIdLow, pair.userIdLow),
          eq(buddiesTable.userIdHigh, pair.userIdHigh),
          eq(buddiesTable.requesterId, targetUserId),
          eq(buddiesTable.status, "pending"),
        ),
      )
      .returning({ userId: buddiesTable.userIdLow });
    if (!accepted) {
      res.status(404).json({ error: "Incoming buddy request not found" });
      return;
    }
    res.json({ userId: targetUserId, status: "accepted", direction: "accepted" });
  } catch (err) {
    req.log.error({ err }, "acceptBuddyRequest error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/buddies/:userId", requireAuth, async (req, res): Promise<void> => {
  const params = parseBuddyId(req);
  if (!params.success) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [profile] = await tx
        .select(detailPersonFields)
        .from(profilesTable)
        .where(eq(profilesTable.userId, params.data.userId))
        .limit(1);
      if (!profile) return { error: "profile-not-found" as const };

      const relationship = params.data.userId === req.userId
        ? undefined
        : await lockRelationship(tx, req.userId, params.data.userId);
      const status = getBuddyStatus(req.userId, relationship);
      const isAcceptedBuddy = status === "accepted";
      let shelves: Awaited<ReturnType<typeof getActivitySummary>> | undefined;
      let favoritesResult: { tv: ReturnType<typeof favorites>; movies: ReturnType<typeof favorites> } | undefined;
      if (isAcceptedBuddy) {
        shelves = await getActivitySummary(tx, profile.userId);
        favoritesResult = {
          tv: favorites(profile.topTvShows, profile.topTvShowPosters),
          movies: favorites(profile.topMovies, profile.topMoviePosters),
        };
      }
      return {
        person: {
          ...serializeIdentity(profile),
          ...(isAcceptedBuddy ? { bio: profile.bio ?? null } : {}),
          status,
        },
        status,
        ...(isAcceptedBuddy ? { favorites: favoritesResult, shelves } : {}),
      };
    });
    if ("error" in result) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "getBuddyProfile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/buddies/:userId", requireAuth, async (req, res): Promise<void> => {
  const params = parseBuddyId(req);
  if (!params.success) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  if (params.data.userId === req.userId) {
    res.status(400).json({ error: "You cannot remove yourself" });
    return;
  }
  try {
    await db.delete(buddiesTable).where(relationshipCondition(req.userId, params.data.userId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "removeBuddy error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;