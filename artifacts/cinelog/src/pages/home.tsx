import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Film, Tv, Search, Filter } from 'lucide-react';
import { useListEntries, useListYears } from '@workspace/api-client-react';
import { PosterCard } from '@/components/poster-card';
import { YearSelector } from '@/components/year-selector';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export default function Home() {
  const [, setLocation] = useLocation();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'show'>('all');
  const [minRating, setMinRating] = useState<number | undefined>(undefined);

  const { data: yearSummaries, isLoading: yearsLoading } = useListYears();
  const { data: entries, isLoading: entriesLoading } = useListEntries({
    year: selectedYear,
    type: typeFilter === 'all' ? undefined : typeFilter,
    search: searchQuery || undefined,
    minRating,
  });

  const years = useMemo(() => {
    if (!yearSummaries) return [currentYear];
    const yearList = yearSummaries.map((ys) => ys.year).sort((a, b) => b - a);
    return yearList.length > 0 ? yearList : [currentYear];
  }, [yearSummaries, currentYear]);

  const totalCount = entries?.length || 0;

  const handlePosterClick = (id: number) => {
    setLocation(`/entry/${id}`);
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="container mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="mb-12 space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-6xl font-display font-bold tracking-tight mb-2" data-testid="text-year-count">
                <span className="text-primary">{totalCount}</span>{' '}
                <span className="text-foreground">watched in {selectedYear}</span>
              </h1>
              <p className="text-muted-foreground text-lg">
                Your personal cinema vault
              </p>
            </div>
            <YearSelector
              years={years}
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search titles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" data-testid="button-type-filter">
                  {typeFilter === 'all' ? <Filter className="w-4 h-4" /> : 
                   typeFilter === 'movie' ? <Film className="w-4 h-4" /> : 
                   <Tv className="w-4 h-4" />}
                  {typeFilter === 'all' ? 'All' : typeFilter === 'movie' ? 'Movies' : 'Shows'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTypeFilter('all')} data-testid="filter-all">
                  All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter('movie')} data-testid="filter-movies">
                  Movies
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter('show')} data-testid="filter-shows">
                  Shows
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" data-testid="button-rating-filter">
                  {minRating ? `${minRating}+ Stars` : 'Any Rating'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setMinRating(undefined)} data-testid="rating-any">
                  Any Rating
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMinRating(4)} data-testid="rating-4">
                  4+ Stars
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMinRating(5)} data-testid="rating-5">
                  5 Stars Only
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Poster Grid */}
        {entriesLoading || yearsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-[2/3] rounded-lg bg-card border border-border animate-pulse" />
                <div className="h-4 bg-card rounded animate-pulse" />
                <div className="h-3 bg-card rounded w-2/3 animate-pulse" />
              </div>
            ))}
          </div>
        ) : entries && entries.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {entries.map((entry, index) => (
              <PosterCard
                key={entry.id}
                entry={entry}
                index={index}
                onClick={() => handlePosterClick(entry.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center" data-testid="empty-state">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Film className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No entries yet</h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery || typeFilter !== 'all' || minRating
                ? 'No entries match your filters'
                : `Start logging what you watched in ${selectedYear}`}
            </p>
            {!searchQuery && typeFilter === 'all' && !minRating && (
              <Button onClick={() => setLocation('/add')} data-testid="button-add-first">
                Log Your First Entry
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
