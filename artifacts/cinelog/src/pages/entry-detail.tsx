import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Film, Tv, Edit2, Trash2, X, Calendar, ChevronLeft, Monitor, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { PLATFORMS } from '@/lib/platforms';
import {
  useGetEntry,
  useUpdateEntry,
  useDeleteEntry,
  getGetEntryQueryKey,
  getListEntriesQueryKey,
  getListYearsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { StarRating } from '@/components/star-rating';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['movie', 'show']),
  status: z.enum(['watching', 'plan_to_watch', 'completed']),
  posterUrl: z.string().optional().or(z.literal('')),
  dateWatched: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
  platform: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function EntryDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [seasonCount, setSeasonCount] = useState<number | null>(null);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [seasonSheet, setSeasonSheet] = useState<{
    num: number;
    rating: number | null;
    note: string;
    editing: boolean; // true = editing existing, false = marking new
  } | null>(null);
  const [tmdbDetail, setTmdbDetail] = useState<{
    cast: Array<{ name: string; character: string; profileUrl: string | null }>;
    directors: Array<{ name: string; job: string }>;
    voteAverage: number | null;
    genres: string[];
  } | null>(null);
  const [tmdbDetailLoading, setTmdbDetailLoading] = useState(false);

  const entryId = params.id ? Number(params.id) : undefined;
  const { data: entry, isLoading } = useGetEntry(entryId!, {
    query: {
      enabled: !!entryId,
      queryKey: getGetEntryQueryKey(entryId!),
    },
  });

  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      type: 'movie',
      status: 'completed',
      posterUrl: '',
      dateWatched: '',
      notes: '',
      tags: '',
      platform: '',
    },
  });

  // Initialize form when entry loads
  useEffect(() => {
    if (entry) {
      form.reset({
        title: entry.title,
        type: entry.type,
        status: (entry.status ?? 'completed') as 'watching' | 'plan_to_watch' | 'completed',
        posterUrl: entry.posterUrl ?? '',
        dateWatched: entry.dateWatched ?? '',
        notes: entry.notes ?? '',
        tags: entry.tags?.join(', ') ?? '',
        platform: (entry as any).platform ?? '',
      });
      setRating(entry.rating ?? null);
    }
  }, [entry, form]);

  // Fetch season count from TMDB for shows
  useEffect(() => {
    if (!entry || entry.type !== 'show' || !entry.tmdbId) { setSeasonCount(null); return; }
    fetch(`/api/tmdb/show/${entry.tmdbId}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setSeasonCount(d.numberOfSeasons ?? null))
      .catch(() => {});
  }, [entry?.tmdbId, entry?.type]);

  // Fetch cast + director from TMDB
  useEffect(() => {
    if (!entry?.tmdbId) { setTmdbDetail(null); return; }
    const endpoint = entry.type === 'movie'
      ? `/api/tmdb/movie/${entry.tmdbId}`
      : `/api/tmdb/tv/${entry.tmdbId}`;
    setTmdbDetailLoading(true);
    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setTmdbDetail({
          cast: d.cast ?? [],
          directors: d.directors ?? [],
          voteAverage: d.voteAverage ?? null,
          genres: d.genres ?? [],
        });
      })
      .catch(() => {})
      .finally(() => setTmdbDetailLoading(false));
  }, [entry?.tmdbId, entry?.type]);

  type SeasonData = { number: number; status: string; dateWatched?: string | null; rating?: number | null; notes?: string | null };

  // Unmark a watched season directly (one-tap undo)
  const unmarkSeason = (num: number) => {
    if (!entryId || !entry) return;
    const seasons = ((entry as any).seasons ?? []) as SeasonData[];
    updateEntry.mutate(
      { id: entryId, data: { seasons: seasons.filter((s) => s.number !== num) } as any },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(entryId) }) }
    );
  };

  // Save a season from the sheet (mark watched with optional rating + notes)
  const confirmSeason = () => {
    if (!seasonSheet || !entryId || !entry) return;
    const { num, rating: sRating, note, editing } = seasonSheet;
    const seasons = ((entry as any).seasons ?? []) as SeasonData[];
    const existing = seasons.find((s) => s.number === num);
    const today = new Date().toISOString().split('T')[0];
    const updated = [
      ...seasons.filter((s) => s.number !== num),
      {
        number: num,
        status: 'watched' as const,
        dateWatched: existing?.dateWatched ?? today,
        rating: sRating ?? null,
        notes: note.trim() || null,
      },
    ];
    updateEntry.mutate(
      { id: entryId, data: { seasons: updated } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(entryId) });
          setSeasonSheet(null);
        },
      }
    );
  };

  const onSubmit = (data: FormData) => {
    if (!entryId) return;

    const tags = data.tags
      ? data.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : [];

    updateEntry.mutate(
      {
        id: entryId,
        data: {
          title: data.title,
          type: data.type,
          status: data.status,
          posterUrl: data.posterUrl || null,
          dateWatched: data.dateWatched || null,
          rating: rating || null,
          notes: data.notes || null,
          platform: data.platform || null,
          tags,
        } as any,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Entry updated',
            description: 'Your changes have been saved',
          });
          queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(entryId) });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          setIsEditing(false);
        },
        onError: () => {
          toast({
            title: 'Error',
            description: 'Failed to update entry. Please try again.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!entryId) return;

    deleteEntry.mutate(
      { id: entryId },
      {
        onSuccess: () => {
          toast({
            title: 'Entry deleted',
            description: 'The entry has been removed from your collection',
          });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListYearsQueryKey() });
          setLocation('/');
        },
        onError: () => {
          toast({
            title: 'Error',
            description: 'Failed to delete entry. Please try again.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-full px-5 pt-8" style={{ background: '#FFF3E8' }}>
        <div className="max-w-lg mx-auto space-y-4 animate-pulse">
          <div className="h-8 rounded-xl w-1/3" style={{ background: '#EFE4D2' }} />
          <div className="aspect-[2/3] max-h-64 rounded-2xl" style={{ background: '#EFE4D2' }} />
          <div className="h-6 rounded-xl w-1/2" style={{ background: '#EFE4D2' }} />
          <div className="h-4 rounded-xl w-2/3" style={{ background: '#EFE4D2' }} />
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-5 py-20 text-center" style={{ background: '#FFF3E8' }}>
        <h3 className="text-xl font-bold mb-2" style={{ color: '#111111' }}>Entry not found</h3>
        <p className="text-sm mb-6" style={{ color: '#7E7A73' }}>This entry does not exist</p>
        <button
          onClick={() => setLocation('/')}
          className="px-6 py-3 rounded-full font-bold text-sm text-white"
          style={{ background: '#116149' }}
        >
          Go Home
        </button>
      </div>
    );
  }

  const selectedType = form.watch('type');

  return (
    <div className="min-h-full" style={{ background: '#FFF3E8' }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <button
          onClick={() => setLocation('/')}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}
          data-testid="button-back"
        >
          <ChevronLeft className="w-5 h-5" style={{ color: '#111111' }} />
        </button>
        <div className="flex gap-2">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold"
                style={{ background: '#ffffff', border: '1px solid #E2D9CE', color: '#116149' }}
                data-testid="button-edit"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold"
                style={{ background: '#ffffff', border: '1px solid #E2D9CE', color: '#e53e3e' }}
                data-testid="button-delete"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setIsEditing(false);
                form.reset();
                setRating(entry.rating ?? null);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold"
              style={{ background: '#ffffff', border: '1px solid #E2D9CE', color: '#7E7A73' }}
              data-testid="button-cancel-edit"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        /* Edit Mode */
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-5 space-y-5 pb-10">
          {/* Status */}
          <div className="space-y-2">
            <label className="text-sm font-bold" style={{ color: '#111111' }}>Status</label>
            <div className="flex gap-2">
              {([
                { key: 'completed', label: '✓ Seen it', activeBg: '#116149', activeColor: '#ffffff' },
                { key: 'watching', label: '▶ Watching', activeBg: '#9BD6FF', activeColor: '#116149' },
                { key: 'plan_to_watch', label: '🔖 Wishlist', activeBg: '#BDECC8', activeColor: '#116149' },
              ] as const).map(({ key, label, activeBg, activeColor }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => form.setValue('status', key)}
                  className="flex-1 py-2 rounded-full text-xs font-bold transition-all"
                  style={
                    form.watch('status') === key
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
                  data-testid={t === 'movie' ? 'button-edit-type-movie' : 'button-edit-type-show'}
                >
                  {t === 'movie'
                    ? <Film className="w-5 h-5" style={{ color: selectedType === 'movie' ? '#116149' : '#7E7A73' }} />
                    : <Tv className="w-5 h-5" style={{ color: selectedType === 'show' ? '#116149' : '#7E7A73' }} />
                  }
                  <span className="text-xs font-bold" style={{ color: selectedType === t ? '#116149' : '#7E7A73' }}>
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
              className="w-full px-4 py-3.5 rounded-2xl font-semibold focus:outline-none"
              style={{ border: '2px solid #E2D9CE', background: '#ffffff', color: '#111111' }}
              onFocus={e => (e.target.style.borderColor = '#116149')}
              onBlur={e => (e.target.style.borderColor = '#E2D9CE')}
              data-testid="input-edit-title"
            />
            {form.formState.errors.title && (
              <p className="text-xs" style={{ color: '#e53e3e' }}>{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold" style={{ color: '#111111' }}>Date Watched</label>
            <input
              type="date"
              {...form.register('dateWatched')}
              className="w-full px-4 py-3.5 rounded-2xl font-semibold focus:outline-none"
              style={{ border: '2px solid #E2D9CE', background: '#ffffff', color: '#111111' }}
              onFocus={e => (e.target.style.borderColor = '#116149')}
              onBlur={e => (e.target.style.borderColor = '#E2D9CE')}
              data-testid="input-edit-date"
            />
          </div>

          {/* Rating */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold" style={{ color: '#111111' }}>Rating</label>
            <StarRating rating={rating} onRatingChange={setRating} size="lg" />
          </div>

          {/* Poster URL */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold" style={{ color: '#111111' }}>Poster URL</label>
            <input
              type="url"
              {...form.register('posterUrl')}
              className="w-full px-4 py-3.5 rounded-2xl font-semibold focus:outline-none"
              style={{ border: '2px solid #E2D9CE', background: '#ffffff', color: '#111111' }}
              onFocus={e => (e.target.style.borderColor = '#116149')}
              onBlur={e => (e.target.style.borderColor = '#E2D9CE')}
              data-testid="input-edit-poster"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold" style={{ color: '#111111' }}>Notes</label>
            <textarea
              {...form.register('notes')}
              rows={4}
              className="w-full px-4 py-3 rounded-2xl font-medium focus:outline-none resize-none"
              style={{ border: '2px solid #E2D9CE', background: '#ffffff', color: '#111111', fontFamily: 'Manrope, sans-serif' }}
              onFocus={e => (e.target.style.borderColor = '#116149')}
              onBlur={e => (e.target.style.borderColor = '#E2D9CE')}
              data-testid="input-edit-notes"
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
            <label className="text-sm font-bold" style={{ color: '#111111' }}>Tags</label>
            <input
              {...form.register('tags')}
              placeholder="action, thriller"
              className="w-full px-4 py-3.5 rounded-2xl font-semibold focus:outline-none"
              style={{ border: '2px solid #E2D9CE', background: '#ffffff', color: '#111111' }}
              onFocus={e => (e.target.style.borderColor = '#116149')}
              onBlur={e => (e.target.style.borderColor = '#E2D9CE')}
              data-testid="input-edit-tags"
            />
          </div>

          <button
            type="submit"
            disabled={updateEntry.isPending}
            className="w-full py-4 rounded-full font-bold text-base text-white transition-opacity disabled:opacity-60"
            style={{ background: '#116149' }}
            data-testid="button-save"
          >
            {updateEntry.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      ) : (
        /* View Mode */
        <div className="px-5 pb-10">
          {/* Poster + Title hero */}
          <div className="flex gap-4 mb-6">
            <div
              className="w-28 flex-shrink-0 aspect-[2/3] rounded-2xl overflow-hidden shadow-md"
              style={{ background: '#EFE4D2' }}
            >
              {entry.posterUrl ? (
                <img src={entry.posterUrl} alt={entry.title} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex flex-col items-center justify-center gap-2"
                  style={{ background: '#EFE4D2' }}
                >
                  <span className="text-3xl font-bold" style={{ color: '#116149' }}>
                    {entry.title[0]?.toUpperCase() ?? '?'}
                  </span>
                  {entry.type === 'movie'
                    ? <Film className="w-5 h-5" style={{ color: '#7E7A73' }} />
                    : <Tv className="w-5 h-5" style={{ color: '#7E7A73' }} />
                  }
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pt-1">
              {/* Type + Status badges */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {/* Type pill — movie=blue, show=pink so it never clashes with status pills */}
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={
                    entry.type === 'movie'
                      ? { background: '#9BD6FF', color: '#116149' }
                      : { background: '#FF4BAE', color: '#ffffff' }
                  }
                >
                  {entry.type === 'movie' ? '🎬 Movie' : '📺 Show'}
                </span>
                {/* Status pill — completed=mint, watching=blue, planned=beige */}
                {entry.status && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={
                      entry.status === 'completed'
                        ? { background: '#BDECC8', color: '#116149' }
                        : entry.status === 'watching'
                        ? { background: '#9BD6FF', color: '#116149' }
                        : { background: '#EFE4D2', color: '#7E7A73' }
                    }
                  >
                    {entry.status === 'completed' ? '✓ Watched' : entry.status === 'watching' ? '▶ Watching' : '🔖 Planned'}
                  </span>
                )}
              </div>

              <h1 className="text-xl font-bold leading-snug mb-2" style={{ color: '#111111' }} data-testid="text-entry-title">
                {entry.title}
              </h1>

              {entry.rating && (
                <StarRating rating={entry.rating} readonly size="md" />
              )}

              {entry.dateWatched && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Calendar className="w-3.5 h-3.5" style={{ color: '#7E7A73' }} />
                  <span className="text-xs" style={{ color: '#7E7A73' }}>
                    {new Date(entry.dateWatched + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
              {!entry.dateWatched && (
                <p className="text-xs mt-2" style={{ color: '#7E7A73' }}>Not yet watched</p>
              )}
            </div>
          </div>

          {/* Platform */}
          {(entry as any).platform && (
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <Monitor className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#7E7A73' }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7E7A73' }}>Watched on</span>
              </div>
              <div className="mt-1.5">
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-bold"
                  style={{ background: '#4A78FF', color: '#ffffff' }}
                >
                  {(entry as any).platform}
                </span>
              </div>
            </div>
          )}

          {/* Season tracker — shows only */}
          {entry.type === 'show' && (() => {
            const seasons = ((entry as any).seasons ?? []) as SeasonData[];
            const totalSeasons = Math.max(seasonCount ?? 0, ...seasons.map((s) => s.number), seasonCount ? 0 : 1);
            const watchedNums = new Set(seasons.filter((s) => s.status === 'watched').map((s) => s.number));
            const pills = Array.from({ length: Math.max(totalSeasons, 1) }, (_, i) => i + 1);
            return (
              <div className="rounded-2xl p-4 mb-4" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7E7A73' }}>Seasons</p>
                  <p className="text-xs font-bold" style={{ color: '#116149' }}>
                    {watchedNums.size}/{totalSeasons} watched
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {pills.map((num) => {
                    const isWatched = watchedNums.has(num);
                    const seasonData = seasons.find((s) => s.number === num);
                    const seasonRating = seasonData?.rating ?? null;
                    return (
                      <div key={num} className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => {
                            if (isWatched) {
                              unmarkSeason(num);
                            } else {
                              setSeasonSheet({ num, rating: null, note: '', editing: false });
                            }
                          }}
                          onContextMenu={(e) => {
                            if (isWatched) {
                              e.preventDefault();
                              setSeasonSheet({ num, rating: seasonRating, note: seasonData?.notes ?? '', editing: true });
                            }
                          }}
                          disabled={updateEntry.isPending}
                          className="w-10 h-10 rounded-full font-bold text-xs transition-all active:scale-90 disabled:opacity-50"
                          style={isWatched
                            ? { background: '#116149', color: '#ffffff' }
                            : { background: '#EFE4D2', color: '#7E7A73' }
                          }
                          title={isWatched ? `Season ${num} — tap to unmark · right-click to edit` : `Season ${num} — tap to rate & mark watched`}
                        >
                          S{num}
                        </button>
                        {/* Faint star count beneath watched pill */}
                        {isWatched && (
                          <div className="flex gap-px" aria-label={seasonRating ? `${seasonRating} stars` : 'no rating'}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className="text-[8px] leading-none"
                                style={{ color: star <= (seasonRating ?? 0) ? '#FFD34D' : '#D4C9BC' }}
                              >★</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] mt-3" style={{ color: '#7E7A73' }}>
                  Tap unwatched to rate · tap watched to unmark
                </p>
              </div>
            );
          })()}

          {/* About (collapsible synopsis) */}
          {entry.synopsis && (
            <div
              className="rounded-2xl mb-4 overflow-hidden"
              style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}
            >
              <button
                className="w-full px-4 py-3.5 flex items-center justify-between"
                onClick={() => setSynopsisExpanded((v) => !v)}
                aria-expanded={synopsisExpanded}
              >
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7E7A73' }}>About</p>
                {synopsisExpanded
                  ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: '#7E7A73' }} />
                  : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: '#7E7A73' }} />
                }
              </button>
              {synopsisExpanded && (
                <div className="px-4 pb-4">
                  <p className="text-sm leading-relaxed" style={{ color: '#111111' }}>{entry.synopsis}</p>
                </div>
              )}
            </div>
          )}

          {/* More info — cast & director from TMDB */}
          {entry.tmdbId && (
            <div
              className="rounded-2xl p-4 mb-4"
              style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}
            >
              <div className="flex items-center gap-1.5 mb-3">
                <Info className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#7E7A73' }} />
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7E7A73' }}>More Info</p>
              </div>

              {tmdbDetailLoading && (
                <div className="space-y-2 animate-pulse">
                  <div className="h-3 rounded w-1/3" style={{ background: '#EFE4D2' }} />
                  <div className="flex gap-3 overflow-hidden">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex-shrink-0 space-y-1">
                        <div className="w-14 h-14 rounded-full" style={{ background: '#EFE4D2' }} />
                        <div className="h-2 rounded w-14" style={{ background: '#EFE4D2' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!tmdbDetailLoading && tmdbDetail && (
                <>
                  {/* Director / Creator */}
                  {tmdbDetail.directors.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[11px] font-bold mb-1.5" style={{ color: '#7E7A73' }}>
                        {entry.type === 'movie' ? 'Director' : 'Creator'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {tmdbDetail.directors.map((d) => (
                          <span
                            key={d.name}
                            className="px-3 py-1 rounded-full text-xs font-bold"
                            style={{ background: '#EFE4D2', color: '#116149' }}
                          >
                            {d.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cast */}
                  {tmdbDetail.cast.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold mb-2" style={{ color: '#7E7A73' }}>Cast</p>
                      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                        {tmdbDetail.cast.slice(0, 12).map((actor) => (
                          <div key={actor.name} className="flex-shrink-0 w-14 text-center">
                            <div
                              className="w-14 h-14 rounded-full overflow-hidden mb-1 mx-auto"
                              style={{ background: '#EFE4D2' }}
                            >
                              {actor.profileUrl ? (
                                <img
                                  src={actor.profileUrl}
                                  alt={actor.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div
                                  className="w-full h-full flex items-center justify-center text-lg font-bold"
                                  style={{ color: '#116149' }}
                                >
                                  {actor.name[0]?.toUpperCase() ?? '?'}
                                </div>
                              )}
                            </div>
                            <p className="text-[9px] font-bold leading-tight" style={{ color: '#111111' }}>
                              {actor.name}
                            </p>
                            {actor.character && (
                              <p className="text-[9px] leading-tight" style={{ color: '#7E7A73' }}>
                                {actor.character}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TMDB attribution */}
                  <div className="flex items-center gap-1 mt-3 pt-3" style={{ borderTop: '1px solid #EFE4D2' }}>
                    <span className="text-[10px] font-semibold" style={{ color: '#7E7A73' }}>Source:</span>
                    <a
                      href="https://www.themoviedb.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] underline"
                      style={{ color: '#7E7A73' }}
                    >
                      The Movie Database (TMDB)
                    </a>
                  </div>
                </>
              )}

              {!tmdbDetailLoading && !tmdbDetail && (
                <p className="text-xs" style={{ color: '#7E7A73' }}>Cast info unavailable</p>
              )}
            </div>
          )}

          {/* Notes */}
          {entry.notes && (
            <div
              className="rounded-2xl p-4 mb-4"
              style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#7E7A73' }}>Notes</p>
              <p className="text-sm leading-relaxed" style={{ color: '#111111' }} data-testid="text-entry-notes">
                {entry.notes}
              </p>
            </div>
          )}

          {/* Tags */}
          {entry.tags && entry.tags.length > 0 && (
            <div
              className="rounded-2xl p-4 mb-4"
              style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#7E7A73' }}>Tags</p>
              <div className="flex flex-wrap gap-2">
                {entry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: '#EFE4D2', color: '#116149' }}
                    data-testid={`tag-${tag}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Season rating + notes sheet */}
      {seasonSheet && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
            onClick={() => setSeasonSheet(null)}
          />
          {/* Sheet */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl px-5 pt-5 pb-8 max-w-lg mx-auto"
            style={{ background: '#FFF3E8', border: '1px solid #E2D9CE' }}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#D4C9BC' }} />

            <p className="text-base font-bold mb-4" style={{ color: '#111111' }}>
              Season {seasonSheet.num}
              {seasonSheet.editing && <span className="ml-2 text-xs font-normal" style={{ color: '#7E7A73' }}>editing</span>}
            </p>

            {/* Star rating */}
            <div className="mb-4">
              <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#7E7A73' }}>Rating (optional)</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSeasonSheet((s) => s ? { ...s, rating: star === s.rating ? null : star } : s)}
                    className="text-3xl leading-none transition-transform active:scale-110"
                    style={{ color: star <= (seasonSheet.rating ?? 0) ? '#FFD34D' : '#D4C9BC' }}
                    aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="mb-5">
              <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#7E7A73' }}>Notes (optional)</p>
              <textarea
                rows={3}
                value={seasonSheet.note}
                onChange={(e) => setSeasonSheet((s) => s ? { ...s, note: e.target.value } : s)}
                placeholder="What did you think of this season?"
                className="w-full px-4 py-3 rounded-2xl font-medium focus:outline-none resize-none text-sm"
                style={{
                  border: '2px solid #E2D9CE',
                  background: '#ffffff',
                  color: '#111111',
                  fontFamily: 'Manrope, sans-serif',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#116149')}
                onBlur={(e) => (e.target.style.borderColor = '#E2D9CE')}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSeasonSheet(null)}
                className="flex-1 py-3.5 rounded-full font-bold text-sm"
                style={{ background: '#ffffff', border: '1px solid #E2D9CE', color: '#7E7A73' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSeason}
                disabled={updateEntry.isPending}
                className="flex-1 py-3.5 rounded-full font-bold text-sm text-white transition-opacity disabled:opacity-60"
                style={{ background: '#116149' }}
              >
                {updateEntry.isPending ? 'Saving…' : seasonSheet.editing ? 'Save Changes' : 'Mark Watched'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{entry.title}&rdquo; from your collection. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
