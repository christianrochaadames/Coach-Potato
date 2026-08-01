import { cn } from '@/lib/utils';

interface SpudProps {
  pose?: string; // kept for API compat
  className?: string;
  size?: number;
  round?: boolean;
}

export function SpudMascot({ className, size = 120, round = false }: SpudProps) {
  return (
    <img
      src="/spud.jpeg"
      alt="Spud mascot"
      draggable={false}
      className={cn('select-none flex-shrink-0', className)}
      style={{
        width: size,
        height: size,
        borderRadius: round ? '50%' : 0,
        objectFit: 'contain',
        // multiply blend removes the cream/white JPEG background against
        // the app's warm-cream (#FFF3E8) surface — outlines stay crisp.
        mixBlendMode: 'multiply',
        display: 'block',
      }}
    />
  );
}
