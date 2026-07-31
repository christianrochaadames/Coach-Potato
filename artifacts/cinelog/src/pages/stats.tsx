import { useState, useMemo } from 'react';
import { Film, Tv, Star, TrendingUp } from 'lucide-react';
import { useGetStats, useListYears } from '@workspace/api-client-react';
import { YearSelector } from '@/components/year-selector';
import { StarRating } from '@/components/star-rating';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function Stats() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: yearSummaries, isLoading: yearsLoading } = useListYears();
  const { data: stats, isLoading: statsLoading } = useGetStats({ year: selectedYear });

  const years = useMemo(() => {
    if (!yearSummaries) return [currentYear];
    const yearList = yearSummaries.map((ys) => ys.year).sort((a, b) => b - a);
    return yearList.length > 0 ? yearList : [currentYear];
  }, [yearSummaries, currentYear]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const monthlyData = useMemo(() => {
    if (!stats) return [];
    return monthNames.map((name, index) => {
      const monthData = stats.byMonth.find((m) => m.month === index + 1);
      return {
        month: name,
        count: monthData?.count || 0,
      };
    });
  }, [stats]);

  const tagData = useMemo(() => {
    if (!stats) return [];
    return stats.byTag.slice(0, 8).map((tag) => ({
      name: tag.tag,
      value: tag.count,
    }));
  }, [stats]);

  const isLoading = yearsLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <div className="container mx-auto px-6 py-12">
          <div className="animate-pulse space-y-8">
            <div className="h-12 bg-card rounded w-1/3" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-card rounded" />
              ))}
            </div>
            <div className="h-96 bg-card rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <div className="container mx-auto px-6 py-12">
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <TrendingUp className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No stats available</h3>
            <p className="text-muted-foreground">
              Start logging entries to see your viewing stats
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="container mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-display font-bold mb-2">Viewing Stats</h1>
            <p className="text-muted-foreground text-lg">Your year in cinema</p>
          </div>
          <YearSelector
            years={years}
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="p-6 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Film className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">Total Watched</h3>
            </div>
            <p className="text-3xl font-display font-bold" data-testid="stat-total">
              {stats.total}
            </p>
          </div>

          <div className="p-6 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-chart-2/20 flex items-center justify-center">
                <Film className="w-5 h-5 text-[hsl(var(--chart-2))]" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">Movies</h3>
            </div>
            <p className="text-3xl font-display font-bold" data-testid="stat-movies">
              {stats.movies}
            </p>
          </div>

          <div className="p-6 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-chart-3/20 flex items-center justify-center">
                <Tv className="w-5 h-5 text-[hsl(var(--chart-3))]" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">Shows</h3>
            </div>
            <p className="text-3xl font-display font-bold" data-testid="stat-shows">
              {stats.shows}
            </p>
          </div>

          <div className="p-6 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Star className="w-5 h-5 text-primary fill-primary" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">Avg Rating</h3>
            </div>
            {stats.averageRating ? (
              <div className="flex items-center gap-3">
                <p className="text-3xl font-display font-bold" data-testid="stat-avg-rating">
                  {stats.averageRating.toFixed(1)}
                </p>
                <StarRating rating={Math.round(stats.averageRating)} readonly size="sm" />
              </div>
            ) : (
              <p className="text-3xl font-display font-bold text-muted-foreground">—</p>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Chart */}
          <div className="lg:col-span-2 p-6 rounded-lg border border-border bg-card">
            <h3 className="text-lg font-semibold mb-6">Monthly Activity</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tag Breakdown */}
          <div className="p-6 rounded-lg border border-border bg-card">
            <h3 className="text-lg font-semibold mb-6">Top Tags</h3>
            {tagData.length > 0 ? (
              <div className="space-y-4">
                {tagData.map((tag, index) => (
                  <div key={tag.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="text-sm font-medium capitalize">{tag.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{tag.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No tags yet. Add tags to your entries to see them here.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
