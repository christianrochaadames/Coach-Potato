import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  /** Set to true when the logo sits on a dark background — wraps in a white pill */
  onDark?: boolean;
  className?: string;
}

const heights = { sm: 36, md: 64, lg: 90 };

export function CouchPotatoLogo({ size = 'md', onDark = false, className }: LogoProps) {
  const h = heights[size];

  const img = (
    <img
      src="/logo.jpeg"
      alt="Couch Potato"
      draggable={false}
      style={{
        height: h,
        width: 'auto',
        objectFit: 'contain',
        // multiply blends white→transparent against light (cream) backgrounds
        mixBlendMode: onDark ? undefined : 'multiply',
        display: 'block',
      }}
    />
  );

  if (onDark) {
    // On dark backgrounds wrap in a cream rounded pill so the jpeg white
    // background blends in and the bubble letters stay readable.
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
