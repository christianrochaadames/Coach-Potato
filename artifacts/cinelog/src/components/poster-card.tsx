import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUpdateEntry, getListEntriesQueryKey } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';

function getPosterColor(title: string): string {
  const colors = ['#116149', '#9BD6FF', '#BDECC8', '#EFE4D2', '#FFD34D'];
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function textColorFor(bg: string): string {
  return bg === '#FFD34D' || bg === '#9BD6FF' || bg === '#BDECC8' || bg === '#EFE4D2'
    ? '#111111'
    : '#ffffff';
}

interface PosterCardProps {
  entry: {
    id: number;
    title: string;
    type: string;
    status?: string | null;
    posterUrl?: string | null;
    rating?: number | null;
    year?: number | null;
    dateWatched?: string | null;
  };
  onClick?: () => void;
  compact?: boolean;
  index?: number;
}

export function PosterCard({ entry, onClick, compact = false, index = 0 }: PosterCardProps) {
  const bg = getPosterColor(entry.title);
  const fg = textColorFor(bg);

  // Local optimistic rating so taps feel instant
  const [pendingRating, setPendingRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const displayRating = hoverRating ?? pendingRating ?? entry.rating ?? 0;

  const queryClient = useQueryClient();
  const { mutate: updateEntry } = useUpdateEntry();

  const handleStar = (e: React.MouseEvent, star: number) => {
    e.stopPropagation();
    // Tap the same star again to clear the rating
    const newRating = star === (pendingRating ?? entry.rating) ? 0 : star;
    setPendingRating(newRating);
    updateEntry(
      { id: entry.id, data: { rating: newRating === 0 ? null : newRating } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          if (newRating === 0) setPendingRating(null);
        },
        onError: () => setPendingRating(null),
      }
    );
  };

  return (
    <div
      onClick={onClick}
      className={cn('relative cursor-pointer select-none animate-stagger-in')}
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
      data-testid={`poster-card-${entry.id}`}
    >
      {/* Poster image */}
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-sm">
        {entry.posterUrl ? (
          <img
            src={entry.posterUrl}
            alt={entry.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-1"
            style={{ background: bg, color: fg }}
          >
            <span className="text-2xl font-bold">{entry.title[0]?.toUpperCase()}</span>
            <span className="text-xs font-semibold opacity-60">
              {entry.type === 'movie' ? '🎬' : '📺'}
            </span>
          </div>
        )}

        {/* Status badge — only show on watchlist items, not on currently-watching strip */}
        {entry.status === 'plan_to_watch' && (
          <div
            className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
            style={{ background: '#BDECC8', color: '#116149' }}
          >
            🔖
          </div>
        )}
      </div>

      {/* Title + interactive stars below poster */}
      {!compact && (
        <div className="mt-1.5">
          <p
            className="text-xs font-bold truncate leading-tight mb-0.5"
            style={{ color: '#111111' }}
            data-testid={`poster-title-${entry.id}`}
          >
            {entry.title}
          </p>
          {/* Stars — always shown, tappable to rate/re-rate */}
          <div
            className="flex items-center gap-[2px]"
            onMouseLeave={() => setHoverRating(null)}
            onClick={(e) => e.stopPropagation()}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                onMouseEnter={() => setHoverRating(star)}
                onClick={(e) => handleStar(e, star)}
                style={{
                  fontSize: 11,
                  lineHeight: 1,
                  cursor: 'pointer',
                  color: star <= displayRating ? '#FFD34D' : '#D6CECC',
                  transition: 'color 0.1s',
                }}
              >
                ★
              </span>
            ))}
            {displayRating > 0 && (
              <span
                className="text-[9px] ml-0.5"
                style={{ color: '#7E7A73', lineHeight: 1 }}
              >
                {displayRating}/5
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
