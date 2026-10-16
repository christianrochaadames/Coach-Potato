export interface ShelfSeason {
  number: number;
  status: string;
  dateWatched?: string | null;
  rating?: number | null;
  notes?: string | null;
  episodes?: Array<{ number: number; [key: string]: unknown }>;
}

interface ShelfEntry {
  id: number;
  title: string;
  type: string;
  seasons?: ShelfSeason[] | null;
  trackingMode?: string | null;
  tmdbId?: number | null;
  userId?: string;
  updatedAt?: string | Date;
  createdAt?: string | Date;
}

/** Old clients could create two parent records. Present each title/season once. */
export function uniqueShelfEntries<T extends ShelfEntry>(entries: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const key = JSON.stringify([entry.userId ?? '', entry.type, entry.tmdbId != null
      ? `tmdb:${entry.tmdbId}` : `title:${entry.title.trim().toLocaleLowerCase()}`]);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups.values()].map(group => {
    if (group.length === 1) return group[0];
    const sorted = [...group].sort((a, b) =>
      new Date(a.updatedAt ?? a.createdAt ?? 0).getTime() -
      new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() || a.id - b.id);
    const seasons = new Map<number, ShelfSeason>();
    for (const entry of sorted) for (const season of entry.seasons ?? []) {
      const previous = seasons.get(season.number);
      const episodes = new Map<number, NonNullable<ShelfSeason['episodes']>[number]>();
      for (const episode of [...(previous?.episodes ?? []), ...(season.episodes ?? [])]) {
        episodes.set(episode.number, { ...episodes.get(episode.number), ...episode });
      }
      const notes = [...new Set([previous?.notes?.trim(), season.notes?.trim()].filter(Boolean))];
      seasons.set(season.number, {
        ...previous, ...season,
        ...(notes.length ? { notes: notes.join('\n\n') } : {}),
        ...((previous?.episodes || season.episodes) ? { episodes: [...episodes.values()] } : {}),
      });
    }
    return {
      ...sorted[sorted.length - 1],
      id: Math.min(...group.map(entry => entry.id)),
      seasons: [...seasons.values()].sort((a, b) => a.number - b.number),
    };
  });
}

/** Explicit preference wins; legacy seasonal history remains seasonal by default. */
export function getShowTrackingMode(entry?: Pick<ShelfEntry, 'trackingMode' | 'seasons'> | null): 'whole_show' | 'seasons' {
  if (entry?.trackingMode === 'whole_show' || entry?.trackingMode === 'seasons') return entry.trackingMode;
  return entry?.seasons?.some(season => season.number >= 1 &&
    ['watched', 'watching', 'plan_to_watch'].includes(season.status)) ? 'seasons' : 'whole_show';
}

/** Season cards are views of the original record, never duplicate database entries. */
export function projectSeasonShelves<T extends ShelfEntry>(
  entries: T[],
  posters: Record<string, string | null> = {},
) {
  return uniqueShelfEntries(entries).flatMap(entry => {
    const seasons = entry.type === 'show'
      ? (entry.seasons ?? []).filter(season =>
        season.number >= 1 && ['watched', 'watching', 'plan_to_watch'].includes(season.status))
      : [];
    if (entry.type !== 'show' || getShowTrackingMode(entry) === 'whole_show') return [{
      ...entry, shelfKey: String(entry.id), shelfTitle: entry.title,
      seasonNumber: null as number | null, parentEntry: entry,
    }];
    return [...new Map(seasons.map(season => [season.number, season])).values()].map(season => ({
      ...entry,
      shelfKey: `${entry.id}:season:${season.number}`,
      shelfTitle: `${entry.title} · Season ${season.number}`,
      seasonNumber: season.number,
      parentEntry: entry,
      status: season.status === 'watched' ? 'completed' : season.status,
      dateWatched: season.dateWatched ?? null,
      year: season.dateWatched ? Number(season.dateWatched.slice(0, 4)) : null,
      rating: season.rating ?? null,
      // Do not misrepresent the series artwork as a season poster.
      posterUrl: posters[`${entry.id}:${season.number}`] ?? null,
    }));
  });
}
