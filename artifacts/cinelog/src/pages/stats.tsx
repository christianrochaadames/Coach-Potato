import { useState, useMemo } from 'react';
import { useGetStats, useListYears } from '@workspace/api-client-react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { SpudMascot } from '@/components/spud-mascot';

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function Stats() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: yearSummaries } = useListYears();
  const { data: stats, isLoading } = useGetStats({ year: selectedYear });

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
        { name: 'Movies', value: stats.movies, color: '#116149' },
        { name: 'Shows', value: stats.shows, color: '#BDECC8' },
      ].filter(d => d.value > 0)
    : [];

  const barData = stats?.byMonth.map((m, i) => ({
    name: MONTH_LABELS[i],
    count: m.count,
  })) ?? [];

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
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-5" style={{ background: '#116149' }}>
              <p className="text-3xl font-bold text-white" data-testid="stat-total">{stats.total}</p>
              <p className="text-sm font-semibold text-white opacity-80">Total Watched</p>
            </div>
            <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
              <p className="text-3xl font-bold" style={{ color: '#FFD34D' }} data-testid="stat-avg-rating">
                {stats.averageRating != null ? stats.averageRating.toFixed(1) : '—'}
              </p>
              <p className="text-sm font-semibold" style={{ color: '#7E7A73' }}>Avg Rating ★</p>
            </div>
            <div className="rounded-2xl p-5" style={{ background: '#BDECC8' }}>
              <p className="text-3xl font-bold" style={{ color: '#116149' }} data-testid="stat-movies">{stats.movies}</p>
              <p className="text-sm font-semibold" style={{ color: '#116149' }}>Movies 🎬</p>
            </div>
            <div className="rounded-2xl p-5" style={{ background: '#9BD6FF' }}>
              <p className="text-3xl font-bold" style={{ color: '#116149' }} data-testid="stat-shows">{stats.shows}</p>
              <p className="text-sm font-semibold" style={{ color: '#116149' }}>Shows 📺</p>
            </div>
          </div>

          {/* Donut chart */}
          {donutData.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}
            >
              <p className="font-bold mb-4" style={{ color: '#111111' }}>Movies vs Shows</p>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={56}
                      dataKey="value"
                      paddingAngle={4}
                    >
                      {donutData.map(entry => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {donutData.map(d => (
                    <div key={d.name} className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="font-semibold text-sm" style={{ color: '#111111' }}>{d.name}</span>
                      <span className="text-sm" style={{ color: '#7E7A73' }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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
                <Bar dataKey="count" fill="#116149" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Tags */}
          {stats.byTag.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}
            >
              <p className="font-bold mb-3" style={{ color: '#111111' }}>Top Tags</p>
              <div className="space-y-2">
                {stats.byTag.slice(0, 6).map(({ tag, count }) => (
                  <div key={tag} className="flex items-center justify-between">
                    <span
                      className="text-sm font-semibold px-3 py-1 rounded-full"
                      style={{ background: '#EFE4D2', color: '#111111' }}
                    >
                      {tag}
                    </span>
                    <span className="text-sm font-bold" style={{ color: '#116149' }}>{count}</span>
                  </div>
                ))}
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
