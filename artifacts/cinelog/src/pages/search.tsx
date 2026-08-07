import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'wouter';
import { Search as SearchIcon, X, Film, Tv, Check, RefreshCw } from 'lucide-react';
import {
  useCreateEntry,
  useListEntries,
  getListEntriesQueryKey,
  getListYearsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface TmdbItem {
  tmdbId: number;
  title: string;
  type: 'movie' | 'show';
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
  genres: string[];
}

function useTmdbSearch(query: string) {
  const [results, setResults] = useState<TmdbItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [noKey, setNoKey] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`);
        if (res.status === 503) { setNoKey(true); setLoading(false); return; }
        const data = await res.json();
        setResults(data.results ?? []);
        setNoKey(false);
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading, noKey };
}

function useTmdbPopular(page: number) {
  const [data, setData] = useState<{ movies: TmdbItem[]; shows: TmdbItem[] } | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tmdb/popular?page=${page}`)
      .then(r => {
        if (r.status === 503) { setNoKey(true); setLoading(false); return null; }
        return r.json();
      })
      .then(d => { if (d) { setData(d); } setLoading(false); })
      .catch(() => setLoading(false));
  }, [page]);

  return { data, noKey, loading };
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [, setLocation] = useLocation();
  const [addingItem, setAddingItem] = useState<TmdbItem | null>(null);
  const [quickAddYear, setQuickAddYear] = useState(new Date().getFullYear());
  const [watchedStep, setWatchedStep] = useState(false); // true = show year picker after clicking Watched
  const [popularPage, setPopularPage] = useState(1);
  const [spinning, setSpinning] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleRefresh = () => {
    setSpinning(true);
    setPopularPage(p => (p % 5) + 1);
    setTimeout(() => setSpinning(false), 600);
  };

  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    const main = document.querySelector('main') as HTMLElement | null;
    const wrapper = main?.parentElement as HTMLElement | null;
    const prevMain = main?.style.background ?? '';
    const prevWrapper = wrapper?.style.background ?? '';
    document.documentElement.style.background = '#FFBC4D';
    document.body.style.background = '#FFBC4D';
    if (main) main.style.background = '#FFBC4D';
    if (wrapper) wrapper.style.background = '#FFBC4D';
    return () => {
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
      if (main) main.style.background = prevMain;
      if (wrapper) wrapper.style.background = prevWrapper;
    };
  }, []);

  // Provider dedup helper
  const dedupProviders = (raw: { providerId: number; providerName: string; logoUrl: string }[]) => {
    const normalize = (name: string) =>
      name
        .replace(/\s+(Premium|Essential|Basic|Standard)(?=\s|$)/gi, '')
        .replace(/\s*(standard\s+with\s+ads|with\s+ads|basic\s+with\s+ads|\+\s*ads|[\(\[][^)\]]*ads[^)\]]*[\)\]])/gi, '')
        .replace(/\s+(Apple\s+TV|Roku|Amazon|Google\s+Play|Microsoft|Vudu|Xfinity|Cox)(\s+Channel)?/gi, '')
        .replace(/\s+with\s+\S+/gi, '')
        .replace(/\s+on\s+\S+/gi, '')
        .trim();
    const seen = new Map<string, typeof raw[0]>();
    for (const p of raw) {
      const key = normalize(p.providerName).toLowerCase();
      const existing = seen.get(key);
      if (!existing || p.providerName.length < existing.providerName.length) seen.set(key, p);
    }
    return [...seen.values()];
  };

  // Streaming providers for the quick-add sheet
  const [streamingProviders, setStreamingProviders] = useState<{ providerId: number; providerName: string; logoUrl: string }[]>([]);
  useEffect(() => {
    if (!addingItem || addingItem.type !== 'show') { setStreamingProviders([]); return; }
    fetch(`/api/tmdb/tv/${addingItem.tmdbId}/providers?region=US`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setStreamingProviders(dedupProviders(d?.streaming ?? [])))
      .catch(() => setStreamingProviders([]));
  }, [addingItem?.tmdbId]);

  // TMDB community score for the quick-add sheet
  const [sheetTmdbScore, setSheetTmdbScore] = useState<number | null>(null);
  useEffect(() => {
    if (!addingItem) { setSheetTmdbScore(null); return; }
    const endpoint = addingItem.type === 'movie'
      ? `/api/tmdb/movie/${addingItem.tmdbId}`
      : `/api/tmdb/tv/${addingItem.tmdbId}`;
    fetch(endpoint)
      .then(r => r.ok ? r.json() : null)
      .then(d => setSheetTmdbScore(d?.voteAverage ?? null))
      .catch(() => {});
  }, [addingItem?.tmdbId]);

  // Full detail view state
  type CastMember = { name: string; character: string; profileUrl: string | null };
  const [detailItem, setDetailItem] = useState<TmdbItem | null>(null);
  const [detailCast, setDetailCast] = useState<CastMember[]>([]);
  const [detailProviders, setDetailProviders] = useState<{ providerId: number; providerName: string; logoUrl: string }[]>([]);
  const [detailScore, setDetailScore] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!detailItem) { setDetailCast([]); setDetailProviders([]); setDetailScore(null); return; }
    setDetailLoading(true);
    const endpoint = detailItem.type === 'movie'
      ? `/api/tmdb/movie/${detailItem.tmdbId}`
      : `/api/tmdb/tv/${detailItem.tmdbId}`;
    const provPromise = detailItem.type === 'show'
      ? fetch(`/api/tmdb/tv/${detailItem.tmdbId}/providers?region=US`).then(r => r.ok ? r.json() : null)
      : Promise.resolve(null);
    Promise.all([
      fetch(endpoint).then(r => r.ok ? r.json() : null),
      provPromise,
    ]).then(([detail, provData]) => {
      setDetailCast((detail?.cast ?? []).slice(0, 8));
      setDetailScore(detail?.voteAverage ?? null);
      setDetailProviders(provData ? dedupProviders(provData.streaming ?? []) : []);
      setDetailLoading(false);
    }).catch(() => setDetailLoading(false));
  }, [detailItem?.tmdbId]);

  // Auto-focus when arriving from the FAB
  useEffect(() => {
    if (sessionStorage.getItem('search:autofocus') === '1') {
      sessionStorage.removeItem('search:autofocus');
      // Small delay lets the page finish mounting/painting before focus
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, []);
  const { results, loading: searchLoading, noKey: searchNoKey } = useTmdbSearch(query);
  const { data: popular, noKey: popularNoKey, loading: popularLoading } = useTmdbPopular(popularPage);
  const createEntry = useCreateEntry();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Build a set of tmdbIds already in the user's collection for duplicate detection
  const { data: allEntries } = useListEntries({} as any);
  const inCollection = useMemo(() => {
    const s = new Set<number>();
    for (const e of allEntries ?? []) {
      if (e.tmdbId) s.add(e.tmdbId);
    }
    return s;
  }, [allEntries]);

  const getCollectionEntry = (tmdbId: number) =>
    (allEntries ?? []).find((e) => e.tmdbId === tmdbId);

  const noKey = searchNoKey || popularNoKey;

  const closeSheet = () => { setAddingItem(null); setWatchedStep(false); };

  const markWatching = (item: TmdbItem) => {
    createEntry.mutate(
      {
        data: {
          title: item.title,
          type: item.type,
          status: 'watching',
          posterUrl: item.posterUrl ?? undefined,
          synopsis: item.overview ?? undefined,
          tmdbId: item.tmdbId,
          tags: item.genres ?? [],
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: 'Now Watching', description: item.title });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          closeSheet();
        },
        onError: () => toast({ title: 'Error', description: 'Could not mark as watching', variant: 'destructive' }),
      }
    );
  };

  const addToWatchlist = (item: TmdbItem) => {
    createEntry.mutate(
      {
        data: {
          title: item.title,
          type: item.type,
          status: 'plan_to_watch',
          posterUrl: item.posterUrl ?? undefined,
          synopsis: item.overview ?? undefined,
          tmdbId: item.tmdbId,
          tags: item.genres ?? [],
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: 'Added to Watchlist', description: item.title });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          closeSheet();
        },
        onError: () => toast({ title: 'Error', description: 'Could not add to watchlist', variant: 'destructive' }),
      }
    );
  };

  const markWatched = (item: TmdbItem) => {
    createEntry.mutate(
      {
        data: {
          title: item.title,
          type: item.type,
          status: 'completed',
          dateWatched: `${quickAddYear}-01-01`,
          posterUrl: item.posterUrl ?? undefined,
          synopsis: item.overview ?? undefined,
          tmdbId: item.tmdbId,
          tags: item.genres ?? [],
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: 'Logged!', description: `${item.title} added to collection` });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListYearsQueryKey() });
          closeSheet();
        },
        onError: () => toast({ title: 'Error', description: 'Could not log entry', variant: 'destructive' }),
      }
    );
  };

  const renderItem = (item: TmdbItem, i: number) => {
    const alreadyAdded = inCollection.has(item.tmdbId);
    const cardBg = alreadyAdded ? '#FAD4E0' : '#ffffff';
    const cardBorder = alreadyAdded ? '2px solid #7A0020' : '1px solid #E2D9CE';
    return (
    <div
      key={item.tmdbId}
      className="flex items-center gap-3 p-3 rounded-2xl transition-opacity"
      style={{ background: cardBg, border: cardBorder }}
    >
      {/* Poster — opens full detail sheet */}
      <div
        className="w-12 h-16 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer active:opacity-70"
        style={{ background: '#EFE4D2' }}
        onClick={() => setDetailItem(item)}
      >
        {item.posterUrl ? (
          <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover pointer-events-none" />
        ) : (
          item.type === 'movie'
            ? <Film className="w-5 h-5 pointer-events-none" style={{ color: '#7E7A73' }} />
            : <Tv className="w-5 h-5 pointer-events-none" style={{ color: '#7E7A73' }} />
        )}
      </div>
      {/* Info area — opens quick-add sheet */}
      <div className="flex-1 min-w-0 cursor-pointer active:opacity-70" onClick={() => setAddingItem(item)}>
        <div className="flex items-center gap-1.5">
          <p className="font-bold text-sm truncate" style={{ color: '#111111' }}>{item.title}</p>
          {alreadyAdded && (
            <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#7A0020' }}>
              <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
            </span>
          )}
        </div>
        <p className="text-xs" style={{ color: '#7E7A73' }}>
          {item.year ?? '—'} · {item.type === 'movie' ? 'Movie' : 'TV Show'}{alreadyAdded ? ' · In your collection' : ''}
        </p>
      </div>
      {/* Badge — also opens quick-add sheet */}
      <span
        className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 cursor-pointer active:opacity-70"
        style={
          item.type === 'movie'
            ? { background: '#E5FAB0', color: '#2D6A4F', border: '1.5px solid #2D6A4F' }
            : { background: '#DDD8FF', color: '#5B50D0', border: '1.5px solid #5B50D0' }
        }
        onClick={() => setAddingItem(item)}
      >
        {item.type === 'movie' ? 'Movie' : 'TV Show'}
      </span>
    </div>
  );
  };

  return (
    <div style={{ background: '#FFBC4D', minHeight: '100vh' }}>
    <div style={{ background: '#FFF3E8', borderRadius: 28, paddingBottom: 32, marginTop: 24 }}>
      <div className="px-5 pt-8 pb-4">
        <h1 className="text-2xl font-bold mb-4" style={{ color: '#111111' }}>Search</h1>
        {/* Search bar */}
        <div className="relative">
          <SearchIcon
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: '#7E7A73' }}
          />
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search Movies & TV Shows..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3.5 rounded-full font-semibold focus:outline-none"
            style={{
              border: '2px solid #E2D9CE',
              background: '#ffffff',
              color: '#111111',
            }}
            onFocus={e => (e.target.style.borderColor = '#116149')}
            onBlur={e => (e.target.style.borderColor = '#E2D9CE')}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4" style={{ color: '#7E7A73' }} />
            </button>
          )}
        </div>
      </div>

      {noKey && (
        <div
          className="mx-5 mb-4 p-4 rounded-2xl"
          style={{ background: '#FFD34D20', border: '1px solid #FFD34D' }}
        >
          <p className="text-sm font-bold" style={{ color: '#111111' }}>TMDB API Key Missing</p>
          <p className="text-xs mt-1" style={{ color: '#7E7A73' }}>
            Add TMDB_API_KEY as a Replit Secret to enable search. Get a free key at themoviedb.org.
          </p>
        </div>
      )}

      <div className="px-5 space-y-2 pb-8">
        {query.trim() ? (
          <>
            <p className="text-xs font-bold uppercase tracking-wider pb-1" style={{ color: '#7E7A73' }}>
              {searchLoading ? 'Searching...' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
            </p>
            {results.map((item, i) => renderItem(item, i))}
            {!searchLoading && results.length === 0 && (
              <p className="text-center py-10 text-sm" style={{ color: '#7E7A73' }}>
                No results for &ldquo;{query}&rdquo;
              </p>
            )}
          </>
        ) : popular ? (
          <>
            {(() => {
              const freshShows = popular.shows.filter(item => !inCollection.has(item.tmdbId));
              const freshMovies = popular.movies.filter(item => !inCollection.has(item.tmdbId));
              return (
                <>
                  {freshShows.length > 0 && (
                    <>
                      <div className="flex items-center justify-between pb-1">
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7E7A73' }}>Popular TV Shows</p>
                        <button
                          onClick={handleRefresh}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-opacity active:opacity-60"
                          style={{ background: '#EFE4D2', color: '#116149' }}
                          title="Refresh picks"
                        >
                          <RefreshCw className={`w-3 h-3 ${spinning ? 'animate-spin' : ''}`} />
                          Refresh
                        </button>
                      </div>
                      {freshShows.map((item, i) => renderItem(item, i))}
                    </>
                  )}
                  {freshMovies.length > 0 && (
                    <>
                      <div className="flex items-center justify-between pb-1 pt-3">
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7E7A73' }}>Popular Movies</p>
                        {freshShows.length === 0 && (
                          <button
                            onClick={handleRefresh}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-opacity active:opacity-60"
                            style={{ background: '#EFE4D2', color: '#116149' }}
                            title="Refresh picks"
                          >
                            <RefreshCw className={`w-3 h-3 ${spinning ? 'animate-spin' : ''}`} />
                            Refresh
                          </button>
                        )}
                      </div>
                      {freshMovies.map((item, i) => renderItem(item, i))}
                    </>
                  )}
                  {freshShows.length === 0 && freshMovies.length === 0 && (
                    <p className="text-center py-10 text-sm" style={{ color: '#7E7A73' }}>
                      You&apos;ve added everything popular — search to find more!
                    </p>
                  )}
                </>
              );
            })()}
          </>
        ) : !noKey && popularLoading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: '#EFE4D2' }} />
          ))
        ) : null}
      </div>

      {/* Full detail sheet — opens when poster is tapped */}
      {detailItem && (
        <div
          className="fixed inset-0 z-[70] flex items-end"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setDetailItem(null)}
        >
          <div
            className="w-full rounded-t-3xl overflow-y-auto"
            style={{ background: '#ffffff', maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: '#E2D9CE' }} />
            </div>

            <div className="p-6 space-y-5">
              {/* Hero row */}
              <div className="flex gap-4 items-start">
                {detailItem.posterUrl && (
                  <img
                    src={detailItem.posterUrl}
                    alt={detailItem.title}
                    className="w-24 h-36 object-cover rounded-2xl flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0 pt-1">
                  <p className="font-bold text-xl leading-snug" style={{ color: '#111111' }}>{detailItem.title}</p>
                  <p className="text-sm mt-1" style={{ color: '#7E7A73' }}>
                    {detailItem.year ?? '—'} · {detailItem.type === 'movie' ? 'Movie' : 'TV Show'}
                  </p>
                  {detailScore != null && (
                    <p className="text-sm font-bold mt-2" style={{ color: '#116149' }}>
                      ★ {detailScore.toFixed(1)} <span className="font-normal text-xs" style={{ color: '#7E7A73' }}>TMDB</span>
                    </p>
                  )}
                  {/* Collection status badge */}
                  {(() => {
                    const ce = getCollectionEntry(detailItem.tmdbId);
                    if (!ce) return null;
                    const label = ce.status === 'watching' ? '▶ Watching' : ce.status === 'completed' ? '✓ Watched' : '⊞ Watchlist';
                    return (
                      <span className="inline-block mt-2 text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: '#116149' }}>
                        {label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Overview */}
              {detailItem.overview && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#7E7A73' }}>About</p>
                  <p className="text-sm leading-relaxed" style={{ color: '#333333' }}>{detailItem.overview}</p>
                </div>
              )}

              {/* Cast */}
              {detailLoading && (
                <div className="flex gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex-shrink-0 w-14 h-14 rounded-full animate-pulse" style={{ background: '#EFE4D2' }} />
                  ))}
                </div>
              )}
              {!detailLoading && detailCast.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: '#7E7A73' }}>Cast</p>
                  <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                    {detailCast.map((member, i) => (
                      <div key={i} className="flex-shrink-0 w-16 text-center">
                        <div
                          className="w-14 h-14 rounded-full overflow-hidden mx-auto mb-1 flex items-center justify-center"
                          style={{ background: '#EFE4D2' }}
                        >
                          {member.profileUrl ? (
                            <img src={member.profileUrl} alt={member.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-bold" style={{ color: '#116149' }}>{member.name[0]}</span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold leading-tight truncate" style={{ color: '#111111' }}>{member.name}</p>
                        <p className="text-[9px] leading-tight truncate" style={{ color: '#7E7A73' }}>{member.character}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Where to watch */}
              {!detailLoading && detailProviders.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#7E7A73' }}>Where to Watch</p>
                  <div className="flex flex-wrap gap-2.5 items-center">
                    {detailProviders.map(p => (
                      <div key={p.providerName} className="flex items-center gap-1.5">
                        <img src={p.logoUrl} alt={p.providerName} className="w-7 h-7 rounded-lg" />
                        <span className="text-xs font-semibold" style={{ color: '#111111' }}>{p.providerName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Already in collection */}
              {inCollection.has(detailItem.tmdbId) ? (
                <button
                  className="w-full py-3.5 rounded-full font-bold text-sm"
                  style={{ border: '2px solid #116149', color: '#116149', background: 'transparent' }}
                  onClick={() => {
                    const match = getCollectionEntry(detailItem.tmdbId);
                    if (match) { setDetailItem(null); setLocation(`/entry/${match.id}`); }
                  }}
                >
                  View in your collection →
                </button>
              ) : (
                /* Action buttons */
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => { setDetailItem(null); markWatching(detailItem); }}
                    disabled={createEntry.isPending}
                    className="w-full py-3.5 rounded-full font-bold text-sm text-white disabled:opacity-50"
                    style={{ background: '#116149' }}
                  >
                    Currently Watching
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { setDetailItem(null); addToWatchlist(detailItem); }}
                      disabled={createEntry.isPending}
                      className="py-3.5 rounded-full font-bold text-sm disabled:opacity-50"
                      style={{ border: '2px solid #116149', color: '#116149', background: 'transparent' }}
                    >
                      Watchlist
                    </button>
                    <button
                      onClick={() => { setDetailItem(null); setAddingItem(detailItem); setWatchedStep(true); }}
                      disabled={createEntry.isPending}
                      className="py-3.5 rounded-full font-bold text-sm disabled:opacity-50"
                      style={{ border: '2px solid #116149', color: '#116149', background: 'transparent' }}
                    >
                      Watched
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick-add bottom sheet */}
      {addingItem && (
        <div
          className="fixed inset-0 z-[60] flex items-end"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={closeSheet}
        >
          <div
            className="w-full rounded-t-3xl p-6 space-y-5"
            style={{ background: '#ffffff' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex gap-4 items-start">
              {addingItem.posterUrl && (
                <img
                  src={addingItem.posterUrl}
                  alt={addingItem.title}
                  className="w-20 h-28 object-cover rounded-2xl flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg leading-snug" style={{ color: '#111111' }}>
                  {addingItem.title}
                </p>
                <p className="text-sm mt-0.5" style={{ color: '#7E7A73' }}>
                  {addingItem.year ?? '—'} · {addingItem.type === 'movie' ? 'Movie' : 'TV Show'}
                </p>
                {/* TMDB community score */}
                {sheetTmdbScore != null && (
                  <div className="mt-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#7E7A73' }}>TMDB Rating</p>
                    <p className="text-sm font-bold" style={{ color: '#111111' }}>{sheetTmdbScore.toFixed(1)} / 10</p>
                  </div>
                )}
              </div>
            </div>

            {/* Duplicate warning */}
            {inCollection.has(addingItem.tmdbId) && (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: '#FFFBEB', border: '1.5px solid #FFD34D' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: '#111111' }}>Already in your collection</p>
                  <button
                    className="text-xs font-semibold underline mt-0.5"
                    style={{ color: '#116149' }}
                    onClick={() => {
                      const match = getCollectionEntry(addingItem.tmdbId);
                      if (match) { closeSheet(); setLocation(`/entry/${match.id}`); }
                    }}
                  >
                    View it in your collection →
                  </button>
                </div>
              </div>
            )}

            {/* Where to watch — TV shows only, auto-fetched */}
            {addingItem.type === 'show' && streamingProviders.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#7E7A73' }}>Where to Watch</p>
                <div className="flex flex-wrap gap-2 items-center">
                  {streamingProviders.map(p => (
                    <div key={p.providerName} className="flex items-center gap-1.5">
                      <img src={p.logoUrl} alt={p.providerName} className="w-7 h-7 rounded-lg" />
                      <span className="text-xs font-semibold" style={{ color: '#111111' }}>{p.providerName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Year picker — only shown after tapping Watched */}
            {watchedStep ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold flex-shrink-0" style={{ color: '#7E7A73' }}>Year watched:</span>
                  <select
                    value={quickAddYear}
                    onChange={e => setQuickAddYear(Number(e.target.value))}
                    className="flex-1 px-3 py-2 rounded-xl text-sm font-semibold focus:outline-none"
                    style={{ border: '1.5px solid #E2D9CE', background: '#FFF3E8', color: '#111111' }}
                  >
                    {Array.from({ length: new Date().getFullYear() - 1950 + 1 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setWatchedStep(false)}
                    className="flex-1 py-3.5 rounded-full font-bold text-sm"
                    style={{ border: '2px solid #E2D9CE', color: '#7E7A73', background: 'transparent' }}
                  >
                    Back
                  </button>
                  <button
                    onClick={() => markWatched(addingItem)}
                    disabled={createEntry.isPending}
                    className="flex-1 py-3.5 rounded-full font-bold text-sm text-white disabled:opacity-50"
                    style={{ background: '#116149' }}
                  >
                    {createEntry.isPending ? 'Saving…' : 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              /* Actions */
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => markWatching(addingItem)}
                  disabled={createEntry.isPending}
                  className="w-full py-3.5 rounded-full font-bold text-sm text-white transition-opacity disabled:opacity-50"
                  style={{ background: '#116149' }}
                >
                  Currently Watching
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => addToWatchlist(addingItem)}
                    disabled={createEntry.isPending}
                    className="py-3.5 rounded-full font-bold text-sm transition-opacity disabled:opacity-50"
                    style={{ border: '2px solid #116149', color: '#116149', background: 'transparent' }}
                  >
                    Watchlist
                  </button>
                  <button
                    onClick={() => setWatchedStep(true)}
                    disabled={createEntry.isPending}
                    className="py-3.5 rounded-full font-bold text-sm transition-opacity disabled:opacity-50"
                    style={{ border: '2px solid #116149', color: '#116149', background: 'transparent' }}
                  >
                    Watched
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
