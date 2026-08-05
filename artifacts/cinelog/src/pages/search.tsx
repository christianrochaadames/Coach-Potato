import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'wouter';
import { Search as SearchIcon, X, Film, Tv } from 'lucide-react';
import { PLATFORMS } from '@/lib/platforms';
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

function useTmdbPopular() {
  const [data, setData] = useState<{ movies: TmdbItem[]; shows: TmdbItem[] } | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tmdb/popular')
      .then(r => {
        if (r.status === 503) { setNoKey(true); setLoading(false); return null; }
        return r.json();
      })
      .then(d => { if (d) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return { data, noKey, loading };
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [, setLocation] = useLocation();
  const [addingItem, setAddingItem] = useState<TmdbItem | null>(null);
  const [quickAddYear, setQuickAddYear] = useState(new Date().getFullYear());
  const [quickAddPlatform, setQuickAddPlatform] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when arriving from the FAB
  useEffect(() => {
    if (sessionStorage.getItem('search:autofocus') === '1') {
      sessionStorage.removeItem('search:autofocus');
      // Small delay lets the page finish mounting/painting before focus
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, []);
  const { results, loading: searchLoading, noKey: searchNoKey } = useTmdbSearch(query);
  const { data: popular, noKey: popularNoKey, loading: popularLoading } = useTmdbPopular();
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

  // Reset platform selection whenever the sheet opens for a new item
  useEffect(() => {
    setQuickAddPlatform('');
  }, [addingItem?.tmdbId]);

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
          platform: quickAddPlatform || undefined,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: '▶ Now Watching', description: item.title });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          setAddingItem(null);
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
          platform: quickAddPlatform || undefined,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: '🔖 Added to Watchlist', description: item.title });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          setAddingItem(null);
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
          platform: quickAddPlatform || undefined,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: '✓ Logged!', description: `${item.title} added to collection` });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListYearsQueryKey() });
          setAddingItem(null);
        },
        onError: () => toast({ title: 'Error', description: 'Could not log entry', variant: 'destructive' }),
      }
    );
  };

  const renderItem = (item: TmdbItem, i: number) => {
    const alreadyAdded = inCollection.has(item.tmdbId);
    return (
    <div
      key={item.tmdbId}
      className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer active:opacity-70 transition-opacity"
      style={{
        background: alreadyAdded ? '#F4FBF7' : '#ffffff',
        border: alreadyAdded ? '1.5px solid #BDECC8' : '1px solid #E2D9CE',
      }}
      onClick={() => setAddingItem(item)}
    >
      <div
        className="w-12 h-16 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
        style={{ background: '#EFE4D2' }}
      >
        {item.posterUrl ? (
          <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          item.type === 'movie'
            ? <Film className="w-5 h-5" style={{ color: '#7E7A73' }} />
            : <Tv className="w-5 h-5" style={{ color: '#7E7A73' }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-bold text-sm truncate" style={{ color: '#111111' }}>{item.title}</p>
          {alreadyAdded && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: '#BDECC8', color: '#116149' }}>✓</span>
          )}
        </div>
        <p className="text-xs" style={{ color: '#7E7A73' }}>
          {item.year ?? '—'} · {item.type === 'movie' ? 'Movie' : 'TV Show'}{alreadyAdded ? ' · In your collection' : ''}
        </p>
      </div>
      <span
        className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
        style={
          item.type === 'movie'
            ? { background: '#9BD6FF', color: '#116149' }
            : { background: '#BDECC8', color: '#116149' }
        }
      >
        {item.type === 'movie' ? 'Film' : 'Show'}
      </span>
    </div>
  );
  };

  return (
    <div className="min-h-full" style={{ background: '#FFF3E8' }}>
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
            placeholder="Search movies & TV shows..."
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
          <p className="text-sm font-bold" style={{ color: '#111111' }}>⚠️ TMDB API Key Missing</p>
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
            <p className="text-xs font-bold uppercase tracking-wider pb-1" style={{ color: '#7E7A73' }}>Popular Movies</p>
            {popular.movies.map((item, i) => renderItem(item, i))}
            <p className="text-xs font-bold uppercase tracking-wider pb-1 pt-3" style={{ color: '#7E7A73' }}>Popular Shows</p>
            {popular.shows.map((item, i) => renderItem(item, i))}
          </>
        ) : !noKey && popularLoading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: '#EFE4D2' }} />
          ))
        ) : null}
      </div>

      {/* Quick-add bottom sheet */}
      {addingItem && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setAddingItem(null)}
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
              <div className="flex-1">
                <p className="font-bold text-lg leading-snug" style={{ color: '#111111' }}>
                  {addingItem.title}
                </p>
                <p className="text-sm mt-0.5" style={{ color: '#7E7A73' }}>
                  {addingItem.year ?? '—'} · {addingItem.type === 'movie' ? 'Movie' : 'TV Show'}
                </p>
                {addingItem.overview && (
                  <p className="text-xs mt-2 line-clamp-3" style={{ color: '#7E7A73' }}>
                    {addingItem.overview}
                  </p>
                )}
              </div>
            </div>
            {/* Duplicate warning */}
            {inCollection.has(addingItem.tmdbId) && (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: '#FFFBEB', border: '1.5px solid #FFD34D' }}
              >
                <span className="text-lg flex-shrink-0">⚠️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: '#111111' }}>Already in your collection</p>
                  <button
                    className="text-xs font-semibold underline mt-0.5"
                    style={{ color: '#116149' }}
                    onClick={() => {
                      const match = getCollectionEntry(addingItem.tmdbId);
                      if (match) { setAddingItem(null); setLocation(`/entry/${match.id}`); }
                    }}
                  >
                    View it in your collection →
                  </button>
                </div>
              </div>
            )}
            {/* Year picker */}
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
            {/* Platform picker */}
            <div className="space-y-2">
              <p className="text-sm font-bold" style={{ color: '#111111' }}>
                Platform <span style={{ color: '#7E7A73', fontWeight: 400 }}>(optional)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => {
                  const selected = quickAddPlatform === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setQuickAddPlatform(selected ? '' : p)}
                      className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                      style={
                        selected
                          ? { background: '#4A78FF', color: '#ffffff' }
                          : { background: '#ffffff', border: '1px solid #E2D9CE', color: '#7E7A73' }
                      }
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => markWatching(addingItem)}
                disabled={createEntry.isPending}
                className="w-full py-3.5 rounded-full font-bold text-sm text-white transition-opacity disabled:opacity-50"
                style={{ background: '#116149' }}
              >
                ▶ Currently Watching
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => addToWatchlist(addingItem)}
                  disabled={createEntry.isPending}
                  className="py-3.5 rounded-full font-bold text-sm transition-opacity disabled:opacity-50"
                  style={{ border: '2px solid #116149', color: '#116149', background: 'transparent' }}
                >
                  🔖 Watchlist
                </button>
                <button
                  onClick={() => markWatched(addingItem)}
                  disabled={createEntry.isPending}
                  className="py-3.5 rounded-full font-bold text-sm transition-opacity disabled:opacity-50"
                  style={{ border: '2px solid #116149', color: '#116149', background: 'transparent' }}
                >
                  ✓ Mark Watched
                </button>
              </div>
            </div>
            <button
              onClick={() => setLocation(
                `/add?tmdbId=${addingItem.tmdbId}&title=${encodeURIComponent(addingItem.title)}&type=${addingItem.type}&year=${addingItem.year ?? ''}&poster=${encodeURIComponent(addingItem.posterUrl ?? '')}&overview=${encodeURIComponent(addingItem.overview ?? '')}&genres=${encodeURIComponent((addingItem.genres ?? []).join(','))}&platform=${encodeURIComponent(quickAddPlatform)}`
              )}
              className="w-full text-center text-sm font-semibold"
              style={{ color: '#7E7A73' }}
            >
              Log with full details →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
