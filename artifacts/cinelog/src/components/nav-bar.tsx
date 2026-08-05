import { Film, Plus, BarChart3 } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function NavBar() {
  const [location] = useLocation();

  const navItems = [
    { href: '/', label: 'Home', icon: Film },
    { href: '/stats', label: 'Stats', icon: BarChart3 },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="16" cy="18" rx="13" ry="11" fill="#C4D82E"/>
              <ellipse cx="11" cy="10" rx="5" ry="4" fill="#C4D82E"/>
              <ellipse cx="21" cy="9" rx="4" ry="3.5" fill="#C4D82E"/>
              <circle cx="13" cy="17" r="1.5" fill="#1A1A2E"/>
              <circle cx="19" cy="17" r="1.5" fill="#1A1A2E"/>
              <path d="M13 21 Q16 23.5 19 21" stroke="#1A1A2E" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            </svg>
            <h1 className="text-xl font-display font-bold tracking-tight group-hover:text-primary transition-colors">
              Spud
            </h1>
          </Link>

          <div className="flex items-center gap-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}

            <Link href="/add">
              <Button size="sm" className="gap-2" data-testid="button-add-entry">
                <Plus className="w-4 h-4" />
                Log Entry
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
