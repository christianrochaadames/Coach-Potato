import { useState, useMemo } from 'react';
import { useGetStats, useListYears, useListEntries } from '@workspace/api-client-react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { SpudMascot } from '@/components/spud-mascot';

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

// Genre bar palette — brand-rooted but balanced, no rainbow
const GENRE_COLORS = [
  '#4A78FF', '#FF4BAE', '#FFD34D', '#FF8B4D', '#9BD6FF',
  '#6B46C1', '#4A78FF', '#FF4BAE', '#FFD34D', '#FF8B4D',
  '#9BD6FF', '#6B46C1',
];

// Platform bar palette — same brand colors, offset so they feel distinct
const PLATFORM_COLORS = [
  '#116149', '#4A78FF', '#FF4BAE', '#FFD34D', '#FF8B4D',
  '#9BD6FF', '#6B46C1', '#116149', '#4A78FF', '#FF4BAE',
];

export default function Stats() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<string | null>(null);

  const { data: yearSummaries } = useListYears();
  const { data: stats, isLoading } = useGetStats({ year: selectedYear });

  // Fetch completed entries for the selected year to build genre/platform charts
  const { data: allEntries } = useListEntries({ status: 'completed', year: selectedYear } as any);

  const years = useMemo(() => {
    if (!yearSummaries) return [currentYear];
    const list = yearSummaries
      .filter(y => y.year != null)
      .map(y => y.year as number)
      .sort((a, b) => b - a);
    return list.length > 0 ? list : [currentYear];
  }, [yearSummaries, currentYear]);

  const donutData = stats
    ? [
        { name: '🎬 Movies', value: stats.movies, color: '#4A78FF' },
        { name: '📺 Shows', value: stats.shows, color: '#FF4BAE' },
      ].filter(d => d.value > 0)
    : [];

  const barData = stats?.byMonth.map((m, i) => ({
    name: MONTH_LABELS[i],
    count: m.count,
  })) ?? [];

  // Build genre breakdown from entries filtered to selectedYear
  const genreData = useMemo(() => {
    if (!allEntries) return [];
    const counts = new Map<string, number>();
    for (const entry of allEntries) {
      const tags = (entry as any).tags as string[] | null;
      if (!tags) continue;
      for (const tag of tags) {
        if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    const total = allEntries.length || 1;
    return [...counts.entries()]
      .map(([genre, count]) => ({ genre, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [allEntries]);

  const maxGenreCount = genreData[0]?.count ?? 1;

  // Build platform breakdown from entries filtered to selectedYear.
  // Entries without a platform are counted separately and rendered at the bottom
  // with distinct "not tracked" styling so they don't pollute the real stats.
  const platformData = useMemo(() => {
    if (!allEntries) return [];
    const counts = new Map<string, number>();
    let untracked = 0;
    for (const entry of allEntries) {
      const platform = ((entry as any).platform as string | null | undefined);
      if (platform && platform.trim()) {
        counts.set(platform.trim(), (counts.get(platform.trim()) ?? 0) + 1);
      } else {
        untracked++;
      }
    }
    const total = allEntries.length || 1;
    const tracked = [...counts.entries()]
      .map(([platform, count]) => ({
        platform,
        count,
        pct: Math.round((count / total) * 100),
        untracked: false,
      }))
      .sort((a, b) => b.count - a.count);
    if (untracked > 0) {
      tracked.push({
        platform: 'Not tracked',
        count: untracked,
        pct: Math.round((untracked / total) * 100),
        untracked: true,
      });
    }
    return tracked;
  }, [allEntries]);

  const maxPlatformCount = platformData[0]?.count ?? 1;

  return (
    <div className="min-h-full pb-8" style={{ background: '#FFF3E8' }}>
      <div className="px-5 pt-8 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: '#111111' }}>Stats</h1>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          className="px-4 py-1.5 rounded-full font-bold text-sm focus:outline-none cursor-pointer"
          style={{ border: '2px solid #116149', color: '#116149', background: '#ffffff' }}
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="px-5 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: '#EFE4D2' }} />
          ))}
        </div>
      ) : stats ? (
        <div className="px-5 space-y-4">
          {/* Summary cards — 2 cards only, movie/show detail lives in the donut */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-5" style={{ background: '#FFD34D' }}>
              <p className="text-3xl font-bold" style={{ color: '#111111' }} data-testid="stat-total">{stats.total}</p>
              <p className="text-sm font-semibold" style={{ color: '#111111', opacity: 0.7 }}>Total Watched</p>
            </div>
            <div className="rounded-2xl p-5" style={{ background: '#FFE4F3' }}>
              <p className="text-3xl font-bold" style={{ color: '#FF4BAE' }} data-testid="stat-avg-rating">
                {stats.averageRating != null ? stats.averageRating.toFixed(1) : '—'}
              </p>
              <p className="text-sm font-semibold" style={{ color: '#c73b8e' }}>Avg Rating ★</p>
            </div>
          </div>

          {/* Movies vs Shows — CSS conic-gradient donut */}
          {donutData.length > 0 && (() => {
            const total = donutData.reduce((s, x) => s + x.value, 0);
            let cumPct = 0;
            const stops = donutData.map(d => {
              const pct = total > 0 ? (d.value / total) * 100 : 0;
              const stop = `${d.color} ${cumPct.toFixed(1)}% ${(cumPct + pct).toFixed(1)}%`;
              cumPct += pct;
              return stop;
            });
            const gradient = `conic-gradient(from -90deg, ${stops.join(', ')})`;
            return (
              <div
                className="rounded-2xl p-5"
                style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}
              >
                <p className="font-bold mb-4" style={{ color: '#111111' }}>Movies vs Shows</p>
                <div className="flex items-center gap-6">
                  {/* CSS donut — no library needed */}
                  <div
                    className="flex-shrink-0 rounded-full"
                    style={{
                      width: 112,
                      height: 112,
                      background: gradient,
                      WebkitMask: 'radial-gradient(circle, transparent 36px, black 37px)',
                      mask: 'radial-gradient(circle, transparent 36px, black 37px)',
                    }}
                  />
                  <div className="space-y-3">
                    {donutData.map(d => {
                      const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                      return (
                        <div key={d.name} className="flex items-center gap-2.5">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className="font-semibold text-sm" style={{ color: '#111111' }}>{d.name}</span>
                          <span className="text-sm" style={{ color: '#7E7A73' }}>{d.value}</span>
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#EFE4D2', color: '#116149' }}>{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Monthly bar chart */}
          <div
            className="rounded-2xl p-5"
            style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}
          >
            <p className="font-bold mb-4" style={{ color: '#111111' }}>Monthly Activity</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={barData} barSize={16} barCategoryGap="25%">
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#7E7A73', fontFamily: 'Manrope' }}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: '#EFE4D2' }}
                  contentStyle={{
                    borderRadius: '10px',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    fontFamily: 'Manrope',
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="count" fill="#6B46C1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Platform breakdown — interactive horizontal bars */}
          {platformData.length > 0 && (() => {
            const trackedRows = platformData.filter(d => !d.untracked);
            const untrackedRow = platformData.find(d => d.untracked);
            // maxPlatformCount is already derived from the first element (largest)
            return (
              <div
                className="rounded-2xl p-5"
                style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}
              >
                <p className="font-bold mb-1" style={{ color: '#111111' }}>Platform Breakdown</p>
                <p className="text-xs mb-4" style={{ color: '#7E7A73' }}>
                  Tap a platform to highlight · {selectedYear}
                </p>
                <div className="space-y-2.5">
                  {trackedRows.map(({ platform, count, pct }, idx) => {
                    const color = PLATFORM_COLORS[idx % PLATFORM_COLORS.length];
                    const isActive = activePlatform === platform;
                    const isDimmed = activePlatform !== null && !isActive;
                    return (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => setActivePlatform(isActive ? null : platform)}
                        className="w-full text-left transition-opacity"
                        style={{ opacity: isDimmed ? 0.35 : 1 }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className="text-xs font-bold"
                            style={{ color: isActive ? color : '#111111' }}
                          >
                            {platform}
                          </span>
                          <span className="text-xs font-bold" style={{ color: '#7E7A73' }}>
                            {count} · {pct}%
                          </span>
                        </div>
                        <div
                          className="h-2 rounded-full overflow-hidden"
                          style={{ background: '#EFE4D2' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(count / maxPlatformCount) * 100}%`,
                              background: color,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}

                  {/* Untracked row — visually separated, greyed out, non-interactive */}
                  {untrackedRow && (
                    <>
                      {trackedRows.length > 0 && (
                        <div className="border-t pt-2.5" style={{ borderColor: '#E2D9CE' }} />
                      )}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold" style={{ color: '#B0A99E' }}>
                            Not tracked
                          </span>
                          <span className="text-xs font-bold" style={{ color: '#B0A99E' }}>
                            {untrackedRow.count} · {untrackedRow.pct}%
                          </span>
                        </div>
                        <div
                          className="h-2 rounded-full overflow-hidden"
                          style={{ background: '#EFE4D2' }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(untrackedRow.count / maxPlatformCount) * 100}%`,
                              background: '#C4B9AD',
                              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.35) 3px, rgba(255,255,255,0.35) 6px)',
                            }}
                          />
                        </div>
                        <p className="text-xs mt-1.5" style={{ color: '#B0A99E' }}>
                          {untrackedRow.count} {untrackedRow.count === 1 ? 'title has' : 'titles have'} no platform set — open the entry to add one
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Genre breakdown — interactive horizontal bars (bottom of page) */}
          {genreData.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}
            >
              <p className="font-bold mb-1" style={{ color: '#111111' }}>Genre Breakdown · {selectedYear}</p>
              <p className="text-xs mb-4" style={{ color: '#7E7A73' }}>
                Tap a genre to highlight · based on titles watched in {selectedYear}
              </p>
              <div className="space-y-2.5">
                {genreData.map(({ genre, count, pct }, idx) => {
                  const color = GENRE_COLORS[idx % GENRE_COLORS.length];
                  const isActive = activeGenre === genre;
                  const isDimmed = activeGenre !== null && !isActive;
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => setActiveGenre(isActive ? null : genre)}
                      className="w-full text-left transition-opacity"
                      style={{ opacity: isDimmed ? 0.35 : 1 }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="text-xs font-bold"
                          style={{ color: isActive ? color : '#111111' }}
                        >
                          {genre}
                        </span>
                        <span className="text-xs font-bold" style={{ color: '#7E7A73' }}>
                          {count} · {pct}%
                        </span>
                      </div>
                      <div
                        className="h-2 rounded-full overflow-hidden"
                        style={{ background: '#EFE4D2' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(count / maxGenreCount) * 100}%`,
                            background: color,
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center py-16 gap-4 px-5">
          <SpudMascot pose="sleepy" size={96} />
          <p className="text-sm text-center font-medium" style={{ color: '#7E7A73' }}>
            No data for {selectedYear} yet
          </p>
        </div>
      )}
    </div>
  );
}
