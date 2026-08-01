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

  return (
    <div
      onClick={onClick}
      className={cn('relative cursor-pointer select-none animate-stagger-in')}
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
      data-testid={`poster-card-${entry.id}`}
    >
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
        {/* Status badge */}
        {entry.status && entry.status !== 'completed' && (
          <div
            className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
            style={{
              background: entry.status === 'watching' ? '#9BD6FF' : '#BDECC8',
              color: '#116149',
            }}
          >
            {entry.status === 'watching' ? '▶' : '🔖'}
          </div>
        )}
        {/* Rating overlay */}
        {entry.rating && (
          <div
            className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#FFD34D' }}
          >
            ★ {entry.rating}
          </div>
        )}
      </div>
      {!compact && (
        <div className="mt-1.5">
          <p className="text-xs font-bold truncate" style={{ color: '#111111' }} data-testid={`poster-title-${entry.id}`}>
            {entry.title}
          </p>
          <p className="text-[10px]" style={{ color: '#7E7A73' }}>
            {entry.year ?? ''}
          </p>
        </div>
      )}
    </div>
  );
}
