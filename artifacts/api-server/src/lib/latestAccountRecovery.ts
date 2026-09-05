import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const RECOVERY_TARGET_USER_ID = "user_3IuJSgUX7FQCRz3x5NVuM85dZcd";
const RECOVERY_SOURCE_USER_ID = "user_3HKn9PVjvBPh17MkOfzmqG2oYQV";
const RECOVERY_OBJECT_SUFFIX = "account-recovery/latest-library.json";
const EXPECTED_SOURCE_ENTRY_COUNT = 94;
const EXPECTED_MERGED_ENTRY_COUNT = 103;
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

type RecoverySnapshot = {
  version: number;
  sourceUserId: string;
  profile: Record<string, unknown>;
  entries: Array<Record<string, unknown>>;
  recommendationFeedback: Array<Record<string, unknown>>;
  recommendationHistory: Array<Record<string, unknown>>;
};

function recoveryObjectLocation() {
  const privateDir = process.env.PRIVATE_OBJECT_DIR?.replace(/\/$/, "");
  if (!privateDir) {
    throw new Error("PRIVATE_OBJECT_DIR is unavailable");
  }

  const parts = `${privateDir}/${RECOVERY_OBJECT_SUFFIX}`
    .replace(/^\//, "")
    .split("/");
  const bucketName = parts.shift();
  const objectName = parts.join("/");
  if (!bucketName || !objectName) {
    throw new Error("Private recovery object path is invalid");
  }
  return { bucketName, objectName };
}

async function signRecoveryObjectUrl(method: "GET" | "DELETE") {
  const { bucketName, objectName } = recoveryObjectLocation();
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket_name: bucketName,
        object_name: objectName,
        method,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Could not sign private recovery object request (${response.status})`,
    );
  }

  const payload = (await response.json()) as { signed_url?: string };
  if (!payload.signed_url) {
    throw new Error("Private recovery object request returned no URL");
  }
  return payload.signed_url;
}

function isRecoverySnapshot(value: unknown): value is RecoverySnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<RecoverySnapshot>;
  return (
    snapshot.version === 1 &&
    snapshot.sourceUserId === RECOVERY_SOURCE_USER_ID &&
    Array.isArray(snapshot.entries) &&
    snapshot.entries.length === EXPECTED_SOURCE_ENTRY_COUNT &&
    Array.isArray(snapshot.recommendationFeedback) &&
    Array.isArray(snapshot.recommendationHistory) &&
    !!snapshot.profile &&
    typeof snapshot.profile === "object"
  );
}

export async function mergeLatestAccountSnapshot(userId: string) {
  if (
    process.env.NODE_ENV !== "production" ||
    userId !== RECOVERY_TARGET_USER_ID
  ) {
    return null;
  }

  const downloadUrl = await signRecoveryObjectUrl("GET");
  const download = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(30_000),
  });

  // The object is intentionally deleted after recovery. Its absence makes
  // every later profile request a no-op.
  if (download.status === 404) return null;
  if (!download.ok) {
    throw new Error(
      `Could not download private recovery snapshot (${download.status})`,
    );
  }

  const rawSnapshot: unknown = await download.json();
  if (!isRecoverySnapshot(rawSnapshot)) {
    throw new Error("Private recovery snapshot failed validation");
  }
  const snapshot = rawSnapshot;
  const entriesJson = JSON.stringify(snapshot.entries);
  const feedbackJson = JSON.stringify(snapshot.recommendationFeedback);
  const historyJson = JSON.stringify(snapshot.recommendationHistory);
  const profileJson = JSON.stringify(snapshot.profile);

  const finalCount = await db.transaction(async (tx) => {
    await tx.execute(sql`
      WITH incoming AS (
        SELECT *
        FROM jsonb_to_recordset(${entriesJson}::jsonb) AS x(
          title text,
          type text,
          status text,
          poster_url text,
          date_watched date,
          year integer,
          rating integer,
          notes text,
          synopsis text,
          tmdb_id integer,
          platform text,
          tags jsonb,
          seasons jsonb,
          created_at timestamp,
          updated_at timestamp
        )
      )
      UPDATE entries AS existing
      SET
        title = incoming.title,
        type = incoming.type,
        status = incoming.status,
        poster_url = incoming.poster_url,
        date_watched = incoming.date_watched,
        year = incoming.year,
        rating = incoming.rating,
        notes = incoming.notes,
        synopsis = incoming.synopsis,
        tmdb_id = incoming.tmdb_id,
        platform = incoming.platform,
        tags = incoming.tags,
        seasons = incoming.seasons,
        created_at = incoming.created_at,
        updated_at = incoming.updated_at
      FROM incoming
      WHERE
        existing.user_id = ${RECOVERY_TARGET_USER_ID}
        AND existing.type = incoming.type
        AND (
          (
            incoming.tmdb_id IS NOT NULL
            AND existing.tmdb_id = incoming.tmdb_id
          )
          OR (
            incoming.tmdb_id IS NULL
            AND existing.tmdb_id IS NULL
            AND lower(existing.title) = lower(incoming.title)
          )
        )
    `);

    await tx.execute(sql`
      WITH incoming AS (
        SELECT *
        FROM jsonb_to_recordset(${entriesJson}::jsonb) AS x(
          title text,
          type text,
          status text,
          poster_url text,
          date_watched date,
          year integer,
          rating integer,
          notes text,
          synopsis text,
          tmdb_id integer,
          platform text,
          tags jsonb,
          seasons jsonb,
          created_at timestamp,
          updated_at timestamp
        )
      )
      INSERT INTO entries (
        title,
        type,
        status,
        poster_url,
        date_watched,
        year,
        rating,
        notes,
        synopsis,
        tmdb_id,
        platform,
        user_id,
        tags,
        seasons,
        created_at,
        updated_at
      )
      SELECT
        incoming.title,
        incoming.type,
        incoming.status,
        incoming.poster_url,
        incoming.date_watched,
        incoming.year,
        incoming.rating,
        incoming.notes,
        incoming.synopsis,
        incoming.tmdb_id,
        incoming.platform,
        ${RECOVERY_TARGET_USER_ID},
        incoming.tags,
        incoming.seasons,
        incoming.created_at,
        incoming.updated_at
      FROM incoming
      WHERE NOT EXISTS (
        SELECT 1
        FROM entries AS existing
        WHERE
          existing.user_id = ${RECOVERY_TARGET_USER_ID}
          AND existing.type = incoming.type
          AND (
            (
              incoming.tmdb_id IS NOT NULL
              AND existing.tmdb_id = incoming.tmdb_id
            )
            OR (
              incoming.tmdb_id IS NULL
              AND existing.tmdb_id IS NULL
              AND lower(existing.title) = lower(incoming.title)
            )
          )
      )
    `);

    await tx.execute(sql`
      INSERT INTO recommendation_feedback (user_id, tmdb_id, signal, created_at)
      SELECT
        ${RECOVERY_TARGET_USER_ID},
        incoming.tmdb_id,
        incoming.signal,
        incoming.created_at
      FROM jsonb_to_recordset(${feedbackJson}::jsonb) AS incoming(
        tmdb_id integer,
        signal text,
        created_at timestamp
      )
      ON CONFLICT (user_id, tmdb_id)
      DO UPDATE SET
        signal = EXCLUDED.signal,
        created_at = EXCLUDED.created_at
    `);

    await tx.execute(sql`
      INSERT INTO recommendation_history (user_id, tmdb_id, shown_at)
      SELECT
        ${RECOVERY_TARGET_USER_ID},
        incoming.tmdb_id,
        incoming.shown_at
      FROM jsonb_to_recordset(${historyJson}::jsonb) AS incoming(
        tmdb_id integer,
        shown_at timestamp
      )
      ON CONFLICT (user_id, tmdb_id)
      DO UPDATE SET shown_at = EXCLUDED.shown_at
    `);

    await tx.execute(sql`
      WITH incoming AS (
        SELECT *
        FROM jsonb_to_record(${profileJson}::jsonb) AS x(
          first_name text,
          last_name text,
          bio text,
          top_tv_shows jsonb,
          top_movies jsonb,
          top_tv_show_posters jsonb,
          top_movie_posters jsonb,
          avatar_id text,
          avatar_url text,
          facebook_id text,
          onboarding_completed boolean
        )
      )
      UPDATE profiles AS target
      SET
        first_name = incoming.first_name,
        last_name = incoming.last_name,
        bio = incoming.bio,
        top_tv_shows = incoming.top_tv_shows,
        top_movies = incoming.top_movies,
        top_tv_show_posters = incoming.top_tv_show_posters,
        top_movie_posters = incoming.top_movie_posters,
        avatar_id = incoming.avatar_id,
        avatar_url = incoming.avatar_url,
        facebook_id = incoming.facebook_id,
        onboarding_completed = incoming.onboarding_completed,
        updated_at = NOW()
      FROM incoming
      WHERE target.user_id = ${RECOVERY_TARGET_USER_ID}
    `);

    const countResult = await tx.execute(sql`
      SELECT COUNT(*)::integer AS count
      FROM entries
      WHERE user_id = ${RECOVERY_TARGET_USER_ID}
    `);
    const count = Number(countResult.rows[0]?.count ?? 0);
    if (count !== EXPECTED_MERGED_ENTRY_COUNT) {
      throw new Error(
        `Recovery expected ${EXPECTED_MERGED_ENTRY_COUNT} entries but found ${count}`,
      );
    }
    return count;
  });

  const deleteUrl = await signRecoveryObjectUrl("DELETE");
  const deletion = await fetch(deleteUrl, {
    method: "DELETE",
    signal: AbortSignal.timeout(30_000),
  });
  if (!deletion.ok && deletion.status !== 404) {
    throw new Error(
      `Recovery succeeded but private snapshot cleanup failed (${deletion.status})`,
    );
  }

  return { entryCount: finalCount };
}