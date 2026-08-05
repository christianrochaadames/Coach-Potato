import { useLocation } from 'wouter';
import { Home, Search, Bookmark, BarChart2 } from 'lucide-react';

const tabs = [
  { href: '/', icon: Home },
  { href: '/search', icon: Search },
  { href: '/watchlist', icon: Bookmark },
  { href: '/stats', icon: BarChart2 },
] as const;

export function BottomNav() {
  const [location, setLocation] = useLocation();
  return (
    <nav className="fixed bottom-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div
        className="flex items-center gap-1 px-3 py-3 pointer-events-auto"
        style={{
          background: 'rgba(255,243,232,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 999,
          border: '1.5px solid rgba(255,255,255,0.6)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        }}
      >
        {tabs.map(({ href, icon: Icon }) => {
          const isActive =
            href === '/'
              ? location === '/'
              : location === href || location.startsWith(href + '/');
          return (
            <button
              key={href}
              onClick={() => setLocation(href)}
              className="flex items-center justify-center transition-all duration-200"
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                background: isActive ? '#9BD6FF' : 'transparent',
                color: isActive ? '#111111' : '#9E9890',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
