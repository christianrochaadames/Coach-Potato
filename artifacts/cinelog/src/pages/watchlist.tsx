import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Bookmark, ArrowRight, Play, Trash2 } from 'lucide-react';
import {
  useListEntries,
  useUpdateEntry,
  useDeleteEntry,
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
  const deleteEntry = useDeleteEntry();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Track which entry is showing the delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const startWatching = (id: number, title: string) => {
    updateEntry.mutate(
      { id, data: { status: 'watching' } as any },
      {
        onSuccess: () => {
          toast({ title: 'Now Watching', description: title });
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
          toast({ title: 'Marked as Watched', description: title });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListYearsQueryKey() });
        },
      }
    );
  };

  const removeEntry = (id: number, title: string) => {
    deleteEntry.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: 'Removed from watchlist', description: title });
          setConfirmDeleteId(null);
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
        },
        onError: () => toast({ title: 'Error', description: 'Could not remove entry', variant: 'destructive' }),
      }
    );
  };

  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    const main = document.querySelector('main') as HTMLElement | null;
    const wrapper = main?.parentElement as HTMLElement | null;
    const prevMain = main?.style.background ?? '';
    const prevWrapper = wrapper?.style.background ?? '';
    document.documentElement.style.background = '#E4DFEF';
    document.body.style.background = '#E4DFEF';
    if (main) main.style.background = '#E4DFEF';
    if (wrapper) wrapper.style.background = '#E4DFEF';
    return () => {
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
      if (main) main.style.background = prevMain;
      if (wrapper) wrapper.style.background = prevWrapper;
    };
  }, []);

  return (
    <div className="min-h-screen" style={{ background: '#C5B8FF', borderRadius: 28, marginTop: 8, marginBottom: 100 }}>
      <div className="px-5 pt-8 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold" style={{ color: '#3B3275' }}>Watchlist</h1>
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
              className="rounded-2xl overflow-hidden"
              style={{ background: '#ffffff' }}
            >
              <div className="p-4 flex gap-4 items-center">
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
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => startWatching(entry.id, entry.title)}
                      disabled={updateEntry.isPending}
                      className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full text-white disabled:opacity-50"
                      style={{ background: '#4A78FF' }}
                    >
                      <Play className="w-3 h-3" /> Watch
                    </button>
                    <button
                      onClick={() => markWatched(entry.id, entry.title)}
                      disabled={updateEntry.isPending}
                      className="text-xs font-bold px-3 py-1.5 rounded-full text-white disabled:opacity-50"
                      style={{ background: '#FF2BAC' }}
                    >
                      ✓ Watched
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(entry.id)}
                      disabled={deleteEntry.isPending}
                      className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-50"
                      style={{ background: '#FFF3E8', border: '1px solid #E2D9CE', color: '#7E7A73' }}
                      aria-label="Remove from watchlist"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
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

              {/* Inline confirmation banner */}
              {confirmDeleteId === entry.id && (
                <div
                  className="px-4 py-3 flex items-center justify-between gap-3"
                  style={{ background: '#FFF0F0', borderTop: '1px solid #FFCDD2' }}
                >
                  <p className="text-xs font-semibold" style={{ color: '#111111' }}>
                    Remove &ldquo;{entry.title}&rdquo; from your watchlist?
                  </p>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs font-bold px-3 py-1.5 rounded-full"
                      style={{ background: '#ffffff', border: '1px solid #E2D9CE', color: '#7E7A73' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => removeEntry(entry.id, entry.title)}
                      disabled={deleteEntry.isPending}
                      className="text-xs font-bold px-3 py-1.5 rounded-full text-white disabled:opacity-50"
                      style={{ background: '#E53E3E' }}
                    >
                      {deleteEntry.isPending ? 'Removing…' : 'Yes, remove'}
                    </button>
                  </div>
                </div>
              )}
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
