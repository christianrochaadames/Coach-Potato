import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  /** Set to true when the logo sits on a dark background — wraps in a white pill */
  onDark?: boolean;
  className?: string;
}

const heights = { sm: 36, md: 64, lg: 110 };

export function CouchPotatoLogo({ size = 'md', onDark = false, className }: LogoProps) {
  const h = heights[size];

  const img = (
    <img
      src="/spud-logo.png"
      alt="Spud"
      draggable={false}
      style={{
        height: h,
        width: 'auto',
        objectFit: 'contain',
        // multiply blends black→transparent against light (cream) backgrounds
        mixBlendMode: onDark ? undefined : 'multiply',
        display: 'block',
      }}
    />
  );

  if (onDark) {
    return (
      <div
        className={cn('inline-flex items-center justify-center rounded-2xl px-3 py-1 select-none', className)}
        style={{ background: '#FFF3E8' }}
      >
        {img}
      </div>
    );
  }

  return (
    <div className={cn('inline-flex select-none', className)}>
      {img}
    </div>
  );
}
