import { useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Film, Tv, ChevronLeft } from 'lucide-react';
import {
  useCreateEntry,
  getListEntriesQueryKey,
  getListYearsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { StarRating } from '@/components/star-rating';
import { useToast } from '@/hooks/use-toast';
import { PLATFORMS } from '@/lib/platforms';

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

export default function AddEntry() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createEntry = useCreateEntry();
  const [rating, setRating] = useState<number | null>(null);

  // Parse URL params for TMDB prefill
  const urlParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const prefillTitle = urlParams.get('title') ?? '';
  const prefillType = (urlParams.get('type') ?? 'movie') as 'movie' | 'show';
  const prefillPoster = urlParams.get('poster') ?? '';
  const prefillOverview = urlParams.get('overview') ?? '';
  const prefillTmdbId = urlParams.get('tmdbId') ? Number(urlParams.get('tmdbId')) : undefined;
  const prefillGenres = urlParams.get('genres') ?? '';

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
      platform: '',
    },
  });

  const selectedType = form.watch('type');
  const selectedStatus = form.watch('status');

  const onSubmit = (data: FormData) => {
    const tags = data.tags
      ? data.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    createEntry.mutate(
      {
        data: {
          title: data.title,
          type: data.type,
          status: data.status,
          posterUrl: data.posterUrl || undefined,
          dateWatched:
            data.status !== 'plan_to_watch'
              ? data.dateWatched || undefined
              : undefined,
          rating: rating || undefined,
          notes: data.notes || prefillOverview || undefined,
          synopsis: prefillOverview || undefined,
          tmdbId: prefillTmdbId,
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
          {prefillTitle ? 'Log from Search' : 'Log Entry'}
        </h1>
      </div>

      {/* TMDB poster preview */}
      {prefillPoster && (
        <div className="px-5 mb-4 flex gap-4 items-start">
          <img
            src={prefillPoster}
            alt={prefillTitle}
            className="w-20 h-28 object-cover rounded-2xl flex-shrink-0 shadow-md"
          />
          {prefillOverview && (
            <p className="text-xs line-clamp-5" style={{ color: '#7E7A73' }}>
              {prefillOverview}
            </p>
          )}
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="px-5 space-y-5 pb-10">
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
          <label className="text-sm font-bold" style={{ color: '#111111' }}>Title *</label>
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

        {/* Date (only for non-watchlist) */}
        {selectedStatus !== 'plan_to_watch' && (
          <div className="space-y-1.5">
            <label className="text-sm font-bold" style={{ color: '#111111' }}>Date Watched</label>
            <input
              type="date"
              {...form.register('dateWatched')}
              className="w-full px-4 py-3.5 rounded-2xl font-semibold focus:outline-none"
              style={{ border: '2px solid #E2D9CE', background: '#ffffff', color: '#111111' }}
              onFocus={e => (e.target.style.borderColor = '#116149')}
              onBlur={e => (e.target.style.borderColor = '#E2D9CE')}
              data-testid="input-date"
            />
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
            Platform <span style={{ color: '#7E7A73', fontWeight: 400 }}>(where you watched it)</span>
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
