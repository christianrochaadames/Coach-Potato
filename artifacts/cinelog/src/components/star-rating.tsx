import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number | null;
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StarRating({ rating, onRatingChange, readonly = false, size = 'md' }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];
  
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="flex gap-1" data-testid="star-rating">
      {stars.map((star) => {
        const filled = rating !== null && star <= rating;
        return (
          <button
            key={star}
            type="button"
            onClick={() => !readonly && onRatingChange?.(star)}
            disabled={readonly}
            className={cn(
              'transition-all duration-200',
              !readonly && 'cursor-pointer hover:scale-110',
              readonly && 'cursor-default'
            )}
            data-testid={`star-${star}`}
          >
            <Star
              className={cn(
                sizeClasses[size],
                'transition-colors duration-200',
                filled ? 'fill-primary text-primary' : 'fill-transparent text-muted-foreground'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
