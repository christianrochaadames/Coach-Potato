import { useLocation } from 'wouter';
import { Bookmark, ArrowRight, Play } from 'lucide-react';
import {
  useListEntries,
  useUpdateEntry,
  getListEntriesQueryKey,
  getListYearsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { SpudMascot } from '@/components/spud-mascot';
import { useToast } from '@/hooks/use-toast';

export default function Watchlist() {
  const [, setLocation] = useLocation();
  const { data: entries, isLoading } = useListEntries({ status: 'plan_to_watch' } as any);
  const updateEntry = useUpdateEntry();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const startWatching = (id: number, title: string) => {
    updateEntry.mutate(
      { id, data: { status: 'watching' } as any },
      {
        onSuccess: () => {
          toast({ title: '▶ Started watching', description: title });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
        },
      }
    );
  };

  const markWatched = (id: number, title: string) => {
    const today = new Date().toISOString().split('T')[0];
    updateEntry.mutate(
      { id, data: { status: 'completed', dateWatched: today } as any },
      {
        onSuccess: () => {
          toast({ title: '✓ Marked as watched', description: title });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListYearsQueryKey() });
        },
      }
    );
  };

  return (
    <div className="min-h-full" style={{ background: '#FFF3E8' }}>
      <div className="px-5 pt-8 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Bookmark className="w-5 h-5" style={{ color: '#116149' }} />
          <h1 className="text-2xl font-bold" style={{ color: '#111111' }}>Watchlist</h1>
        </div>
        <p className="text-sm font-medium" style={{ color: '#7E7A73' }}>
          {entries ? `${entries.length} title${entries.length !== 1 ? 's' : ''} saved` : 'Loading...'}
        </p>
      </div>

      <div className="px-5 space-y-3 pb-8">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: '#EFE4D2' }} />
          ))
        ) : entries && entries.length > 0 ? (
          entries.map(entry => (
            <div
              key={entry.id}
              className="rounded-2xl p-4 flex gap-4 items-center"
              style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}
            >
              {/* Poster */}
              <div
                className="w-14 h-20 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer"
                style={{ background: '#EFE4D2' }}
                onClick={() => setLocation(`/entry/${entry.id}`)}
              >
                {entry.posterUrl ? (
                  <img
                    src={entry.posterUrl}
                    alt={entry.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold" style={{ color: '#116149' }}>
                    {entry.title[0]?.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Info + actions */}
              <div className="flex-1 min-w-0">
                <p
                  className="font-bold text-sm truncate cursor-pointer"
                  style={{ color: '#111111' }}
                  onClick={() => setLocation(`/entry/${entry.id}`)}
                >
                  {entry.title}
                </p>
                <p className="text-xs mb-2" style={{ color: '#7E7A73' }}>
                  {entry.year ?? (entry.type === 'movie' ? 'Movie' : 'TV Show')}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => startWatching(entry.id, entry.title)}
                    className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full text-white"
                    style={{ background: '#FF4BAE' }}
                  >
                    <Play className="w-3 h-3" /> Watch
                  </button>
                  <button
                    onClick={() => markWatched(entry.id, entry.title)}
                    className="text-xs font-bold px-3 py-1.5 rounded-full text-white"
                    style={{ background: '#116149' }}
                  >
                    ✓ Seen it
                  </button>
                </div>
              </div>

              <button
                onClick={() => setLocation(`/entry/${entry.id}`)}
                className="flex-shrink-0"
              >
                <ArrowRight className="w-4 h-4" style={{ color: '#7E7A73' }} />
              </button>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center py-16 gap-4">
            <SpudMascot pose="sleepy" size={96} />
            <p className="text-sm text-center font-medium" style={{ color: '#7E7A73' }}>
              Your watchlist is empty.{'\n'}Search for something to save!
            </p>
            <button
              onClick={() => setLocation('/search')}
              className="px-6 py-3 rounded-full font-bold text-sm text-white"
              style={{ background: '#116149' }}
            >
              Browse Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
