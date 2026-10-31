type SeasonSummary = {
  number: number;
  episodeCount?: number | null;
  posterUrl?: string | null;
  airYear?: number | null;
};

/** A numbered announcement alone is not enough to display a season. */
export function isVisibleSeason(season: SeasonSummary): boolean {
  return season.number > 0 && (
    (season.episodeCount ?? 0) > 0 ||
    Boolean(season.posterUrl?.trim()) ||
    (Number.isFinite(season.airYear) && (season.airYear ?? 0) > 0)
  );
}
