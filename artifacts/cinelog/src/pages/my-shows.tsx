import { useState } from 'react';
import { useLocation } from 'wouter';
import { Plus } from 'lucide-react';
import { useListEntries } from '@workspace/api-client-react';
import { PosterCard } from '@/components/poster-card';
import { SpudMascot } from '@/components/spud-mascot';

type TabStatus = 'completed' | 'watching' | 'plan_to_watch';

const TABS: { key: TabStatus; label: string }[] = [
  { key: 'completed', label: 'Completed' },
  { key: 'watching', label: 'Watching' },
  { key: 'plan_to_watch', label: 'Plan to Watch' },
];

export default function MyShows() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabStatus>('completed');

  const { data: entries, isLoading } = useListEntries({ status: activeTab } as any);

  const emptyMsg: Record<TabStatus, string> = {
    completed: 'Nothing completed yet. Start watching!',
    watching: "You're not watching anything right now.",
    plan_to_watch: 'Your plan-to-watch list is empty.',
  };

  return (
    <div className="min-h-full" style={{ background: '#FFF3E8' }}>
      <div className="px-5 pt-8 pb-3">
        <h1 className="text-2xl font-bold" style={{ color: '#111111' }}>My Shows</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-5 mb-5 overflow-x-auto scrollbar-hide">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors"
            style={
              activeTab === key
                ? { background: '#116149', color: '#ffffff' }
                : { background: '#ffffff', border: '1px solid #E2D9CE', color: '#7E7A73' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-5">
        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl animate-pulse" style={{ background: '#EFE4D2' }} />
            ))}
          </div>
        ) : entries && entries.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {entries.map((entry, i) => (
              <PosterCard
                key={entry.id}
                entry={entry}
                index={i}
                onClick={() => setLocation(`/entry/${entry.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-14 gap-4">
            <SpudMascot pose="sleepy" size={90} />
            <p className="text-sm text-center font-medium" style={{ color: '#7E7A73' }}>
              {emptyMsg[activeTab]}
            </p>
            <button
              onClick={() => setLocation('/search')}
              className="px-6 py-3 rounded-full font-bold text-sm text-white"
              style={{ background: '#116149' }}
            >
              Browse Search
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => setLocation('/search')}
        className="fixed bottom-20 right-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40 active:scale-95 transition-transform"
        style={{ background: '#FF4BAE' }}
        aria-label="Search to add"
      >
        <Plus className="w-7 h-7 text-white" />
      </button>
    </div>
  );
}
