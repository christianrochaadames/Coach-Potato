import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number | null;
  onRatingChange?: (rating: number | null) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StarRating({
  rating,
  onRatingChange,
  readonly = false,
  size = 'md',
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const sizeMap = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-7 h-7' };
  const sizeClass = sizeMap[size];
  const display = hovered ?? rating ?? 0;

  return (
    <div className="flex gap-1" data-testid="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(null)}
          onClick={() =>
            !readonly && onRatingChange?.(star === rating ? null : star)
          }
          className={cn(
            'transition-transform',
            !readonly && 'hover:scale-110 cursor-pointer',
            readonly && 'cursor-default'
          )}
          data-testid={`star-${star}`}
        >
          <Star
            className={cn(sizeClass, 'transition-colors')}
            fill={display >= star ? '#FFD34D' : 'transparent'}
            stroke={display >= star ? '#FFD34D' : '#D5C9BC'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}
