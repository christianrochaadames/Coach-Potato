import { Film, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StarRating } from './star-rating';
import type { Entry } from '@workspace/api-client-react';

interface PosterCardProps {
  entry: Entry;
  onClick?: () => void;
  index?: number;
}

function generatePosterPlaceholder(title: string, type: 'movie' | 'show') {
  const firstLetter = title[0]?.toUpperCase() || '?';
  
  // Generate a consistent hue based on title
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-3"
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 40%, 25%) 0%, hsl(${hue}, 30%, 15%) 100%)`,
      }}
    >
      <div className="text-5xl font-display font-bold text-white/90">
        {firstLetter}
      </div>
      <div className="text-muted-foreground">
        {type === 'movie' ? <Film className="w-6 h-6" /> : <Tv className="w-6 h-6" />}
      </div>
    </div>
  );
}

export function PosterCard({ entry, onClick, index = 0 }: PosterCardProps) {
  return (
    <div
      className={cn(
        'group cursor-pointer animate-stagger-in opacity-0',
        'transition-all duration-300 hover:-translate-y-2'
      )}
      style={{
        animationDelay: `${index * 40}ms`,
      }}
      onClick={onClick}
      data-testid={`poster-card-${entry.id}`}
    >
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-card border border-border transition-all duration-300 group-hover:border-primary/50 group-hover:poster-glow">
        {entry.posterUrl ? (
          <img
            src={entry.posterUrl}
            alt={entry.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          generatePosterPlaceholder(entry.title, entry.type)
        )}
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {entry.type === 'movie' ? <Film className="w-3 h-3" /> : <Tv className="w-3 h-3" />}
              <span className="uppercase tracking-wider">{entry.type}</span>
            </div>
            {entry.rating && (
              <StarRating rating={entry.rating} readonly size="sm" />
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-3 space-y-1">
        <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors" data-testid={`poster-title-${entry.id}`}>
          {entry.title}
        </h3>
        <p className="text-xs text-muted-foreground">
          {new Date(entry.dateWatched).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          })}
        </p>
      </div>
    </div>
  );
}
