import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { Film, Tv, Trash2, Calendar, ChevronLeft, Monitor, ChevronDown, ChevronUp, Play, X, Check } from 'lucide-react';
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

// ── Types ───────────────────────────────────────────────────────────────────

type SeasonData = {
  number: number;
  status: string;
  dateWatched?: string | null;
  rating?: number | null;
  notes?: string | null;
  episodes?: EpisodeData[];
};

type EpisodeData = {
  number: number;
  title?: string;
  watched: boolean;
  airDate?: string | null;
};

type TmdbResult = {
  tmdbId: number;
  title: string;
  type: 'movie' | 'show';
  year: number | null;
  posterUrl: string | null;
};

type WatchProvider = { providerId: number; providerName: string; logoUrl: string };
type WatchProvidersData = {
  region: string;
  link: string | null;
  streaming: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
};

type OmdbData = { rtScore: string | null; imdbRating: string | null };

type TmdbDetailData = {
  cast: Array<{ name: string; character: string; profileUrl: string | null }>;
  directors: Array<{ name: string; job: string }>;
  voteAverage: number | null;
  genres: string[];
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function platformStyle(p: string): { background: string; color: string } {
  if (p === 'Cinema') return { background: '#F97316', color: '#ffffff' };
  if (p === 'DVD / Blu-ray') return { background: '#7E7A73', color: '#ffffff' };
  return { background: '#4A78FF', color: '#ffffff' };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EntryDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const entryId = params.id ? Number(params.id) : undefined;

  // ── Success banner ────────────────────────────────────────────────────────
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showSuccess(msg: string) {
    if (successTimer.current) clearTimeout(successTimer.current);
    setSuccessMsg(msg);
    successTimer.current = setTimeout(() => setSuccessMsg(null), 2500);
  }

  // ── Local editable state ──────────────────────────────────────────────────
  const [rating, setRating] = useState<number | null>(null);
  const [platform, setPlatform] = useState('');
  const [platformSheetOpen, setPlatformSheetOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [dateWatched, setDateWatched] = useState('');
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // ── Season state ──────────────────────────────────────────────────────────
  const [seasonCount, setSeasonCount] = useState<number | null>(null);
  const [seasonSheet, setSeasonSheet] = useState<{
    num: number;
    rating: number | null;
    note: string;
  } | null>(null);
  const [episodeSheet, setEpisodeSheet] = useState<{
    seasonNum: number;
    episodes: EpisodeData[];
    loading: boolean;
  } | null>(null);

  // ── TMDB + external data ──────────────────────────────────────────────────
  const [tmdbDetail, setTmdbDetail] = useState<TmdbDetailData | null>(null);
  const [tmdbDetailLoading, setTmdbDetailLoading] = useState(false);
  const [watchProviders, setWatchProviders] = useState<WatchProvidersData | null>(null);
  const [watchProvidersLoading, setWatchProvidersLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<TmdbResult[]>([]);
  const [omdbData, setOmdbData] = useState<OmdbData | null>(null);

  // ── API hooks ─────────────────────────────────────────────────────────────
  const { data: entry, isLoading } = useGetEntry(entryId!, {
    query: { enabled: !!entryId, queryKey: getGetEntryQueryKey(entryId!) },
  });
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  // ── Autosave ──────────────────────────────────────────────────────────────
  const autosave = useCallback(
    (patch: object, successText = 'Saved') => {
      if (!entryId) return;
      updateEntry.mutate(
        { id: entryId, data: patch as any },
        {
          onSuccess: () => {
            showSuccess(successText);
            queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(entryId) });
            queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          },
        }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entryId, queryClient]
  );

  // ── Init from entry ───────────────────────────────────────────────────────
  useEffect(() => {
    if (entry) {
      setRating(entry.rating ?? null);
      setPlatform((entry as any).platform ?? '');
      setNotes(entry.notes ?? '');
      setDateWatched(entry.dateWatched ?? '');
    }
  }, [entry]);

  // ── TMDB: season count ────────────────────────────────────────────────────
  useEffect(() => {
    if (!entry || entry.type !== 'show' || !entry.tmdbId) { setSeasonCount(null); return; }
    fetch(`/api/tmdb/show/${entry.tmdbId}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => setSeasonCount(d.numberOfSeasons ?? null))
      .catch(() => {});
  }, [entry?.tmdbId, entry?.type]);

  // ── TMDB: cast + directors ────────────────────────────────────────────────
  useEffect(() => {
    if (!entry?.tmdbId) { setTmdbDetail(null); return; }
    const endpoint = entry.type === 'movie'
      ? `/api/tmdb/movie/${entry.tmdbId}`
      : `/api/tmdb/tv/${entry.tmdbId}`;
    setTmdbDetailLoading(true);
    fetch(endpoint)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setTmdbDetail({ cast: d.cast ?? [], directors: d.directors ?? [], voteAverage: d.voteAverage ?? null, genres: d.genres ?? [] }))
      .catch(() => {})
      .finally(() => setTmdbDetailLoading(false));
  }, [entry?.tmdbId, entry?.type]);

  // ── TMDB: watch providers ─────────────────────────────────────────────────
  useEffect(() => {
    if (!entry?.tmdbId) { setWatchProviders(null); return; }
    const locale = navigator.language ?? 'en-US';
    const region = (locale.split('-')[1] ?? 'US').toUpperCase().slice(0, 2) || 'US';
    const endpoint = entry.type === 'movie'
      ? `/api/tmdb/movie/${entry.tmdbId}/providers?region=${region}`
      : `/api/tmdb/tv/${entry.tmdbId}/providers?region=${region}`;
    setWatchProvidersLoading(true);
    fetch(endpoint)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setWatchProviders(d))
      .catch(() => {})
      .finally(() => setWatchProvidersLoading(false));
  }, [entry?.tmdbId, entry?.type]);

  // ── TMDB: recommendations ─────────────────────────────────────────────────
  useEffect(() => {
    if (!entry?.tmdbId) { setRecommendations([]); return; }
    const endpoint = entry.type === 'movie'
      ? `/api/tmdb/movie/${entry.tmdbId}/recommendations`
      : `/api/tmdb/tv/${entry.tmdbId}/recommendations`;
    fetch(endpoint)
      .then(r => r.ok ? r.json() : null)
      .then(d => setRecommendations(d?.results ?? []))
      .catch(() => {});
  }, [entry?.tmdbId, entry?.type]);

  // ── OMDB: ratings ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!entry?.title) return;
    const year = entry.year ? String(entry.year) : '';
    fetch(`/api/omdb/ratings?title=${encodeURIComponent(entry.title)}${year ? `&year=${year}` : ''}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setOmdbData({ rtScore: d.rtScore, imdbRating: d.imdbRating }))
      .catch(() => {});
  }, [entry?.title, entry?.year]);

  // ── Season helpers ────────────────────────────────────────────────────────
  const getSeasonsArray = useCallback(
    (): SeasonData[] => ((entry as any)?.seasons ?? []) as SeasonData[],
    [entry]
  );

  function openEpisodeSheet(num: number) {
    const seasons = getSeasonsArray();
    const existing = seasons.find(s => s.number === num);
    const existingEps = existing?.episodes ?? [];
    setEpisodeSheet({ seasonNum: num, episodes: existingEps, loading: !!entry?.tmdbId });

    if (entry?.tmdbId) {
      fetch(`/api/tmdb/tv/${entry.tmdbId}/season/${num}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d?.episodes) {
            setEpisodeSheet(prev => prev ? { ...prev, loading: false } : null);
            return;
          }
          const fetched: EpisodeData[] = (d.episodes as any[]).map(ep => {
            const prev = existingEps.find(e => e.number === ep.episode_number);
            return {
              number: ep.episode_number,
              title: ep.name,
              watched: prev?.watched ?? false,
              airDate: ep.air_date ?? null,
            };
          });
          setEpisodeSheet(prev => prev ? { ...prev, episodes: fetched, loading: false } : null);
        })
        .catch(() => setEpisodeSheet(prev => prev ? { ...prev, loading: false } : null));
    }
  }

  function toggleEpisode(epNum: number) {
    if (!episodeSheet) return;
    setEpisodeSheet(prev =>
      prev ? { ...prev, episodes: prev.episodes.map(ep => ep.number === epNum ? { ...ep, watched: !ep.watched } : ep) } : null
    );
  }

  function saveEpisodes() {
    if (!episodeSheet || !entryId || !entry) return;
    const { seasonNum, episodes } = episodeSheet;
    const seasons = getSeasonsArray();
    const watchedCount = episodes.filter(e => e.watched).length;
    const total = episodes.length;
    const autoStatus: 'watched' | 'watching' = watchedCount === total && total > 0 ? 'watched' : 'watching';
    const updated: SeasonData[] = [
      ...seasons.filter(s => s.number !== seasonNum),
      { ...(seasons.find(s => s.number === seasonNum) ?? { number: seasonNum }), status: autoStatus, episodes },
    ];
    updateEntry.mutate(
      { id: entryId, data: { seasons: updated } as any },
      {
        onSuccess: () => {
          showSuccess(`Season ${seasonNum} progress saved`);
          queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(entryId) });
          setEpisodeSheet(null);
        },
      }
    );
  }

  function openSeasonSheet(num: number) {
    const sd = getSeasonsArray().find(s => s.number === num);
    setSeasonSheet({ num, rating: sd?.rating ?? null, note: sd?.notes ?? '' });
    setEpisodeSheet(null);
  }

  function confirmSeason() {
    if (!seasonSheet || !entryId || !entry) return;
    const { num, rating: sRating, note } = seasonSheet;
    const seasons = getSeasonsArray();
    const existing = seasons.find(s => s.number === num);
    const today = new Date().toISOString().split('T')[0];
    const updated: SeasonData[] = [
      ...seasons.filter(s => s.number !== num),
      {
        number: num,
        status: 'watched',
        dateWatched: existing?.dateWatched ?? today,
        rating: sRating ?? null,
        notes: note.trim() || null,
        episodes: existing?.episodes,
      },
    ];
    updateEntry.mutate(
      { id: entryId, data: { seasons: updated } as any },
      {
        onSuccess: () => {
          showSuccess(`Season ${num} marked watched`);
          queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(entryId) });
          setSeasonSheet(null);
        },
      }
    );
  }

  function unmarkSeason(num: number) {
    if (!entryId || !entry) return;
    const seasons = getSeasonsArray();
    updateEntry.mutate(
      { id: entryId, data: { seasons: seasons.filter(s => s.number !== num) } as any },
      {
        onSuccess: () => {
          showSuccess(`Season ${num} unmarked`);
          queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(entryId) });
          setSeasonSheet(null);
        },
      }
    );
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  function handleDelete() {
    if (!entryId) return;
    deleteEntry.mutate(
      { id: entryId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListYearsQueryKey() });
          setLocation('/');
        },
      }
    );
  }

  // ── Loading / not found ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-full px-5 pt-8" style={{ background: '#FFF3E8' }}>
        <div className="max-w-lg mx-auto space-y-4 animate-pulse">
          <div className="h-8 rounded-xl w-1/3" style={{ background: '#EFE4D2' }} />
          <div className="flex gap-4">
            <div className="w-28 aspect-[2/3] rounded-2xl" style={{ background: '#EFE4D2' }} />
            <div className="flex-1 space-y-3 pt-2">
              <div className="h-5 rounded w-2/3" style={{ background: '#EFE4D2' }} />
              <div className="h-4 rounded w-1/2" style={{ background: '#EFE4D2' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-5 py-20 text-center" style={{ background: '#FFF3E8' }}>
        <h3 className="text-xl font-bold mb-2" style={{ color: '#111111' }}>Entry not found</h3>
        <button onClick={() => setLocation('/')} className="px-6 py-3 rounded-full font-bold text-sm text-white" style={{ background: '#116149' }}>Go Home</button>
      </div>
    );
  }

  const seasons = getSeasonsArray();
  const totalSeasons = Math.max(seasonCount ?? 0, ...seasons.map(s => s.number), 0);
  const watchedNums = new Set(seasons.filter(s => s.status === 'watched').map(s => s.number));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full" style={{ background: '#FFF3E8' }}>

      {/* ── Success Banner ── */}
      {successMsg && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-5 py-4 shadow-lg"
          style={{ background: '#116149' }}
          role="status"
          aria-live="polite"
        >
          <Check className="w-5 h-5 text-white flex-shrink-0" />
          <p className="font-bold text-sm text-white flex-1">Success — {successMsg}</p>
          <button onClick={() => { setSuccessMsg(null); }} aria-label="Dismiss">
            <X className="w-4 h-4 text-white opacity-70 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className={`px-5 pt-6 pb-3 flex items-center justify-between transition-all ${successMsg ? 'mt-14' : ''}`}>
        <button
          onClick={() => setLocation('/')}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}
          data-testid="button-back"
        >
          <ChevronLeft className="w-5 h-5" style={{ color: '#111111' }} />
        </button>
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold"
          style={{ background: '#ffffff', border: '1px solid #E2D9CE', color: '#e53e3e' }}
          data-testid="button-delete"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>

      <div className="px-5 pb-16">

        {/* ── Hero: Poster + Title + Scores ── */}
        <div className="flex gap-4 mb-5">
          {/* Poster */}
          <div
            className="w-28 flex-shrink-0 aspect-[2/3] rounded-2xl overflow-hidden shadow-md relative"
            style={{ background: '#EFE4D2' }}
          >
            {entry.posterUrl ? (
              <img src={entry.posterUrl} alt={entry.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <span className="text-3xl font-bold" style={{ color: '#116149' }}>
                  {entry.title[0]?.toUpperCase() ?? '?'}
                </span>
                {entry.type === 'movie'
                  ? <Film className="w-5 h-5" style={{ color: '#7E7A73' }} />
                  : <Tv className="w-5 h-5" style={{ color: '#7E7A73' }} />
                }
              </div>
            )}
            {/* RT score badge */}
            {omdbData?.rtScore && (
              <div
                className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-lg text-[10px] font-bold"
                style={{ background: 'rgba(0,0,0,0.75)', color: '#ffffff' }}
              >
                🍅 {omdbData.rtScore}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-1 flex flex-col gap-2">
            {/* Type + IMDB badges */}
            <div className="flex flex-wrap gap-1.5">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={entry.type === 'movie'
                  ? { background: '#9BD6FF', color: '#116149' }
                  : { background: '#FF4BAE', color: '#ffffff' }}
              >
                {entry.type === 'movie' ? '🎬 Movie' : '📺 Show'}
              </span>
              {omdbData?.imdbRating && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F5C518', color: '#000000' }}>
                  ⭐ {omdbData.imdbRating}
                </span>
              )}
            </div>

            <h1 className="text-xl font-bold leading-snug" style={{ color: '#111111' }} data-testid="text-entry-title">
              {entry.title}
            </h1>
            {entry.year && <p className="text-xs" style={{ color: '#7E7A73' }}>{entry.year}</p>}

            {/* Rating — always tappable */}
            <StarRating
              rating={rating}
              onRatingChange={r => {
                setRating(r);
                autosave({ rating: r }, 'Rating saved');
              }}
              size="md"
            />
          </div>
        </div>

        {/* ── Status chips — always editable ── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#7E7A73' }}>Status</p>
          <div className="flex gap-2">
            {([
              { key: 'completed', label: '✓ Seen it', activeBg: '#116149', activeColor: '#ffffff' },
              { key: 'watching', label: '▶ Watching', activeBg: '#9BD6FF', activeColor: '#116149' },
              { key: 'plan_to_watch', label: '🔖 Wishlist', activeBg: '#BDECC8', activeColor: '#116149' },
            ] as const).map(({ key, label, activeBg, activeColor }) => (
              <button
                key={key}
                onClick={() => autosave({ status: key }, 'Status updated')}
                className="flex-1 py-2 rounded-full text-xs font-bold transition-all"
                disabled={updateEntry.isPending}
                style={
                  entry.status === key
                    ? { background: activeBg, color: activeColor }
                    : { background: '#ffffff', border: '1px solid #E2D9CE', color: '#7E7A73' }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Date Watched — always editable ── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className="w-3.5 h-3.5" style={{ color: '#7E7A73' }} />
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7E7A73' }}>Date Watched</p>
          </div>
          <input
            type="date"
            value={dateWatched}
            onChange={e => setDateWatched(e.target.value)}
            onBlur={e => autosave({ dateWatched: e.target.value || null }, 'Date saved')}
            className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold focus:outline-none"
            style={{ border: '1.5px solid #E2D9CE', background: '#FFF3E8', color: '#111111' }}
            data-testid="input-edit-date"
          />
        </div>

        {/* ── Platform / Location — always editable ── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Monitor className="w-3.5 h-3.5" style={{ color: '#7E7A73' }} />
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7E7A73' }}>Platform / Location</p>
          </div>
          {platform ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-bold"
                style={platformStyle(platform)}
              >
                {platform === 'Cinema' ? '🎬 ' : ''}{platform}
              </span>
              <button onClick={() => setPlatformSheetOpen(true)} className="text-xs underline" style={{ color: '#7E7A73' }}>
                Change
              </button>
              <button
                onClick={() => { setPlatform(''); autosave({ platform: null }, 'Platform cleared'); }}
                className="text-xs underline"
                style={{ color: '#e53e3e' }}
              >
                Clear
              </button>
            </div>
          ) : (
            <button
              onClick={() => setPlatformSheetOpen(true)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-center"
              style={{ background: '#FFF3E8', border: '1.5px dashed #D4C9BC', color: '#7E7A73' }}
            >
              + Add platform or location
            </button>
          )}
        </div>

        {/* ── Season tracker — shows only ── */}
        {entry.type === 'show' && totalSeasons > 0 && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7E7A73' }}>Seasons</p>
              <p className="text-xs font-bold" style={{ color: '#116149' }}>
                {watchedNums.size} / {totalSeasons} watched
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: totalSeasons }, (_, i) => i + 1).map(num => {
                const isWatched = watchedNums.has(num);
                const sd = seasons.find(s => s.number === num);
                const sRating = sd?.rating ?? null;
                const epCount = sd?.episodes?.length ?? 0;
                const epWatched = sd?.episodes?.filter(e => e.watched).length ?? 0;
                return (
                  <div key={num} className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => openEpisodeSheet(num)}
                      onContextMenu={e => { e.preventDefault(); if (isWatched) openSeasonSheet(num); }}
                      disabled={updateEntry.isPending}
                      className="w-12 h-14 rounded-2xl font-bold text-xs transition-all active:scale-90 disabled:opacity-50 flex flex-col items-center justify-center gap-0.5"
                      style={isWatched
                        ? { background: '#116149', color: '#ffffff' }
                        : { background: '#EFE4D2', color: '#7E7A73' }}
                      title={`Season ${num}${epCount > 0 ? ` · ${epWatched}/${epCount} eps` : ''} — click to track episodes`}
                    >
                      <span className="text-xs font-bold">S{num}</span>
                      {epCount > 0 && (
                        <span className="text-[8px] opacity-80">{epWatched}/{epCount}</span>
                      )}
                    </button>
                    {isWatched && (
                      <div className="flex gap-px" aria-label={sRating ? `${sRating} stars` : 'no rating'}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <span key={star} className="text-[8px] leading-none" style={{ color: star <= (sRating ?? 0) ? '#FFD34D' : '#D4C9BC' }}>★</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] mt-3" style={{ color: '#7E7A73' }}>
              Click to track episodes · right-click watched season to rate it
            </p>
          </div>
        )}

        {/* ── About ── */}
        {entry.synopsis && (
          <div className="rounded-2xl mb-4 overflow-hidden" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
            <button
              className="w-full px-4 py-3.5 flex items-center justify-between"
              onClick={() => setSynopsisExpanded(v => !v)}
              aria-expanded={synopsisExpanded}
            >
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7E7A73' }}>About</p>
              {synopsisExpanded
                ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: '#7E7A73' }} />
                : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: '#7E7A73' }} />}
            </button>
            {synopsisExpanded && (
              <div className="px-4 pb-4">
                <p className="text-sm leading-relaxed" style={{ color: '#111111' }}>{entry.synopsis}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Cast & Crew ── */}
        {entry.tmdbId && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#7E7A73' }}>Cast & Crew</p>
            {tmdbDetailLoading && (
              <div className="flex gap-3 animate-pulse">
                {[0, 1, 2].map(i => <div key={i} className="w-14 h-14 rounded-full" style={{ background: '#EFE4D2' }} />)}
              </div>
            )}
            {!tmdbDetailLoading && tmdbDetail && (
              <>
                {tmdbDetail.directors.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[11px] font-bold mb-1.5" style={{ color: '#7E7A73' }}>
                      {entry.type === 'movie' ? 'Director' : 'Creator'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {tmdbDetail.directors.map(d => (
                        <span key={d.name} className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: '#EFE4D2', color: '#116149' }}>
                          {d.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {tmdbDetail.cast.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold mb-2" style={{ color: '#7E7A73' }}>Cast</p>
                    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                      {tmdbDetail.cast.slice(0, 12).map(actor => (
                        <div key={actor.name} className="flex-shrink-0 w-14 text-center">
                          <div className="w-14 h-14 rounded-full overflow-hidden mb-1 mx-auto" style={{ background: '#EFE4D2' }}>
                            {actor.profileUrl
                              ? <img src={actor.profileUrl} alt={actor.name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-lg font-bold" style={{ color: '#116149' }}>{actor.name[0]?.toUpperCase()}</div>}
                          </div>
                          <p className="text-[9px] font-bold leading-tight" style={{ color: '#111111' }}>{actor.name}</p>
                          {actor.character && <p className="text-[9px] leading-tight" style={{ color: '#7E7A73' }}>{actor.character}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-1 mt-3 pt-3" style={{ borderTop: '1px solid #EFE4D2' }}>
                  <span className="text-[10px] font-semibold" style={{ color: '#7E7A73' }}>Source: </span>
                  <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="text-[10px] underline" style={{ color: '#7E7A73' }}>
                    The Movie Database (TMDB)
                  </a>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Where to Watch ── */}
        {entry.tmdbId && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
            <div className="flex items-center gap-1.5 mb-3">
              <Play className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#7E7A73' }} />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7E7A73' }}>Where to Watch</p>
            </div>
            {watchProvidersLoading && (
              <div className="flex gap-3 animate-pulse">
                {[0, 1, 2].map(i => <div key={i} className="w-10 h-10 rounded-xl" style={{ background: '#EFE4D2' }} />)}
              </div>
            )}
            {!watchProvidersLoading && watchProviders && (
              <>
                {watchProviders.streaming.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {watchProviders.streaming.map(p => (
                      <div key={p.providerId} title={p.providerName}>
                        <img
                          src={p.logoUrl}
                          alt={p.providerName}
                          className="w-10 h-10 rounded-xl object-cover"
                          style={{ border: '1px solid #E2D9CE' }}
                          onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (watchProviders.rent.length > 0 || watchProviders.buy.length > 0) ? (
                  <>
                    <p className="text-xs mb-2" style={{ color: '#7E7A73' }}>Not on streaming — available to rent/buy</p>
                    <div className="flex flex-wrap gap-2">
                      {[...watchProviders.rent, ...watchProviders.buy]
                        .filter((p, i, arr) => arr.findIndex(x => x.providerId === p.providerId) === i)
                        .map(p => (
                          <div key={p.providerId} title={p.providerName}>
                            <img src={p.logoUrl} alt={p.providerName} className="w-10 h-10 rounded-xl object-cover"
                              style={{ border: '1px solid #E2D9CE', opacity: 0.7 }}
                              onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                          </div>
                        ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs" style={{ color: '#7E7A73' }}>
                    Not available to stream in {watchProviders.region === 'US' ? 'the US' : watchProviders.region} right now
                  </p>
                )}
                <div className="flex items-center gap-1 mt-3 pt-3" style={{ borderTop: '1px solid #EFE4D2' }}>
                  <span className="text-[10px]" style={{ color: '#7E7A73' }}>
                    Streaming data by{' '}
                    <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold" style={{ color: '#7E7A73' }}>JustWatch</a>
                  </span>
                </div>
              </>
            )}
            {!watchProvidersLoading && !watchProviders && (
              <p className="text-xs" style={{ color: '#7E7A73' }}>Streaming info unavailable</p>
            )}
          </div>
        )}

        {/* ── Notes — always editable ── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#7E7A73' }}>Notes</p>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => autosave({ notes: notes.trim() || null }, 'Notes saved')}
            placeholder="Add your thoughts…"
            className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none resize-none"
            style={{
              border: '1.5px solid #E2D9CE',
              background: '#FFF3E8',
              color: '#111111',
              fontFamily: 'Manrope, sans-serif',
            }}
            data-testid="textarea-notes"
          />
        </div>

        {/* ── Tags ── */}
        {entry.tags && entry.tags.length > 0 && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#7E7A73' }}>Tags</p>
            <div className="flex flex-wrap gap-2">
              {entry.tags.map(tag => (
                <span key={tag} className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: '#EFE4D2', color: '#116149' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── You May Also Like ── */}
        {recommendations.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold" style={{ color: '#111111' }}>You May Also Like</p>
              <span className="text-xs" style={{ color: '#7E7A73' }}>{recommendations.length} titles</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5">
              {recommendations.slice(0, 12).map(rec => (
                <div key={rec.tmdbId} className="flex-shrink-0 w-24">
                  <div
                    className="w-24 aspect-[2/3] rounded-xl overflow-hidden mb-1.5 shadow-sm"
                    style={{ background: '#EFE4D2' }}
                  >
                    {rec.posterUrl
                      ? <img src={rec.posterUrl} alt={rec.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-lg font-bold" style={{ color: '#116149' }}>{rec.title[0]}</div>}
                  </div>
                  <p className="text-[10px] font-bold leading-tight text-center" style={{ color: '#111111' }} title={rec.title}>
                    {rec.title.length > 16 ? rec.title.slice(0, 16) + '…' : rec.title}
                  </p>
                  {rec.year && (
                    <p className="text-[9px] text-center mt-0.5" style={{ color: '#7E7A73' }}>{rec.year}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Platform picker sheet ── */}
      {platformSheetOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
            onClick={() => setPlatformSheetOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl px-5 pt-5 pb-8 max-w-lg mx-auto"
            style={{ background: '#FFF3E8', border: '1px solid #E2D9CE', maxHeight: '70vh', overflowY: 'auto' }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#D4C9BC' }} />
            <p className="text-base font-bold mb-4" style={{ color: '#111111' }}>Platform / Location</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  onClick={() => {
                    setPlatform(p);
                    setPlatformSheetOpen(false);
                    autosave({ platform: p }, 'Platform saved');
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={platform === p ? platformStyle(p) : { background: '#EFE4D2', color: '#116149' }}
                >
                  {p === 'Cinema' ? '🎬 Cinema' : p}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Episode tracking sheet ── */}
      {episodeSheet && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
            onClick={() => setEpisodeSheet(null)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl px-5 pt-5 pb-8 max-w-lg mx-auto"
            style={{ background: '#FFF3E8', border: '1px solid #E2D9CE', maxHeight: '82vh', overflowY: 'auto' }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#D4C9BC' }} />
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-bold" style={{ color: '#111111' }}>Season {episodeSheet.seasonNum}</p>
              <button
                type="button"
                onClick={() => openSeasonSheet(episodeSheet.seasonNum)}
                className="px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: '#EFE4D2', color: '#116149' }}
              >
                ★ Rate season
              </button>
            </div>

            {/* Progress bar */}
            {episodeSheet.episodes.length > 0 && (() => {
              const watched = episodeSheet.episodes.filter(e => e.watched).length;
              const total = episodeSheet.episodes.length;
              const pct = Math.round(watched / total * 100);
              return (
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5" style={{ color: '#7E7A73' }}>
                    <span>{watched} / {total} episodes watched</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: '#EFE4D2' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ background: '#116149', width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {episodeSheet.loading ? (
              <div className="flex items-center justify-center py-10">
                <div
                  className="w-7 h-7 rounded-full border-2 animate-spin"
                  style={{ borderColor: '#EFE4D2', borderTopColor: '#116149' }}
                />
              </div>
            ) : episodeSheet.episodes.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: '#7E7A73' }}>No episode info available from TMDB</p>
            ) : (
              <div className="space-y-2 mb-5">
                {episodeSheet.episodes.map(ep => (
                  <button
                    key={ep.number}
                    type="button"
                    onClick={() => toggleEpisode(ep.number)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all"
                    style={ep.watched
                      ? { background: 'rgba(17,97,73,0.08)', border: '1px solid rgba(17,97,73,0.25)' }
                      : { background: '#ffffff', border: '1px solid #E2D9CE' }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                      style={{ background: ep.watched ? '#116149' : '#EFE4D2' }}
                    >
                      {ep.watched && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold" style={{ color: ep.watched ? '#116149' : '#111111' }}>
                        E{ep.number}{ep.title ? ` · ${ep.title}` : ''}
                      </p>
                      {ep.airDate && (
                        <p className="text-[10px] mt-0.5" style={{ color: '#7E7A73' }}>{ep.airDate}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEpisodeSheet(null)}
                className="flex-1 py-3.5 rounded-full font-bold text-sm"
                style={{ background: '#ffffff', border: '1px solid #E2D9CE', color: '#7E7A73' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEpisodes}
                disabled={updateEntry.isPending}
                className="flex-1 py-3.5 rounded-full font-bold text-sm text-white disabled:opacity-60"
                style={{ background: '#116149' }}
              >
                {updateEntry.isPending ? 'Saving…' : 'Save Progress'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Season rating sheet ── */}
      {seasonSheet && !episodeSheet && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
            onClick={() => setSeasonSheet(null)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl px-5 pt-5 pb-8 max-w-lg mx-auto"
            style={{ background: '#FFF3E8', border: '1px solid #E2D9CE' }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#D4C9BC' }} />
            <p className="text-base font-bold mb-4" style={{ color: '#111111' }}>
              Season {seasonSheet.num} — Rate & Notes
            </p>
            <div className="mb-4">
              <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#7E7A73' }}>Rating (optional)</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSeasonSheet(s => s ? { ...s, rating: star === s.rating ? null : star } : s)}
                    className="text-3xl leading-none transition-transform active:scale-110"
                    style={{ color: star <= (seasonSheet.rating ?? 0) ? '#FFD34D' : '#D4C9BC' }}
                  >★</button>
                ))}
              </div>
            </div>
            <div className="mb-5">
              <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#7E7A73' }}>Notes (optional)</p>
              <textarea
                rows={3}
                value={seasonSheet.note}
                onChange={e => setSeasonSheet(s => s ? { ...s, note: e.target.value } : s)}
                placeholder="What did you think of this season?"
                className="w-full px-4 py-3 rounded-2xl font-medium focus:outline-none resize-none text-sm"
                style={{ border: '2px solid #E2D9CE', background: '#ffffff', color: '#111111', fontFamily: 'Manrope, sans-serif' }}
                onFocus={e => (e.target.style.borderColor = '#116149')}
                onBlur={e => (e.target.style.borderColor = '#E2D9CE')}
              />
            </div>
            <div className="flex gap-3 mb-3">
              <button type="button" onClick={() => setSeasonSheet(null)} className="flex-1 py-3.5 rounded-full font-bold text-sm" style={{ background: '#ffffff', border: '1px solid #E2D9CE', color: '#7E7A73' }}>Cancel</button>
              <button type="button" onClick={confirmSeason} disabled={updateEntry.isPending} className="flex-1 py-3.5 rounded-full font-bold text-sm text-white disabled:opacity-60" style={{ background: '#116149' }}>
                {updateEntry.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
            {watchedNums.has(seasonSheet.num) && (
              <button
                type="button"
                onClick={() => unmarkSeason(seasonSheet.num)}
                className="w-full py-2 text-xs font-bold"
                style={{ color: '#e53e3e' }}
              >
                Remove watched status
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Delete dialog ── */}
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
