import { useLocation } from 'wouter';
import { Plus } from 'lucide-react';
import { useListEntries } from '@workspace/api-client-react';
import { CouchPotatoLogo } from '@/components/couch-potato-logo';
import { SpudMascot } from '@/components/spud-mascot';
import { PosterCard } from '@/components/poster-card';

export default function Home() {
  const [, setLocation] = useLocation();

  const { data: watching } = useListEntries({ status: 'watching' } as any);
  const { data: recent, isLoading: recentLoading } = useListEntries({ status: 'completed' } as any);

  const recentSlice = recent?.slice(0, 12) ?? [];
  const completedCount = recent?.length ?? 0;

  return (
    <div className="min-h-full" style={{ background: '#FFF3E8' }}>
      {/* Header */}
      <div className="px-5 pt-8 pb-3 flex items-center justify-between">
        <CouchPotatoLogo size="md" />
        <button onClick={() => setLocation('/profile')}>
          <SpudMascot pose="relaxed" size={68} />
        </button>
      </div>

      {/* Hero greeting card */}
      <div
        className="mx-5 mb-5 rounded-3xl p-5 text-white"
        style={{ background: '#116149' }}
      >
        <p className="text-sm font-semibold opacity-75 mb-1">Welcome back! 🛋️</p>
        <p className="text-xl font-bold">What are you watching today?</p>
        <p className="text-sm opacity-60 mt-1">{completedCount} titles in your collection</p>
      </div>

      {/* Continue Watching section */}
      {watching && watching.length > 0 && (
        <section className="mb-5">
          <div className="px-5 mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold" style={{ color: '#111111' }}>Continue Watching</h2>
            <button
              onClick={() => setLocation('/my-shows')}
              className="text-sm font-bold"
              style={{ color: '#116149' }}
            >
              See all
            </button>
          </div>
          <div className="flex gap-3 px-5 overflow-x-auto pb-1 scrollbar-hide">
            {watching.map((entry, i) => (
              <div key={entry.id} className="flex-shrink-0 w-24">
                <PosterCard
                  entry={entry}
                  index={i}
                  onClick={() => setLocation(`/entry/${entry.id}`)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recently Watched */}
      <section className="px-5 mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: '#111111' }}>Recently Watched</h2>
          <button
            onClick={() => setLocation('/my-shows')}
            className="text-sm font-bold"
            style={{ color: '#116149' }}
          >
            See all
          </button>
        </div>

        {recentLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl animate-pulse" style={{ background: '#EFE4D2' }} />
            ))}
          </div>
        ) : recentSlice.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-4" data-testid="empty-state">
            <SpudMascot pose="sleepy" size={96} />
            <p
              className="text-center font-medium text-sm"
              style={{ color: '#7E7A73' }}
            >
              Nothing logged yet.{'\n'}Start tracking what you watch!
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
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {recentSlice.map((entry, i) => (
              <PosterCard
                key={entry.id}
                entry={entry}
                index={i}
                onClick={() => setLocation(`/entry/${entry.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* FAB */}
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
