import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CouchPotatoLogo({ size = 'md', className }: LogoProps) {
  const fontSize = size === 'sm' ? '1.4rem' : size === 'md' ? '2rem' : '3rem';
  return (
    <div className={cn('flex flex-col items-center leading-none select-none', className)}>
      {(['COUCH', 'POTATO'] as const).map((word) => (
        <span
          key={word}
          style={{
            fontFamily: "'Baloo 2', cursive",
            fontSize,
            fontWeight: 800,
            color: '#9BD6FF',
            WebkitTextStroke: '2px #116149',
            textShadow: '2px 3px 0px #116149',
            lineHeight: 1.05,
            display: 'block',
          }}
        >
          {word}
        </span>
      ))}
    </div>
  );
}
