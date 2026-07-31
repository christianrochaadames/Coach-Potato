import { Film, Plus, BarChart3 } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function NavBar() {
  const [location] = useLocation();

  const navItems = [
    { href: '/', label: 'Your Films', icon: Film },
    { href: '/stats', label: 'Stats', icon: BarChart3 },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Film className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-display font-bold tracking-tight group-hover:text-primary transition-colors">
              CineLog
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
