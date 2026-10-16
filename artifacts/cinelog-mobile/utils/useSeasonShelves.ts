import { useQueries } from '@tanstack/react-query';
import { authFetch } from './authFetch';
import { getShowTrackingMode, projectSeasonShelves } from './seasonShelves';

/** Retrieve actual seasonal artwork, including for progress saved by older builds. */
export function useSeasonShelves(entries: any[]) {
  const shows = [...new Map(entries
    .filter(entry => entry.type === 'show' && entry.tmdbId && entry.seasons?.length &&
      getShowTrackingMode(entry) === 'seasons')
    .map(entry => [entry.tmdbId, entry])).values()];
  const queries = useQueries({ queries: shows.map(show => ({
    queryKey: ['season-shelf-artwork', show.tmdbId],
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      if (!domain) throw new Error('The API domain is not configured.');
      const response = await authFetch(`https://${domain}/api/tmdb/show/${show.tmdbId}`);
      if (!response.ok) throw new Error('Season artwork could not be loaded.');
      return response.json() as Promise<{ seasons: { number: number; posterUrl: string | null }[] }>;
    },
  })) });
  const posters: Record<string, string | null> = {};
  entries.forEach(entry => {
    const index = shows.findIndex(show => show.tmdbId === entry.tmdbId);
    queries[index]?.data?.seasons?.forEach(season => {
      posters[`${entry.id}:${season.number}`] = season.posterUrl;
    });
  });
  return {
    entries: projectSeasonShelves(entries, posters),
    artworkError: queries.some(query => query.isError),
    refetchArtwork: () => Promise.all(queries.map(query => query.refetch())),
  };
}
