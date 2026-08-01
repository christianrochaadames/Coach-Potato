import { useLocation } from 'wouter';
import { Plus, Bookmark } from 'lucide-react';
import { useListEntries } from '@workspace/api-client-react';
import { CouchPotatoLogo } from '@/components/couch-potato-logo';
import { SpudMascot } from '@/components/spud-mascot';
import { PosterCard } from '@/components/poster-card';

/** Group currently-watching entries by platform */
function groupByPlatform(entries: any[]) {
  const map = new Map<string, any[]>();
  for (const e of entries) {
    const key = (e.platform as string | null) ?? '';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  // Named platforms first (sorted), then entries with no platform
  return [...map.entries()].sort(([a], [b]) => {
    if (!a && b) return 1;
    if (a && !b) return -1;
    return a.localeCompare(b);
  });
}

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

export default function Home() {
  const [, setLocation] = useLocation();

  const { data: watching } = useListEntries({ status: 'watching' } as any);
  const { data: watchlist } = useListEntries({ status: 'plan_to_watch' } as any);
  const { data: completed, isLoading } = useListEntries({ status: 'completed' } as any);

  const watchedCount  = completed?.length ?? 0;
  const watchingCount = watching?.length ?? 0;
  const queueCount    = watchlist?.length ?? 0;

  const yearGroups = groupByYear(completed ?? []);

  return (
    <div className="min-h-full pb-24" style={{ background: '#FFF3E8' }}>
      {/* ── Header ── */}
      <div className="px-5 pt-8 pb-3 flex items-center justify-between">
        <CouchPotatoLogo size="lg" />
        <button onClick={() => setLocation('/profile')} className="flex-shrink-0">
          <SpudMascot pose="relaxed" size={72} round={false} />
        </button>
      </div>

      {/* ── Hero stats card ── */}
      <div
        className="mx-5 mb-5 rounded-3xl p-5 text-white"
        style={{ background: '#116149' }}
      >
        <p className="text-xl font-bold mb-4">Everything you've watched, are watching and want to watch, all in one place.</p>
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
                {/* Platform pill sits above the poster */}
                <div className="mb-1.5 h-6 flex items-center">
                  {entry.platform ? (
                    <span
                      className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold truncate max-w-full"
                      style={{ background: '#4A78FF', color: '#ffffff' }}
                    >
                      {entry.platform}
                    </span>
                  ) : (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: '#EFE4D2', color: '#7E7A73' }}
                    >
                      + Add platform
                    </span>
                  )}
                </div>
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
          <span className="text-xl">▶️</span>
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: '#111111' }}>Nothing on right now</p>
            <p className="text-xs" style={{ color: '#7E7A73' }}>Mark a title as "Watching" from My Shows</p>
          </div>
        </div>
      )}

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
        onClick={() => setLocation('/add')}
        className="fixed bottom-20 right-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40 active:scale-95 transition-transform"
        style={{ background: '#FF4BAE' }}
        aria-label="Log new entry"
      >
        <Plus className="w-7 h-7 text-white" />
      </button>
    </div>
  );
}
