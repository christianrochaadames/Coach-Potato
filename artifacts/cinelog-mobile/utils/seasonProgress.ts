export type SeasonStatus = 'watched' | 'watching' | 'plan_to_watch';
export interface SeasonDraft {
  number: number; status: SeasonStatus; year: number; rating: number;
}

/** Preserve notes, episode progress and other seasons while changing watch metadata. */
export function upsertSeasonProgress<T extends { number: number }>(records: T[], draft: SeasonDraft) {
  if (!Number.isInteger(draft.number) || draft.number < 1 ||
      !['watched', 'watching', 'plan_to_watch'].includes(draft.status) ||
      !Number.isInteger(draft.year) || draft.year < 1900 || draft.year > new Date().getFullYear() ||
      !Number.isInteger(draft.rating) || draft.rating < 0 || draft.rating > 5) {
    throw new Error('Invalid season watch details.');
  }
  const existing = records.find(record => record.number === draft.number);
  return [
    ...records.filter(record => record.number !== draft.number),
    {
      ...existing,
      number: draft.number,
      status: draft.status,
      dateWatched: draft.status === 'watched' ? `${draft.year}-01-01` : null,
      rating: draft.status === 'watched' ? draft.rating || null : null,
    },
  ].sort((a, b) => a.number - b.number);
}
