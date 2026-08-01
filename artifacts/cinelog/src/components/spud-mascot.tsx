import { cn } from '@/lib/utils';

/**
 * Sprite-sheet positions for the 4 × 2 grid of Spud poses.
 *
 * Row 1 (top): relaxed | soda | walking | sleepy
 * Row 2 (bot): lying   | shocked | watching | passed-out
 *
 * background-size: 400% 200% means the full sheet is 4× the container width
 * and 2× the container height, so each cell is exactly container-sized.
 */
const POSES: Record<string, string> = {
  relaxed:     '0% 0%',
  celebrating: '33.33% 0%',
  walking:     '66.67% 0%',
  sleepy:      '100% 0%',
  lying:       '0% 100%',
  shocked:     '33.33% 100%',
  watching:    '66.67% 100%',
  tired:       '100% 100%',
};

export type SpudPose = keyof typeof POSES;

interface SpudProps {
  pose?: SpudPose;
  className?: string;
  size?: number;
  /** Round crop (true by default for small sizes, false for large) */
  round?: boolean;
}

export function SpudMascot({ pose = 'relaxed', className, size = 120, round }: SpudProps) {
  const isRound = round ?? size <= 80;
  return (
    <div
      className={cn('select-none flex-shrink-0', className)}
      style={{
        width: size,
        height: size,
        backgroundImage: 'url(/spud-poses.png)',
        backgroundSize: '400% 200%',
        backgroundPosition: POSES[pose] ?? '0% 0%',
        backgroundRepeat: 'no-repeat',
        borderRadius: isRound ? '50%' : '16px',
        overflow: 'hidden',
      }}
      aria-label="Spud mascot"
    />
  );
}
