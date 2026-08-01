import { cn } from '@/lib/utils';

interface SpudProps {
  pose?: string; // kept for API compat, single image now
  className?: string;
  size?: number;
  round?: boolean;
}

export function SpudMascot({ className, size = 120, round }: SpudProps) {
  const isRound = round ?? size <= 80;
  return (
    <img
      src="/spud.jpeg"
      alt="Spud mascot"
      draggable={false}
      className={cn('select-none flex-shrink-0 object-contain', className)}
      style={{
        width: size,
        height: size,
        borderRadius: isRound ? '50%' : '16px',
        objectFit: 'cover',
        objectPosition: 'center top',
      }}
    />
  );
}
