import { useLocation } from 'wouter';
import { Home, Search, Bookmark, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/search', icon: Search, label: 'Search' },
  { href: '/watchlist', icon: Bookmark, label: 'Watchlist' },
  { href: '/stats', icon: BarChart2, label: 'Stats' },
] as const;

export function BottomNav() {
  const [location, setLocation] = useLocation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white"
      style={{ borderTop: '1px solid #E2D9CE' }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map(({ href, icon: Icon, label }) => {
          const isActive =
            href === '/'
              ? location === '/'
              : location === href || location.startsWith(href + '/');
          return (
            <button
              key={href}
              onClick={() => setLocation(href)}
              className="flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl"
              style={{ color: isActive ? '#116149' : '#7E7A73' }}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.8} />
              <span
                className="text-[10px] font-bold tracking-tight"
                style={{ color: isActive ? '#116149' : '#7E7A73' }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
