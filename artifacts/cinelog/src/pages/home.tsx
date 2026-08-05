import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Plus, Bookmark, X, RefreshCw, Play } from 'lucide-react';
import {
  useListEntries,
  useCreateEntry,
  getListEntriesQueryKey,
  getListYearsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { CouchPotatoLogo } from '@/components/couch-potato-logo';
import { SpudMascot } from '@/components/spud-mascot';
import { PosterCard } from '@/components/poster-card';

/** Group an entry array by year (key = year number, sorted descending) */
function groupByYear(entries: { year?: number | null; dateWatched?: string | null; [k: string]: any }[]) {
  const map = new Map<number, typeof entries>();
  for (const e of entries) {
    const yr =
      e.year ??
      (e.dateWatched ? new Date(e.dateWatched).getFullYear() : null) ??
      0;
    if (!map.has(yr)) map.set(yr, []);
    map.get(yr)!.push(e);
  }
  return [...map.entries()].sort(([a], [b]) => b - a);
}

type RecItem = { tmdbId: number; title: string; type: 'movie' | 'show'; year: number | null; posterUrl: string | null; overview?: string | null };

function useRecommendations() {
  const [results, setResults] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = () => { setLoading(true); setRefreshKey(k => k + 1); };

  useEffect(() => {
    setLoading(true);
    // Pass _ts so the browser never serves a stale cached response on refresh
    fetch(`/api/recommendations?_ts=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => { setResults(d.results ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [refreshKey]);

  return { results, loading, refetch };
}

function YearPill({ year }: { year: number }) {
  return (
    <div className="mb-3 mt-1">
      <span
        className="inline-block px-4 py-1 rounded-full text-sm font-bold"
        style={{ background: '#FFD34D', color: '#111111' }}
      >
        {year === 0 ? 'Unknown year' : year}
      </span>
    </div>
  );
}

function useGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [addingRec, setAddingRec] = useState<RecItem | null>(null);
  const [recYear, setRecYear] = useState(new Date().getFullYear());
  const [pickingYear, setPickingYear] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [avatarId,  setAvatarId]  = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const greeting = useGreeting();

  // Onboarding guard: if the user has no username yet (e.g. signed up via
  // Google and landed at "/" instead of "/welcome"), send them to the welcome form.
  // The `cancelled` flag prevents the redirect from firing if the component
  // unmounts before the fetch resolves (e.g. a session-expiry return-to redirect
  // navigates to a different page first).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(p => {
        if (cancelled) return;
        if (!p || !p.username) {
          setLocation('/welcome');
          return;
        }
        if (p.firstName) setFirstName(p.firstName);
        setAvatarId(p.avatarId ?? null);
        setAvatarUrl(p.avatarUrl ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const { data: watching } = useListEntries({ status: 'watching' } as any);
  const { data: watchlist } = useListEntries({ status: 'plan_to_watch' } as any);
  const { data: completed, isLoading } = useListEntries({ status: 'completed' } as any);

  const createEntry = useCreateEntry();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const watchedCount  = completed?.length ?? 0;
  const watchingCount = watching?.length ?? 0;
  const queueCount    = watchlist?.length ?? 0;

  const yearGroups = groupByYear(completed ?? []);
  const { results: recs, loading: recsLoading, refetch: refetchRecs } = useRecommendations();

  // Skip feedback ─────────────────────────────────────────────────────────────
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());

  const sendFeedback = (tmdbId: number, signal: 'skip') => {
    // Optimistic UI: hide skipped cards immediately
    setSkippedIds(prev => new Set([...prev, tmdbId]));
    // If the skip-target is the open sheet, close it
    if (addingRec?.tmdbId === tmdbId) { setAddingRec(null); setPickingYear(false); }
    // Persist to server (fire-and-forget — non-critical)
    fetch('/api/recommendations/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tmdbId, signal }),
    }).catch(() => { /* ignore */ });
  };
  // ──────────────────────────────────────────────────────────────────────────

  const addRec = (rec: RecItem, status: 'watching' | 'plan_to_watch' | 'completed') => {
    createEntry.mutate(
      {
        data: {
          title: rec.title,
          type: rec.type,
          status,
          posterUrl: rec.posterUrl ?? undefined,
          tmdbId: rec.tmdbId,
          year: rec.year ?? undefined,
          dateWatched: status === 'completed' ? `${recYear}-01-01` : undefined,
        } as any,
      },
      {
        onSuccess: () => {
          const label = status === 'completed' ? 'Logged!' : status === 'watching' ? 'Now Watching' : 'Added to Watchlist';
          toast({ title: label, description: rec.title });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListYearsQueryKey() });
          setAddingRec(null);
          setPickingYear(false);
        },
        onError: () => toast({ title: 'Error', description: 'Could not add entry', variant: 'destructive' }),
      }
    );
  };

  return (
    <div className="min-h-full pb-24" style={{ background: '#FFF3E8' }}>
      {/* ── Header ── */}
      <div className="px-5 pt-8 pb-3 flex items-center justify-between">
        <CouchPotatoLogo size="lg" />
        <button
          onClick={() => setLocation('/profile')}
          className="flex-shrink-0 flex flex-col items-center gap-1"
        >
          {/* Avatar circle */}
          <div
            className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center"
            style={{ background: '#EFE4D2' }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : avatarId ? (
              <img
                src={`/spud-avatar-${avatarId}.png`}
                alt="Spud"
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <SpudMascot pose="relaxed" size={80} round={false} />
            )}
          </div>
          {/* Yellow Edit Profile pill */}
          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold leading-none"
            style={{ background: '#FFD34D', color: '#111111' }}
          >
            Edit Profile
          </span>
        </button>
      </div>

      {/* ── Hero stats card ── */}
      <div
        className="mx-5 mb-5 rounded-3xl p-5 text-white"
        style={{ background: '#116149' }}
      >
        <p className="text-xl font-bold" style={{ marginBottom: 2 }}>
          {greeting}{firstName ? `, ${firstName}` : ''}
        </p>
        <p className="text-sm opacity-70 mb-4">Welcome back to your personal TV &amp; movie library.</p>
        <div className="flex gap-4">
          <div className="flex-1 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <p className="text-2xl font-bold">{watchedCount}</p>
            <p className="text-xs opacity-70 mt-0.5">Watched</p>
          </div>
          <div
            className="flex-1 rounded-2xl p-3 cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.12)' }}
            onClick={() => setLocation('/my-shows')}
          >
            <p className="text-2xl font-bold">{watchingCount}</p>
            <p className="text-xs opacity-70 mt-0.5">Watching</p>
          </div>
          <div
            className="flex-1 rounded-2xl p-3 cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.12)' }}
            onClick={() => setLocation('/watchlist')}
          >
            <p className="text-2xl font-bold">{queueCount}</p>
            <p className="text-xs opacity-70 mt-0.5">Watchlist</p>
          </div>
        </div>
      </div>

      {/* ── Currently Watching ── */}
      {watchingCount > 0 ? (
        <section className="mb-6">
          <div className="px-5 mb-3">
            <h2 className="text-base font-bold" style={{ color: '#111111' }}>Currently Watching</h2>
          </div>
          <div className="flex gap-3 px-5 overflow-x-auto pb-1 scrollbar-hide">
            {watching!.map((entry: any, i: number) => (
              <div key={entry.id} className="flex-shrink-0 w-28">
                <PosterCard
                  entry={entry}
                  index={i}
                  onClick={() => setLocation(`/entry/${entry.id}`)}
                />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="mx-5 mb-6 rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{ background: '#EFE4D2', border: '1px solid #E2D9CE' }}
        >
          <Play className="w-5 h-5 flex-shrink-0" style={{ color: '#7E7A73' }} />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: '#111111' }}>Nothing on right now</p>
            <p className="text-xs" style={{ color: '#7E7A73' }}>Mark a title as "Watching" from My Shows</p>
          </div>
        </div>
      )}

      {/* ── You Might Like — always rendered so it never disappears ── */}
      <section className="mb-6">
        <div className="px-5 mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold mb-2" style={{ color: '#111111' }}>Based on what you've watched</h2>
            <span
              className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: '#6B46C1', color: '#ffffff' }}
            >
              Picked for you
            </span>
          </div>
          <button
            onClick={refetchRecs}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold active:opacity-60 mt-0.5"
            style={{ background: '#EFE4D2', color: '#116149' }}
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        {/* Loading skeleton */}
        {recsLoading && (
          <div className="flex gap-3 px-5 overflow-x-auto pb-1 scrollbar-hide">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex-shrink-0 w-28">
                <div className="aspect-[2/3] rounded-xl animate-pulse mb-1.5" style={{ background: '#EFE4D2' }} />
                <div className="h-3 rounded-full animate-pulse mb-1" style={{ background: '#EFE4D2', width: '80%' }} />
                <div className="h-2 rounded-full animate-pulse" style={{ background: '#EFE4D2', width: '50%' }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!recsLoading && recs.length === 0 && (
          <div className="mx-5 px-4 py-5 rounded-2xl text-center" style={{ background: '#EFE4D2' }}>
            <p className="text-sm font-semibold" style={{ color: '#116149' }}>Log a few titles you've watched</p>
            <p className="text-xs mt-1" style={{ color: '#7E7A73' }}>Recommendations appear once we know your taste</p>
          </div>
        )}

        {/* Results */}
        {!recsLoading && recs.length > 0 && (
          <div className="flex gap-3 px-5 overflow-x-auto pb-1 scrollbar-hide">
            {recs.filter(r => !skippedIds.has(r.tmdbId)).map((rec) => {
              return (
                <div key={rec.tmdbId} className="flex-shrink-0 w-28">
                  {/* Poster — tappable to open the add sheet */}
                  <div
                    className="aspect-[2/3] rounded-xl overflow-hidden mb-1.5 relative cursor-pointer active:opacity-80 transition-opacity"
                    style={{ background: '#EFE4D2' }}
                    onClick={() => setAddingRec(rec)}
                  >
                    {rec.posterUrl ? (
                      <img src={rec.posterUrl} alt={rec.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl font-bold" style={{ color: '#116149' }}>
                        {rec.title[0]?.toUpperCase()}
                      </div>
                    )}

                    {/* Skip overlay — bottom-right */}
                    <div className="absolute bottom-1.5 right-1.5 pointer-events-none">
                      <button
                        className="pointer-events-auto w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-90"
                        style={{
                          background: 'rgba(0,0,0,0.55)',
                          backdropFilter: 'blur(4px)',
                        }}
                        onClick={(e) => { e.stopPropagation(); sendFeedback(rec.tmdbId, 'skip'); }}
                        aria-label="Not interested"
                        title="Not interested"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs font-semibold truncate" style={{ color: '#111111' }}>{rec.title}</p>
                  <p className="text-[10px]" style={{ color: '#7E7A73' }}>
                    {rec.year} · {rec.type === 'movie' ? 'Film' : 'Show'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Watched — grouped by year ── */}
      <section className="px-5 mb-10">
        <div className="mb-4">
          <h2 className="text-base font-bold" style={{ color: '#111111' }}>Watched</h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl animate-pulse" style={{ background: '#EFE4D2' }} />
            ))}
          </div>
        ) : yearGroups.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-4" data-testid="empty-state">
            <SpudMascot pose="sleepy" size={100} round={false} />
            <p className="text-center font-medium text-sm" style={{ color: '#7E7A73' }}>
              Nothing logged yet — start tracking what you watch!
            </p>
            <button
              onClick={() => setLocation('/search')}
              className="px-6 py-3 rounded-full font-bold text-sm text-white"
              style={{ background: '#116149' }}
              data-testid="button-add-first"
            >
              Find something to watch
            </button>
          </div>
        ) : (
          yearGroups.map(([year, entries]) => (
            <div key={year} className="mb-6">
              <YearPill year={year} />
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {entries.map((entry, i) => (
                  <PosterCard
                    key={entry.id}
                    entry={entry}
                    index={i}
                    onClick={() => setLocation(`/entry/${entry.id}`)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* ── Watchlist shortcut banner (only if queue has items) ── */}
      {queueCount > 0 && (
        <div
          className="mx-5 mb-8 rounded-2xl px-4 py-4 flex items-center gap-3 cursor-pointer"
          style={{ background: '#BDECC8', border: '1px solid #116149' }}
          onClick={() => setLocation('/watchlist')}
        >
          <Bookmark className="w-5 h-5 flex-shrink-0" style={{ color: '#116149' }} />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: '#116149' }}>
              {queueCount} title{queueCount !== 1 ? 's' : ''} in your watchlist
            </p>
            <p className="text-xs" style={{ color: '#116149', opacity: 0.7 }}>Tap to see what's up next →</p>
          </div>
        </div>
      )}

      {/* ── FAB ── */}
      <button
        onClick={() => {
          sessionStorage.setItem('search:autofocus', '1');
          setLocation('/search');
        }}
        className="fixed bottom-20 right-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40 active:scale-95 transition-transform"
        style={{ background: '#FF4BAE' }}
        aria-label="Log new entry"
      >
        <Plus className="w-7 h-7 text-white" />
      </button>

      {/* ── Rec quick-add sheet — matches Search sheet exactly ── */}
      {addingRec && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => { setAddingRec(null); setPickingYear(false); }}
        >
          <div
            className="w-full rounded-t-3xl p-6 space-y-5"
            style={{ background: '#ffffff' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header — poster + title + overview */}
            <div className="flex gap-4 items-start">
              {addingRec.posterUrl && (
                <img
                  src={addingRec.posterUrl}
                  alt={addingRec.title}
                  className="w-20 h-28 object-cover rounded-2xl flex-shrink-0"
                />
              )}
              <div className="flex-1">
                <p className="font-bold text-lg leading-snug" style={{ color: '#111111' }}>
                  {addingRec.title}
                </p>
                <p className="text-sm mt-0.5" style={{ color: '#7E7A73' }}>
                  {addingRec.year ?? '—'} · {addingRec.type === 'movie' ? 'Movie' : 'TV Show'}
                </p>
                {addingRec.overview && (
                  <p className="text-xs mt-2 line-clamp-3" style={{ color: '#7E7A73' }}>
                    {addingRec.overview}
                  </p>
                )}
              </div>
            </div>

            {/* Actions — or year-picker step when "Mark Watched" was tapped */}
            {pickingYear ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-bold mb-2" style={{ color: '#111111' }}>When did you watch it?</p>
                  <select
                    value={recYear}
                    onChange={e => setRecYear(Number(e.target.value))}
                    className="w-full px-3 py-3 rounded-xl text-sm font-semibold focus:outline-none"
                    style={{ border: '1.5px solid #E2D9CE', background: '#FFF3E8', color: '#111111' }}
                  >
                    {Array.from({ length: new Date().getFullYear() - 1950 + 1 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPickingYear(false)}
                    className="py-3.5 rounded-full font-bold text-sm"
                    style={{ border: '2px solid #E2D9CE', color: '#7E7A73', background: 'transparent' }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => { setPickingYear(false); addRec(addingRec, 'completed'); }}
                    disabled={createEntry.isPending}
                    className="py-3.5 rounded-full font-bold text-sm text-white disabled:opacity-50"
                    style={{ background: '#116149' }}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => addRec(addingRec, 'watching')}
                  disabled={createEntry.isPending}
                  className="w-full py-3.5 rounded-full font-bold text-sm text-white transition-opacity disabled:opacity-50"
                  style={{ background: '#116149' }}
                >
                  Currently Watching
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => addRec(addingRec, 'plan_to_watch')}
                    disabled={createEntry.isPending}
                    className="py-3.5 rounded-full font-bold text-sm transition-opacity disabled:opacity-50"
                    style={{ border: '2px solid #116149', color: '#116149', background: 'transparent' }}
                  >
                    Watchlist
                  </button>
                  <button
                    onClick={() => setPickingYear(true)}
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
  );
}
