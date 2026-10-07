import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { escapeHtml, summariseRatings } from "../lib/communityRatings";
import { seasonRatingsQuery, summariseSeasonRatings } from "../lib/seasonCommunityRatings";

const router = Router();
// Verified against deployment metadata; never derive public links from preview/request hosts.
const PUBLIC_SITE = "https://couch-potato.replit.app";
const identity = z.object({ type: z.enum(["movie", "show"]), tmdbId: z.coerce.number().int().positive().max(2147483647) });
const titleCache = new Map<string, { expires: number; value: PublicTitle }>();
type PublicTitle = { tmdbId: number; type: "movie" | "show"; title: string; year: number | null; posterUrl: string | null; synopsis: string; shareUrl: string; appUrl: string };

async function titleDetails(type: "movie" | "show", tmdbId: number): Promise<PublicTitle | null> {
  const key = `${type}:${tmdbId}`;
  const cached = titleCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  if (!process.env.TMDB_API_KEY) throw new Error("Title provider unavailable");
  const url = new URL(`https://api.themoviedb.org/3/${type === "show" ? "tv" : "movie"}/${tmdbId}`);
  url.searchParams.set("api_key", process.env.TMDB_API_KEY);
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Title provider unavailable");
  const body = await response.json() as { title?: string; name?: string; release_date?: string; first_air_date?: string; poster_path?: string; overview?: string };
  const title = body.title ?? body.name;
  if (!title) throw new Error("Title provider returned invalid data");
  const date = body.release_date ?? body.first_air_date;
  const year = date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;
  const value: PublicTitle = { type, tmdbId, title, year,
    posterUrl: body.poster_path ? `https://image.tmdb.org/t/p/w500${body.poster_path}` : null,
    synopsis: body.overview ?? "",
    shareUrl: `${PUBLIC_SITE}/api/share/${type}/${tmdbId}`,
    appUrl: `couchpotato://title/${type}/${tmdbId}` };
  if (titleCache.size >= 500) titleCache.delete(titleCache.keys().next().value!);
  titleCache.set(key, { expires: Date.now() + 3600000, value });
  return value;
}

async function community(type: "movie" | "show", tmdbId: number) {
  // Rewatch entries must not multiply a member's vote; movie/TV identities stay separate.
  const result = await db.execute(sql`
    SELECT rating AS stars, count(*)::int AS count FROM (
      SELECT DISTINCT ON (user_id) rating FROM entries
      WHERE tmdb_id = ${tmdbId} AND type = ${type}
      ORDER BY user_id, updated_at DESC, id DESC
    ) current_ratings WHERE rating BETWEEN 1 AND 5 GROUP BY rating`);
  return summariseRatings(result.rows.map(row => ({ stars: Number(row.stars), count: Number(row.count) })));
}

async function showSeasonCommunity(tmdbId: number) {
  const result = await db.execute(seasonRatingsQuery(tmdbId));
  return summariseSeasonRatings(result.rows.map(row => ({
    seasonNumber: Number(row.seasonNumber), stars: Number(row.stars), count: Number(row.count),
  })));
}

router.get("/social/config", (_req, res) => {
  res.json({ inviteUrl: PUBLIC_SITE, inviteMessage: `Join me on Spud! Track movies and TV, share recommendations and find your buddies. ${PUBLIC_SITE}` });
});
router.get("/community/ratings/show/:tmdbId/seasons", async (req, res) => {
  const parsed = identity.safeParse({ type: "show", tmdbId: req.params.tmdbId });
  if (!parsed.success) { res.status(400).json({ error: "Invalid show identity" }); return; }
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(await showSeasonCommunity(parsed.data.tmdbId));
  } catch {
    res.status(503).json({ error: "Season community ratings are unavailable. Please try again." });
  }
});
router.get("/community/ratings/:type/:tmdbId", async (req, res) => {
  const parsed = identity.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid title identity" }); return; }
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(await community(parsed.data.type, parsed.data.tmdbId));
  } catch {
    res.status(503).json({ error: "Community ratings are unavailable. Please try again." });
  }
});
router.get("/titles/:type/:tmdbId", async (req, res) => {
  const parsed = identity.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid title identity" }); return; }
  try {
    const title = await titleDetails(parsed.data.type, parsed.data.tmdbId);
    if (!title) { res.status(404).json({ error: "Title not found" }); return; }
    res.json(title);
  } catch {
    res.status(503).json({ error: "Title details are unavailable. Please try again." });
  }
});
router.get("/share/unmatched", (req, res) => {
  const parsed = z.object({ type: z.enum(["movie", "show"]), title: z.string().trim().min(1).max(300) }).safeParse(req.query);
  if (!parsed.success) { res.status(400).send("Invalid title"); return; }
  const { title, type } = parsed.data;
  const e = escapeHtml;
  const url = `${PUBLIC_SITE}/api/share/unmatched?type=${type}&title=${encodeURIComponent(title)}`;
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.type("html").send(`<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · Spud</title><meta property="og:type" content="website"><meta property="og:title" content="Check out ${e(title)} on Spud"><meta property="og:description" content="A ${type === "movie" ? "movie" : "TV show"} shared on Spud. Track what you watch and find your buddies."><meta property="og:url" content="${e(url)}"><style>body{margin:0;background:#0F2D1C;color:#fff;font-family:system-ui;padding:40px 20px}main{max-width:580px;margin:auto}h1{font-size:32px}p{line-height:1.6;color:#ddd}a{display:inline-block;background:#D4F5A0;color:#0F2D1C;border-radius:12px;padding:14px 20px;text-decoration:none;margin:8px 8px 8px 0}</style></head><body><main><p>SPUD · ${type === "movie" ? "MOVIE" : "TV SHOW"}</p><h1>${e(title)}</h1><p>This title has not been matched to the movie database yet, so a poster and community rating are not available. You can still log it manually in Spud.</p><a href="couchpotato://">Open Spud</a><a href="${PUBLIC_SITE}/">Join Spud on the web</a><p>Only this title name is shared. Personal notes and watch history stay private.</p></main></body></html>`);
});
router.get("/share/:type/:tmdbId", async (req, res) => {
  const parsed = identity.safeParse(req.params);
  if (!parsed.success) { res.status(400).send("Invalid title"); return; }
  try {
    const title = await titleDetails(parsed.data.type, parsed.data.tmdbId);
    if (!title) { res.status(404).send("Title not found"); return; }
    const scores = await community(title.type, title.tmdbId);
    const e = escapeHtml;
    const label = `${title.title}${title.year ? ` (${title.year})` : ""}`;
    const bars = scores.distribution.map(b => `<div class="bucket"><span>${b.stars} star</span><div class="track"><div style="width:${b.percentage}%"></div></div><span>${b.count}</span></div>`).join("");
    const seasonScores = title.type === "show" ? await showSeasonCommunity(title.tmdbId) : null;
    const seasonHtml = !seasonScores ? "" : `<section><h2>Season community ratings</h2>${seasonScores.seasons.length
      ? seasonScores.seasons.map(season => `<h3>Season ${season.seasonNumber}</h3><p>${season.average} / 5 · ${season.count} rating${season.count === 1 ? "" : "s"}</p>${season.distribution.map(b => `<div class="bucket"><span>${b.stars} star</span><div class="track"><div style="width:${b.percentage}%"></div></div><span>${b.count}</span></div>`).join("")}`).join("")
      : "<p>No season ratings yet.</p>"}<p>Each season has a separate score. Season ratings do not change the overall show rating.</p></section>`;
    res.setHeader("Content-Security-Policy", "default-src 'none'; img-src https://image.tmdb.org; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.type("html").send(`<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(label)} · Spud</title><meta property="og:type" content="website"><meta property="og:title" content="Check out ${e(label)} on Spud"><meta property="og:description" content="${e(title.synopsis.slice(0, 200))}"><meta property="og:url" content="${e(title.shareUrl)}">${title.posterUrl ? `<meta property="og:image" content="${e(title.posterUrl)}">` : ""}<meta name="twitter:card" content="summary_large_image"><style>body{margin:0;background:#0F2D1C;color:#fff;font-family:system-ui;padding:32px 20px}main{max-width:580px;margin:auto}img{width:180px;border-radius:16px}h1{font-size:32px}p{line-height:1.6;color:#ddd}a{display:inline-block;background:#D4F5A0;color:#0F2D1C;border-radius:12px;padding:14px 20px;text-decoration:none;margin:8px 8px 8px 0}section{margin-top:40px}.bucket{display:flex;gap:12px;align-items:center;margin:12px 0}.track{flex:1;height:8px;background:#38513e;border-radius:8px;overflow:hidden}.track div{height:100%;background:#FFD34D}</style></head><body><main><p>SPUD · ${title.type === "movie" ? "MOVIE" : "TV SHOW"}</p>${title.posterUrl ? `<img src="${e(title.posterUrl)}" alt="${e(title.title)} poster">` : ""}<h1>${e(label)}</h1><p>${e(title.synopsis)}</p><a href="${e(title.appUrl)}">Open in Spud</a><a href="${PUBLIC_SITE}/">Join Spud on the web</a><section><h2>${title.type === "show" ? "Overall show community rating" : "Spud community ratings"}</h2><p>${scores.count ? `${scores.average} / 5 · ${scores.count} rating${scores.count === 1 ? "" : "s"}` : "No community ratings yet. Be the first to rate this title on Spud."}</p>${bars}<p>Anonymous ratings from Spud members. Personal notes and watch history stay private.</p></section>${seasonHtml}<p>Movie and TV information provided by TMDB.</p></main></body></html>`);
  } catch {
    res.status(503).type("html").send("<!doctype html><title>Spud</title><p>This title is temporarily unavailable. Please try again.</p>");
  }
});
export default router;
