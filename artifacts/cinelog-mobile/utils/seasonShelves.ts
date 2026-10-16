export interface ShelfSeason {
  number: number;
  status: string;
  dateWatched?: string | null;
  rating?: number | null;
}

interface ShelfEntry {
  id: number;
  title: string;
  type: string;
  seasons?: ShelfSeason[] | null;
  trackingMode?: string | null;
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
  return entries.flatMap(entry => {
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
