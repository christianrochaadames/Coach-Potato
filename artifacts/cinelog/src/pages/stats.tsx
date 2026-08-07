import { useState, useMemo, useEffect, useRef } from 'react';
import { useGetStats, useListYears, useListEntries } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis,
} from 'recharts';
import { SpudMascot } from '@/components/spud-mascot';
import { ChevronRight } from 'lucide-react';

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const GENRE_COLORS = [
  '#4A78FF', '#FF4BAE', '#FFD34D', '#FF8B4D', '#9BD6FF',
  '#6B46C1', '#116149', '#FF4BAE', '#FFD34D', '#FF8B4D',
  '#4A78FF', '#6B46C1',
];

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span style={{ fontSize: 10, letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} style={{ color: s <= rating ? '#FFD34D' : '#D6CECC' }}>★</span>
      ))}
    </span>
  );
}

export default function Stats() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  type RatedSeason = { number: number; rating: number };
  type TopRatedItem = { id: number; title: string; posterUrl: string | null; rating: number; ratedSeasons?: RatedSeason[] };
  const [seasonPopup, setSeasonPopup] = useState<TopRatedItem | null>(null);
  const topRatedScrollRef = useRef<HTMLDivElement>(null);

  // Paint the full viewport (including below the floating nav) in the page colour
  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    const main = document.querySelector('main') as HTMLElement | null;
    const wrapper = main?.parentElement as HTMLElement | null;
    const prevMain = main?.style.background ?? '';
    const prevWrapper = wrapper?.style.background ?? '';
    document.documentElement.style.background = '#EFE4D2';
    document.body.style.background = '#EFE4D2';
    if (main) main.style.background = '#EFE4D2';
    if (wrapper) wrapper.style.background = '#EFE4D2';
    return () => {
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
      if (main) main.style.background = prevMain;
      if (wrapper) wrapper.style.background = prevWrapper;
    };
  }, []);
  const [, setLocation] = useLocation();

  const { data: yearSummaries } = useListYears();
  const { data: stats, isLoading } = useGetStats({ year: selectedYear });

  // All completed entries for the selected year (for genre chart + top rated)
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

  // Genre data for pie chart
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
    return [...counts.entries()]
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [allEntries]);

  // Top rated: one card per title. Shows with rated seasons use the series poster
  // but carry the season breakdown — clicking opens a popup.
  const topRated = useMemo((): TopRatedItem[] => {
    if (!allEntries) return [];
    const items: TopRatedItem[] = [];
    for (const e of allEntries) {
      if (e.type === 'show') {
        const seasons = (e as any).seasons as Array<{ number: number; rating?: number | null }> | undefined;
        const ratedSeasons: RatedSeason[] = (seasons ?? [])
          .filter(s => (s.rating ?? 0) > 0)
          .map(s => ({ number: s.number, rating: s.rating! }))
          .sort((a, b) => a.number - b.number);
        if (ratedSeasons.length > 0) {
          // One series card; best season rating determines sort position
          const maxRating = Math.max(...ratedSeasons.map(s => s.rating));
          items.push({ id: e.id, title: e.title, posterUrl: e.posterUrl ?? null, rating: maxRating, ratedSeasons });
        } else if ((e.rating ?? 0) > 0) {
          items.push({ id: e.id, title: e.title, posterUrl: e.posterUrl ?? null, rating: e.rating! });
        }
      } else {
        if ((e.rating ?? 0) > 0) {
          items.push({ id: e.id, title: e.title, posterUrl: e.posterUrl ?? null, rating: e.rating! });
        }
      }
    }
    return items.sort((a, b) => b.rating - a.rating).slice(0, 20);
  }, [allEntries]);

  return (
    <div className="pb-8" style={{ background: '#4A1020', borderRadius: 28, marginTop: 24, marginBottom: 100 }}>
      {/* Header */}
      <div className="px-5 pt-8 pb-4">
        <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold" style={{ color: '#FFF3E8' }}>Your Stats</h1>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          className="pl-3 pr-7 py-1 rounded-full font-bold text-xs focus:outline-none cursor-pointer"
          style={{
            border: '1.5px solid #FFB4D6',
            color: '#FFB4D6',
            background: 'transparent',
            appearance: 'none',
            WebkitAppearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23FFB4D6' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
          }}
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        </div>
        {!isLoading && stats?.total === 0 && (
          <p className="text-sm mt-4 leading-relaxed" style={{ color: '#FFD6E7', opacity: 0.85 }}>
            I'd love to show off your stats, but you haven't given me anything yet. Add what you've watched and I'll turn your viewing habits into beautiful stats.
          </p>
        )}
        {!isLoading && (stats?.total ?? 0) > 0 && (
          <p className="text-sm mt-1" style={{ color: '#FFD6E7', opacity: 0.75 }}>
            A completely unnecessary but oddly satisfying breakdown of your viewing habits.
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="px-5 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: '#EFE4D2' }} />
          ))}
        </div>
      ) : stats ? (
        <div
          className="px-5 space-y-4 pt-6 pb-6"
          style={{
            background: '#FFF3E8',
            borderRadius: 28,
            marginTop: 8,
            marginBottom: 80,
          }}
        >

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-5" style={{ background: '#FFD34D' }}>
              <p className="text-3xl font-bold" style={{ color: '#4A1020' }} data-testid="stat-total">{stats.total}</p>
              <p className="text-sm font-semibold" style={{ color: '#4A1020' }}>Total Watched</p>
            </div>
            <div className="rounded-2xl p-5" style={{ background: '#FFE4F3' }}>
              <p className="text-3xl font-bold" style={{ color: '#4A1020' }} data-testid="stat-avg-rating">
                {stats.averageRating != null ? stats.averageRating.toFixed(1) : '—'}
              </p>
              <p className="text-sm font-semibold" style={{ color: '#4A1020' }}>Avg Rating ★</p>
            </div>
          </div>

          {/* Movies vs Shows donut */}
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
              <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
                <p className="font-bold mb-4" style={{ color: '#111111' }}>Movies vs Shows</p>
                <div className="flex items-center gap-6">
                  <div
                    className="flex-shrink-0 rounded-full"
                    style={{
                      width: 112, height: 112,
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
          <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
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
                    borderRadius: '10px', border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    fontFamily: 'Manrope', fontWeight: 600,
                  }}
                />
                <Bar dataKey="count" fill="#6B46C1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Genre Breakdown — pie chart */}
          {genreData.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
              <p className="font-bold mb-4" style={{ color: '#111111' }}>Genre Breakdown</p>
              <div className="flex gap-4 items-center">
                {/* Pie */}
                <div className="flex-shrink-0" style={{ width: 140, height: 140 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={genreData}
                        dataKey="count"
                        nameKey="genre"
                        cx="50%"
                        cy="50%"
                        outerRadius={65}
                        innerRadius={32}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {genreData.map((_, idx) => (
                          <Cell key={idx} fill={GENRE_COLORS[idx % GENRE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [value, name]}
                        contentStyle={{
                          borderRadius: '10px', border: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          fontFamily: 'Manrope', fontWeight: 600, fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {genreData.slice(0, 7).map(({ genre, count }, idx) => (
                    <div key={genre} className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: GENRE_COLORS[idx % GENRE_COLORS.length] }}
                      />
                      <span className="text-xs font-semibold truncate" style={{ color: '#111111' }}>{genre}</span>
                      <span className="text-xs ml-auto flex-shrink-0" style={{ color: '#7E7A73' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Top Rated */}
          {topRated.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
              <p className="font-bold mb-4" style={{ color: '#111111' }}>Top Rated</p>
              {/* Relative wrapper so the scroll-hint circle can float over the right edge */}
              <div className="relative">
                <div ref={topRatedScrollRef} className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide items-start">
                  {topRated.map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      className="flex-shrink-0 w-24 cursor-pointer active:opacity-70 transition-opacity"
                      onClick={() => item.ratedSeasons?.length ? setSeasonPopup(item) : setLocation(`/entry/${item.id}`)}
                    >
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-1.5" style={{ background: '#EFE4D2' }}>
                        {item.posterUrl ? (
                          <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-xl font-bold" style={{ color: '#116149' }}>{item.title[0]?.toUpperCase()}</span>
                          </div>
                        )}
                        {/* Badge when multiple seasons rated */}
                        {(item.ratedSeasons?.length ?? 0) > 1 && (
                          <div className="absolute bottom-1.5 right-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: '#FF4BAE', color: '#fff' }}>
                            {item.ratedSeasons!.length}
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] font-bold truncate leading-tight" style={{ color: '#111111' }}>{item.title}</p>
                      {item.ratedSeasons?.length === 1 && (
                        <p className="text-[9px] truncate leading-tight" style={{ color: '#7E7A73' }}>Season {item.ratedSeasons[0].number}</p>
                      )}
                      {item.ratedSeasons && item.ratedSeasons.length > 1 && (
                        <p className="text-[9px] truncate leading-tight" style={{ color: '#7E7A73' }}>{item.ratedSeasons.length} seasons</p>
                      )}
                      {item.rating > 0 && <StarDisplay rating={item.rating} />}
                    </div>
                  ))}
                </div>

                {/* Scroll hint — floats over the right edge, same style as home page "+" button */}
                {topRated.length > 3 && (
                  <div
                    className="absolute flex items-center justify-center"
                    style={{ top: 0, height: 144, width: 40, right: -20 }}
                  >
                    <button
                      aria-label="Scroll right"
                      className="w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-transform"
                      style={{ background: '#BDECC8', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
                      onClick={() => topRatedScrollRef.current?.scrollBy({ left: 250, behavior: 'smooth' })}
                    >
                      <ChevronRight className="w-6 h-6" style={{ color: '#116149' }} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Season breakdown popup */}
          {seasonPopup && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center"
              style={{ background: 'rgba(0,0,0,0.45)' }}
              onClick={() => setSeasonPopup(null)}
            >
              <div
                className="w-full max-w-sm rounded-t-3xl p-6 pb-8"
                style={{ background: '#FFF3E8' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#D4C9BC' }} />
                <div className="flex gap-4 mb-5">
                  {seasonPopup.posterUrl ? (
                    <img src={seasonPopup.posterUrl} alt={seasonPopup.title} className="w-14 rounded-xl object-cover flex-shrink-0" style={{ aspectRatio: '2/3' }} />
                  ) : (
                    <div className="w-14 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ aspectRatio: '2/3', background: '#EFE4D2' }}>
                      <span className="font-bold text-lg" style={{ color: '#116149' }}>{seasonPopup.title[0]}</span>
                    </div>
                  )}
                  <div className="flex flex-col justify-center">
                    <p className="font-bold text-base leading-tight" style={{ color: '#111111' }}>{seasonPopup.title}</p>
                    <p className="text-xs mt-1" style={{ color: '#7E7A73' }}>Your rated seasons</p>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  {seasonPopup.ratedSeasons?.map(s => (
                    <div key={s.number} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: '#EFE4D2' }}>
                      <span className="text-sm font-semibold" style={{ color: '#111111' }}>Season {s.number}</span>
                      <StarDisplay rating={s.rating} />
                    </div>
                  ))}
                </div>
                <button
                  className="w-full py-3 rounded-xl text-sm font-bold"
                  style={{ background: '#116149', color: '#ffffff' }}
                  onClick={() => { setSeasonPopup(null); setLocation(`/entry/${seasonPopup.id}`); }}
                >
                  View Series
                </button>
              </div>
            </div>
          )}

        </div>
      ) : (
        <div
          className="flex flex-col items-center py-16 gap-4 px-5"
          style={{ background: '#FFF3E8', borderRadius: 28, marginTop: 8 }}
        >
          <SpudMascot pose="sleepy" size={96} />
          <p className="text-sm text-center font-medium" style={{ color: '#7E7A73' }}>
            No data for {selectedYear} yet
          </p>
        </div>
      )}
    </div>
  );
}
