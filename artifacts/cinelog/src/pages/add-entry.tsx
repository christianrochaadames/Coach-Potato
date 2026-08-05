import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Film, Tv, ChevronLeft, Search, X, Loader2 } from 'lucide-react';
import {
  useCreateEntry,
  getListEntriesQueryKey,
  getListYearsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { StarRating } from '@/components/star-rating';
import { useToast } from '@/hooks/use-toast';
import { PLATFORMS } from '@/lib/platforms';

// ---------- TMDB types & hook ----------

interface TmdbItem {
  tmdbId: number;
  title: string;
  type: 'movie' | 'show';
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
}

function useTmdbSearch(query: string) {
  const [results, setResults] = useState<TmdbItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [noKey, setNoKey] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`);
        if (res.status === 503) { setNoKey(true); setLoading(false); return; }
        const data = await res.json();
        setResults(data.results ?? []);
        setNoKey(false);
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading, noKey };
}

// ---------- Form schema ----------

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['movie', 'show']),
  status: z.enum(['watching', 'plan_to_watch', 'completed']),
  posterUrl: z.string().optional(),
  dateWatched: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
  platform: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

// ---------- Component ----------

export default function AddEntry() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createEntry = useCreateEntry();
  const [rating, setRating] = useState<number | null>(null);
  const currentYear = new Date().getFullYear();
  const [watchedYear, setWatchedYear] = useState(currentYear);

  // Parse URL params for TMDB prefill (coming from search page)
  const urlParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const prefillTitle = urlParams.get('title') ?? '';
  const prefillType = (urlParams.get('type') ?? 'movie') as 'movie' | 'show';
  const prefillPoster = urlParams.get('poster') ?? '';
  const prefillOverview = urlParams.get('overview') ?? '';
  const prefillTmdbId = urlParams.get('tmdbId') ? Number(urlParams.get('tmdbId')) : undefined;
  const prefillGenres = urlParams.get('genres') ?? '';
  const prefillPlatform = urlParams.get('platform') ?? '';

  // Inline TMDB search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedTmdb, setSelectedTmdb] = useState<TmdbItem | null>(
    prefillTitle
      ? {
          tmdbId: prefillTmdbId ?? 0,
          title: prefillTitle,
          type: prefillType,
          year: null,
          posterUrl: prefillPoster || null,
          overview: prefillOverview || null,
        }
      : null
  );
  const { results, loading: searching, noKey } = useTmdbSearch(searchQuery);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: prefillTitle,
      type: prefillType,
      status: 'completed',
      posterUrl: prefillPoster,
      dateWatched: new Date().toISOString().split('T')[0],
      notes: '',
      tags: prefillGenres, // auto-populated from TMDB genre_ids
      platform: prefillPlatform,
    },
  });

  const selectedType = form.watch('type');
  const selectedStatus = form.watch('status');
  const watchedPosterUrl = form.watch('posterUrl');

  // Apply a TMDB result to the form
  const applyTmdbResult = (item: TmdbItem) => {
    setSelectedTmdb(item);
    form.setValue('title', item.title, { shouldValidate: true });
    form.setValue('type', item.type);
    if (item.posterUrl) form.setValue('posterUrl', item.posterUrl);
    setSearchQuery('');
    setShowDropdown(false);
    searchInputRef.current?.blur();
  };

  const clearTmdbSelection = () => {
    setSelectedTmdb(null);
    form.setValue('posterUrl', '');
  };

  const onSubmit = (data: FormData) => {
    const tags = data.tags
      ? data.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    const overview = selectedTmdb?.overview ?? prefillOverview;

    createEntry.mutate(
      {
        data: {
          title: data.title,
          type: data.type,
          status: data.status,
          posterUrl: data.posterUrl || undefined,
          dateWatched:
            data.status !== 'plan_to_watch'
              ? `${watchedYear}-01-01`
              : undefined,
          rating: rating || undefined,
          notes: data.notes || overview || undefined,
          synopsis: overview || undefined,
          tmdbId: selectedTmdb?.tmdbId || prefillTmdbId,
          platform: data.platform || undefined,
          tags,
        } as any,
      },
      {
        onSuccess: entry => {
          toast({ title: '✓ Logged!', description: `${entry.title} saved` });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListYearsQueryKey() });
          setLocation('/');
        },
        onError: () =>
          toast({ title: 'Error', description: 'Could not save entry', variant: 'destructive' }),
      }
    );
  };

  const STATUS_OPTIONS = [
    { key: 'completed' as const, label: '✓ Watched', activeBg: '#116149', activeColor: '#ffffff' },
    { key: 'watching' as const, label: '▶ Watching', activeBg: '#9BD6FF', activeColor: '#116149' },
    { key: 'plan_to_watch' as const, label: '🔖 Watchlist', activeBg: '#BDECC8', activeColor: '#116149' },
  ];

  // Derived: show poster either from selection or manually entered URL
  const posterToShow = selectedTmdb?.posterUrl ?? watchedPosterUrl ?? '';

  return (
    <div className="min-h-full" style={{ background: '#FFF3E8' }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-3 flex items-center gap-3">
        <button
          onClick={() => setLocation('/')}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: '#111111' }} />
        </button>
        <h1 className="text-xl font-bold" style={{ color: '#111111' }}>
          Log Entry
        </h1>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="px-5 space-y-5 pb-10">

        {/* ── TMDB Search ── */}
        <div className="space-y-2">
          <label className="text-sm font-bold" style={{ color: '#111111' }}>
            Search for a title
            <span className="ml-1.5 font-normal" style={{ color: '#7E7A73' }}>(auto-fills details)</span>
          </label>

          {/* Selected poster preview */}
          {posterToShow && selectedTmdb && (
            <div
              className="flex gap-3 items-start p-3 rounded-2xl"
              style={{ background: 'rgba(17,97,73,0.06)', border: '1.5px solid rgba(17,97,73,0.18)' }}
            >
              <img
                src={posterToShow}
                alt={selectedTmdb.title}
                className="w-14 h-20 object-cover rounded-xl flex-shrink-0 shadow"
              />
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="font-bold text-sm leading-tight truncate" style={{ color: '#111111' }}>
                  {selectedTmdb.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#7E7A73' }}>
                  {selectedTmdb.type === 'movie' ? '🎬 Movie' : '📺 TV Show'}
                  {selectedTmdb.year ? ` · ${selectedTmdb.year}` : ''}
                </p>
                {selectedTmdb.overview && (
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: '#7E7A73' }}>
                    {selectedTmdb.overview}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={clearTmdbSelection}
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(0,0,0,0.08)' }}
                aria-label="Clear selection"
              >
                <X className="w-3.5 h-3.5" style={{ color: '#7E7A73' }} />
              </button>
            </div>
          )}

          {/* Search input + dropdown */}
          <div className="relative" ref={dropdownRef}>
            <div
              className="flex items-center gap-2 px-4 rounded-2xl"
              style={{ border: '2px solid #E2D9CE', background: '#ffffff', transition: 'border-color 0.15s' }}
              onFocus={() => undefined}
            >
              {searching
                ? <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: '#116149' }} />
                : <Search className="w-4 h-4 flex-shrink-0" style={{ color: '#7E7A73' }} />
              }
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                onFocus={() => { if (searchQuery.trim() || results.length) setShowDropdown(true); }}
                placeholder={selectedTmdb ? 'Search for a different title…' : 'Type a movie or show name…'}
                className="flex-1 py-3.5 bg-transparent font-semibold focus:outline-none"
                style={{ color: '#111111', fontSize: '0.875rem' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setShowDropdown(false); }}
                  className="w-5 h-5 flex items-center justify-center flex-shrink-0"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" style={{ color: '#7E7A73' }} />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && (results.length > 0 || (searching && searchQuery)) && (
              <div
                className="absolute left-0 right-0 mt-1 rounded-2xl overflow-hidden z-50 shadow-lg"
                style={{ background: '#ffffff', border: '1.5px solid #E2D9CE', maxHeight: '320px', overflowY: 'auto' }}
              >
                {results.map((item, idx) => (
                  <button
                    key={item.tmdbId}
                    type="button"
                    onMouseDown={() => applyTmdbResult(item)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                    style={{
                      borderBottom: idx < results.length - 1 ? '1px solid #F0EBE4' : undefined,
                    }}
                  >
                    {item.posterUrl ? (
                      <img
                        src={item.posterUrl}
                        alt={item.title}
                        className="w-9 h-12 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-9 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: '#F0EBE4' }}
                      >
                        {item.type === 'movie'
                          ? <Film className="w-4 h-4" style={{ color: '#B0A99E' }} />
                          : <Tv className="w-4 h-4" style={{ color: '#B0A99E' }} />
                        }
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm leading-tight truncate" style={{ color: '#111111' }}>
                        {item.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#7E7A73' }}>
                        {item.type === 'movie' ? '🎬 Movie' : '📺 TV Show'}
                        {item.year ? ` · ${item.year}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No key warning */}
            {noKey && (
              <p className="mt-1.5 text-xs px-1" style={{ color: '#e53e3e' }}>
                TMDB API key not configured — search unavailable.
              </p>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label className="text-sm font-bold" style={{ color: '#111111' }}>Status</label>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map(({ key, label, activeBg, activeColor }) => (
              <button
                key={key}
                type="button"
                onClick={() => form.setValue('status', key)}
                className="flex-1 py-2 rounded-full text-xs font-bold transition-all"
                style={
                  selectedStatus === key
                    ? { background: activeBg, color: activeColor }
                    : { background: '#ffffff', border: '1px solid #E2D9CE', color: '#7E7A73' }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Type */}
        <div className="space-y-2">
          <label className="text-sm font-bold" style={{ color: '#111111' }}>Type</label>
          <div className="grid grid-cols-2 gap-3">
            {(['movie', 'show'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => form.setValue('type', t)}
                className="py-4 rounded-2xl flex flex-col items-center gap-1.5 transition-all"
                style={
                  selectedType === t
                    ? { border: '2px solid #116149', background: 'rgba(17,97,73,0.08)' }
                    : { border: '2px solid #E2D9CE', background: '#ffffff' }
                }
                data-testid={t === 'movie' ? 'button-type-movie' : 'button-type-show'}
              >
                {t === 'movie'
                  ? <Film className="w-5 h-5" style={{ color: selectedType === 'movie' ? '#116149' : '#7E7A73' }} />
                  : <Tv className="w-5 h-5" style={{ color: selectedType === 'show' ? '#116149' : '#7E7A73' }} />
                }
                <span
                  className="text-xs font-bold"
                  style={{ color: selectedType === t ? '#116149' : '#7E7A73' }}
                >
                  {t === 'movie' ? 'Movie' : 'TV Show'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-sm font-bold" style={{ color: '#111111' }}>
            Title *
            <span className="ml-1.5 font-normal" style={{ color: '#7E7A73' }}>(auto-filled or enter manually)</span>
          </label>
          <input
            {...form.register('title')}
            placeholder="Enter title..."
            className="w-full px-4 py-3.5 rounded-2xl font-semibold focus:outline-none"
            style={{ border: '2px solid #E2D9CE', background: '#ffffff', color: '#111111' }}
            onFocus={e => (e.target.style.borderColor = '#116149')}
            onBlur={e => (e.target.style.borderColor = '#E2D9CE')}
            data-testid="input-title"
          />
          {form.formState.errors.title && (
            <p className="text-xs" style={{ color: '#e53e3e' }}>
              {form.formState.errors.title.message}
            </p>
          )}
        </div>

        {/* Poster URL (manual fallback, collapsed when TMDB selected) */}
        {!selectedTmdb?.posterUrl && (
          <div className="space-y-1.5">
            <label className="text-sm font-bold" style={{ color: '#111111' }}>
              Poster URL
              <span className="ml-1.5 font-normal" style={{ color: '#7E7A73' }}>(optional — auto-filled by search)</span>
            </label>
            <input
              {...form.register('posterUrl')}
              placeholder="https://..."
              className="w-full px-4 py-3.5 rounded-2xl font-semibold focus:outline-none"
              style={{ border: '2px solid #E2D9CE', background: '#ffffff', color: '#111111' }}
              onFocus={e => (e.target.style.borderColor = '#116149')}
              onBlur={e => (e.target.style.borderColor = '#E2D9CE')}
            />
          </div>
        )}

        {/* Year (only for non-watchlist) */}
        {selectedStatus !== 'plan_to_watch' && (
          <div className="space-y-1.5">
            <label className="text-sm font-bold" style={{ color: '#111111' }}>
              {selectedStatus === 'completed' ? 'Year Watched' : 'Year Started'}
              <span className="ml-1.5 font-normal" style={{ color: '#7E7A73' }}>(you can add the exact date later)</span>
            </label>
            <select
              value={watchedYear}
              onChange={e => setWatchedYear(Number(e.target.value))}
              className="w-full px-4 py-3.5 rounded-2xl font-semibold focus:outline-none"
              style={{ border: '2px solid #E2D9CE', background: '#ffffff', color: '#111111', appearance: 'none' }}
              data-testid="input-year"
            >
              {Array.from({ length: currentYear - 1950 + 1 }, (_, i) => currentYear - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        {/* Rating */}
        <div className="space-y-1.5">
          <label className="text-sm font-bold" style={{ color: '#111111' }}>Rating</label>
          <StarRating rating={rating} onRatingChange={setRating} size="lg" />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-sm font-bold" style={{ color: '#111111' }}>
            Notes <span style={{ color: '#7E7A73', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            {...form.register('notes')}
            rows={3}
            placeholder="Your thoughts..."
            className="w-full px-4 py-3 rounded-2xl font-medium focus:outline-none resize-none"
            style={{ border: '2px solid #E2D9CE', background: '#ffffff', color: '#111111', fontFamily: 'Manrope, sans-serif' }}
            onFocus={e => (e.target.style.borderColor = '#116149')}
            onBlur={e => (e.target.style.borderColor = '#E2D9CE')}
            data-testid="input-notes"
          />
        </div>

        {/* Platform */}
        <div className="space-y-2">
          <label className="text-sm font-bold" style={{ color: '#111111' }}>
            Platform <span style={{ color: '#7E7A73', fontWeight: 400 }}>(pick one to keep your stats accurate)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => {
              const selected = form.watch('platform') === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => form.setValue('platform', selected ? '' : p)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={
                    selected
                      ? { background: '#4A78FF', color: '#ffffff' }
                      : { background: '#ffffff', border: '1px solid #E2D9CE', color: '#7E7A73' }
                  }
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label className="text-sm font-bold" style={{ color: '#111111' }}>
            Tags <span style={{ color: '#7E7A73', fontWeight: 400 }}>(comma-separated)</span>
          </label>
          <input
            {...form.register('tags')}
            placeholder="action, thriller, rewatch"
            className="w-full px-4 py-3.5 rounded-2xl font-semibold focus:outline-none"
            style={{ border: '2px solid #E2D9CE', background: '#ffffff', color: '#111111' }}
            onFocus={e => (e.target.style.borderColor = '#116149')}
            onBlur={e => (e.target.style.borderColor = '#E2D9CE')}
            data-testid="input-tags"
          />
        </div>

        <button
          type="submit"
          disabled={createEntry.isPending}
          className="w-full py-4 rounded-full font-bold text-base text-white transition-opacity disabled:opacity-60"
          style={{ background: '#116149' }}
          data-testid="button-submit"
        >
          {createEntry.isPending ? 'Saving...' : 'Save Entry'}
        </button>
      </form>
    </div>
  );
}
