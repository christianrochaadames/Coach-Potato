import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { Film, Tv, Trash2, Calendar, ChevronLeft, Play, X, Check, ChevronRight } from 'lucide-react';
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

// ── Types ────────────────────────────────────────────────────────────────────

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
  stillUrl?: string | null;
  runtime?: number | null;
  overview?: string | null;
};

type TmdbSeasonSummary = {
  number: number;
  name: string;
  episodeCount: number;
  posterUrl: string | null;
  airYear: number | null;
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

// Episode sheet: tracks multiple seasons so user can tab between them
type EpSheetState = {
  activeSeason: number;
  seasonNums: number[];
  bySeasonEdits: Record<number, EpisodeData[]>;   // locally modified
  bySeasonLoaded: Record<number, EpisodeData[]>;   // fetched from TMDB
  loading: Record<number, boolean>;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip tier/ad suffixes and dedup providers — one entry per base platform */
function dedupeProviders<T extends { providerName: string }>(providers: T[]): T[] {
  const normalize = (name: string) =>
    name
      .replace(/\s+(Premium|Essential|Basic|Standard)(?=\s|$)/gi, '')
      .replace(/\s*(standard\s+with\s+ads|with\s+ads|basic\s+with\s+ads|\+\s*ads|[\(\[][^)\]]*ads[^)\]]*[\)\]])/gi, '')
      .trim();
  const seen = new Map<string, T>();
  for (const p of providers) {
    const key = normalize(p.providerName).toLowerCase();
    const existing = seen.get(key);
    // Prefer the shorter (cleaner) name
    if (!existing || p.providerName.length < existing.providerName.length) {
      seen.set(key, p);
    }
  }
  return [...seen.values()];
}

function formatMonthYear(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EntryDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const entryId = params.id ? Number(params.id) : undefined;

  // ── Success banner ──────────────────────────────────────────────────────────
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showSuccess(msg: string) {
    if (successTimer.current) clearTimeout(successTimer.current);
    setSuccessMsg(msg);
    successTimer.current = setTimeout(() => setSuccessMsg(null), 2500);
  }

  // ── Editable state ──────────────────────────────────────────────────────────
  const [rating, setRating] = useState<number | null>(null);
  const [dateWatched, setDateWatched] = useState('');      // stored YYYY-MM-01
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // ── Season / episode state ──────────────────────────────────────────────────
  const [tmdbSeasons, setTmdbSeasons] = useState<TmdbSeasonSummary[]>([]);
  const [epSheet, setEpSheet] = useState<EpSheetState | null>(null);
  const [seasonRatingSheet, setSeasonRatingSheet] = useState<{
    num: number; rating: number | null; note: string;
  } | null>(null);

  // ── External data ───────────────────────────────────────────────────────────
  const [tmdbDetail, setTmdbDetail] = useState<TmdbDetailData | null>(null);
  const [tmdbDetailLoading, setTmdbDetailLoading] = useState(false);
  const [watchProviders, setWatchProviders] = useState<WatchProvidersData | null>(null);
  const [watchProvidersLoading, setWatchProvidersLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<TmdbResult[]>([]);
  const [omdbData, setOmdbData] = useState<OmdbData | null>(null);

  // ── API hooks ───────────────────────────────────────────────────────────────
  const { data: entry, isLoading } = useGetEntry(entryId!, {
    query: { enabled: !!entryId, queryKey: getGetEntryQueryKey(entryId!) },
  });
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  // ── Autosave ────────────────────────────────────────────────────────────────
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

  // ── Init from entry ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (entry) {
      setRating(entry.rating ?? null);
      setDateWatched(entry.dateWatched ?? '');
    }
  }, [entry]);

  // ── TMDB: seasons list with posters ────────────────────────────────────────
  useEffect(() => {
    if (!entry || entry.type !== 'show' || !entry.tmdbId) { setTmdbSeasons([]); return; }
    fetch(`/api/tmdb/show/${entry.tmdbId}`)
      .then(r => r.ok ? r.json() : {})
      .then((d: { seasons?: TmdbSeasonSummary[] }) => setTmdbSeasons(d.seasons ?? []))
      .catch(() => {});
  }, [entry?.tmdbId, entry?.type]);

  // ── TMDB: cast + directors ──────────────────────────────────────────────────
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

  // ── TMDB: watch providers ───────────────────────────────────────────────────
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

  // ── TMDB: recommendations ───────────────────────────────────────────────────
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

  // ── OMDB: ratings ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!entry?.title) return;
    const year = entry.year ? String(entry.year) : '';
    fetch(`/api/omdb/ratings?title=${encodeURIComponent(entry.title)}${year ? `&year=${year}` : ''}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setOmdbData({ rtScore: d.rtScore, imdbRating: d.imdbRating }))
      .catch(() => {});
  }, [entry?.title, entry?.year]);

  // ── Season helpers ──────────────────────────────────────────────────────────
  const getSeasonsArray = useCallback(
    (): SeasonData[] => ((entry as any)?.seasons ?? []) as SeasonData[],
    [entry]
  );

  // Load TMDB episodes for a season into the episode sheet
  function loadSeasonEpisodes(seasonNum: number, tmdbId: number, currentSheet: EpSheetState) {
    if (currentSheet.bySeasonLoaded[seasonNum] !== undefined) return; // already loaded

    setEpSheet(prev => {
      if (!prev) return prev;
      return { ...prev, loading: { ...prev.loading, [seasonNum]: true } };
    });

    const savedSeasons = getSeasonsArray();
    const existing = savedSeasons.find(s => s.number === seasonNum);
    const existingEps = existing?.episodes ?? [];

    fetch(`/api/tmdb/tv/${tmdbId}/season/${seasonNum}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { episodes?: any[] } | null) => {
        if (!d?.episodes) {
          setEpSheet(prev => prev
            ? { ...prev, bySeasonLoaded: { ...prev.bySeasonLoaded, [seasonNum]: [] }, loading: { ...prev.loading, [seasonNum]: false } }
            : prev);
          return;
        }
        const fetched: EpisodeData[] = d.episodes.map((ep: any) => {
          const saved = existingEps.find(e => e.number === ep.episode_number);
          return {
            number: ep.episode_number,
            title: ep.name,
            watched: saved?.watched ?? false,
            airDate: ep.air_date ?? null,
            stillUrl: ep.stillUrl ?? null,
            runtime: ep.runtime ?? null,
            overview: ep.overview ?? null,
          };
        });
        setEpSheet(prev => {
          if (!prev) return prev;
          const edits = prev.bySeasonEdits[seasonNum];
          return {
            ...prev,
            bySeasonLoaded: { ...prev.bySeasonLoaded, [seasonNum]: fetched },
            bySeasonEdits: { ...prev.bySeasonEdits, [seasonNum]: edits ?? fetched },
            loading: { ...prev.loading, [seasonNum]: false },
          };
        });
      })
      .catch(() => setEpSheet(prev => prev
        ? { ...prev, loading: { ...prev.loading, [seasonNum]: false } }
        : prev));
  }

  function openEpisodeSheet(startSeason: number) {
    const seasonNums = tmdbSeasons.map(s => s.number).filter(n => n > 0);
    if (!seasonNums.length) return;
    const savedSeasons = getSeasonsArray();

    // Prefill edits from saved data
    const savedEdits: Record<number, EpisodeData[]> = {};
    for (const s of savedSeasons) {
      if (s.episodes?.length) savedEdits[s.number] = s.episodes;
    }

    const initial: EpSheetState = {
      activeSeason: startSeason,
      seasonNums,
      bySeasonEdits: savedEdits,
      bySeasonLoaded: {},
      loading: {},
    };
    setEpSheet(initial);
    if (entry?.tmdbId) loadSeasonEpisodes(startSeason, entry.tmdbId, initial);
  }

  function switchEpSeason(num: number) {
    setEpSheet(prev => {
      if (!prev) return prev;
      const next = { ...prev, activeSeason: num };
      if (entry?.tmdbId && prev.bySeasonLoaded[num] === undefined) {
        loadSeasonEpisodes(num, entry.tmdbId, next);
      }
      return next;
    });
  }

  function toggleEpisode(epNum: number) {
    if (!epSheet) return;
    const { activeSeason, bySeasonEdits, bySeasonLoaded } = epSheet;
    const base = bySeasonEdits[activeSeason] ?? bySeasonLoaded[activeSeason] ?? [];
    const updated = base.map(ep => ep.number === epNum ? { ...ep, watched: !ep.watched } : ep);
    setEpSheet(prev => prev ? { ...prev, bySeasonEdits: { ...prev.bySeasonEdits, [activeSeason]: updated } } : prev);
  }

  function saveEpisodes() {
    if (!epSheet || !entryId || !entry) return;
    const { activeSeason, bySeasonEdits } = epSheet;
    const episodes = bySeasonEdits[activeSeason] ?? [];
    const savedSeasons = getSeasonsArray();
    const watchedCount = episodes.filter(e => e.watched).length;
    const autoStatus: 'watched' | 'watching' = watchedCount === episodes.length && episodes.length > 0 ? 'watched' : 'watching';
    const updated: SeasonData[] = [
      ...savedSeasons.filter(s => s.number !== activeSeason),
      { ...(savedSeasons.find(s => s.number === activeSeason) ?? { number: activeSeason }), status: autoStatus, episodes },
    ];
    updateEntry.mutate(
      { id: entryId, data: { seasons: updated } as any },
      {
        onSuccess: () => {
          showSuccess(`Season ${activeSeason} progress saved`);
          queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(entryId) });
          setEpSheet(null);
        },
      }
    );
  }

  // Season rating sheet
  function openSeasonRatingSheet(num: number) {
    const sd = getSeasonsArray().find(s => s.number === num);
    setSeasonRatingSheet({ num, rating: sd?.rating ?? null, note: sd?.notes ?? '' });
  }

  function confirmSeasonRating() {
    if (!seasonRatingSheet || !entryId || !entry) return;
    const { num, rating: sRating } = seasonRatingSheet;
    const savedSeasons = getSeasonsArray();
    const existing = savedSeasons.find(s => s.number === num);
    const today = new Date().toISOString().split('T')[0];
    const updated: SeasonData[] = [
      ...savedSeasons.filter(s => s.number !== num),
      { number: num, status: 'watched', dateWatched: existing?.dateWatched ?? today, rating: sRating ?? null, notes: null, episodes: existing?.episodes },
    ];
    updateEntry.mutate(
      { id: entryId, data: { seasons: updated } as any },
      {
        onSuccess: () => {
          showSuccess(`Season ${num} marked watched`);
          queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(entryId) });
          setSeasonRatingSheet(null);
        },
      }
    );
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
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

  // ── Loading / not found ────────────────────────────────────────────────────
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

  const savedSeasons = getSeasonsArray();
  const watchedNums = new Set(savedSeasons.filter(s => s.status === 'watched').map(s => s.number));
  // Active season episodes shown in sheet
  const activeEps = epSheet
    ? (epSheet.bySeasonEdits[epSheet.activeSeason] ?? epSheet.bySeasonLoaded[epSheet.activeSeason] ?? [])
    : [];

  // ── Render ─────────────────────────────────────────────────────────────────
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
          <button onClick={() => setSuccessMsg(null)} aria-label="Dismiss">
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

        {/* ── Hero ── */}
        <div className="flex gap-4 mb-5">
          <div className="w-28 flex-shrink-0 aspect-[2/3] rounded-2xl overflow-hidden shadow-md relative" style={{ background: '#EFE4D2' }}>
            {entry.posterUrl
              ? <img src={entry.posterUrl} alt={entry.title} className="w-full h-full object-cover" />
              : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <span className="text-3xl font-bold" style={{ color: '#116149' }}>{entry.title[0]?.toUpperCase() ?? '?'}</span>
                  {entry.type === 'movie' ? <Film className="w-5 h-5" style={{ color: '#7E7A73' }} /> : <Tv className="w-5 h-5" style={{ color: '#7E7A73' }} />}
                </div>
              )}
          </div>

          <div className="flex-1 min-w-0 pt-1 flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={entry.type === 'movie' ? { background: '#EDE9FE', color: '#5B21B6' } : { background: '#FF4BAE', color: '#ffffff' }}>
                {entry.type === 'movie' ? 'Movie' : 'TV Show'}
              </span>
              {omdbData?.imdbRating && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F5C518', color: '#000000' }}>
                  IMDb {omdbData.imdbRating}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold leading-snug" style={{ color: '#111111' }} data-testid="text-entry-title">{entry.title}</h1>
            {entry.year && <p className="text-xs" style={{ color: '#7E7A73' }}>{entry.year}</p>}
          </div>
        </div>

        {/* ── Ratings: TMDB + Your Stars ── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
          {/* Audience score from TMDB */}
          <div className="pb-3 mb-3" style={{ borderBottom: '1px solid #EFE4D2' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#7E7A73' }}>Audience Rating</p>
            <p className="text-xl font-bold" style={{ color: tmdbDetail?.voteAverage ? '#111111' : '#B0A99E' }}>
              {tmdbDetail?.voteAverage != null
                ? `${tmdbDetail.voteAverage.toFixed(1)} / 10`
                : (tmdbDetailLoading ? '—' : 'N/A')}
            </p>
            <p className="text-[10px] font-bold mt-0.5" style={{ color: '#B0A99E' }}>
              Source: The Movie Database (TMDB)
            </p>
          </div>
          {/* Your rating */}
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#7E7A73' }}>Your Rating</p>
          <StarRating
            rating={rating}
            onRatingChange={r => { setRating(r); autosave({ rating: r }, 'Rating saved'); }}
            size="md"
          />
        </div>

        {/* ── Status chips — no emojis ── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#7E7A73' }}>Status</p>
          <div className="flex gap-2">
            {([
              { key: 'completed', label: 'Watched', activeBg: '#116149', activeColor: '#ffffff' },
              { key: 'watching', label: 'Watching', activeBg: '#9BD6FF', activeColor: '#116149' },
              { key: 'plan_to_watch', label: 'Watchlist', activeBg: '#BDECC8', activeColor: '#116149' },
            ] as const).map(({ key, label, activeBg, activeColor }) => (
              <button
                key={key}
                onClick={() => autosave({ status: key }, 'Status updated')}
                className="flex-1 py-2 rounded-full text-xs font-bold transition-all"
                disabled={updateEntry.isPending}
                style={entry.status === key
                  ? { background: activeBg, color: activeColor }
                  : { background: '#ffffff', border: '1px solid #E2D9CE', color: '#7E7A73' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Date Watched — month + year only ── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className="w-3.5 h-3.5" style={{ color: '#7E7A73' }} />
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7E7A73' }}>Date Watched</p>
          </div>
          {dateWatched
            ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: '#111111' }}>{formatMonthYear(dateWatched)}</span>
                <button className="text-xs underline" style={{ color: '#7E7A73' }}
                  onClick={() => { const el = document.getElementById('month-picker'); if (el) el.focus(); }}>
                  Change
                </button>
                <button className="text-xs underline" style={{ color: '#e53e3e' }}
                  onClick={() => { setDateWatched(''); autosave({ dateWatched: null }, 'Date cleared'); }}>
                  Clear
                </button>
              </div>
            )
            : (
              <p className="text-sm" style={{ color: '#B0A99E' }}>Not set</p>
            )}
          {/* Hidden month input */}
          <input
            id="month-picker"
            type="month"
            value={dateWatched ? dateWatched.slice(0, 7) : ''}
            onChange={e => {
              const val = e.target.value; // YYYY-MM
              const asDate = val ? `${val}-01` : '';
              setDateWatched(asDate);
              autosave({ dateWatched: asDate || null }, 'Date saved');
            }}
            className="sr-only"
            data-testid="input-edit-date"
            tabIndex={-1}
          />
        </div>

        {/* ── Seasons — TV shows only ── */}
        {entry.type === 'show' && tmdbSeasons.filter(s => s.number > 0).length > 0 && (
          <div className="rounded-2xl overflow-hidden mb-4" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7E7A73' }}>Seasons</p>
              <p className="text-xs font-bold" style={{ color: '#116149' }}>
                {watchedNums.size} / {tmdbSeasons.filter(s => s.number > 0).length} watched
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: '#F0EAE2' }}>
              {tmdbSeasons.filter(s => s.number > 0).map(season => {
                const sd = savedSeasons.find(s => s.number === season.number);
                const isWatched = watchedNums.has(season.number);
                const epList = sd?.episodes ?? [];
                const epWatched = epList.filter(e => e.watched).length;
                const epTotal = epList.length;
                const hasProg = epTotal > 0;
                return (
                  <button
                    key={season.number}
                    type="button"
                    onClick={() => openEpisodeSheet(season.number)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-orange-50/30 active:bg-orange-50/50"
                  >
                    {/* Season poster */}
                    <div className="w-14 flex-shrink-0 aspect-[2/3] rounded-xl overflow-hidden" style={{ background: '#EFE4D2' }}>
                      {season.posterUrl
                        ? <img src={season.posterUrl} alt={season.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ color: '#116149' }}>S{season.number}</div>}
                    </div>
                    {/* Season info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ color: '#111111' }}>{season.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#7E7A73' }}>
                        {season.episodeCount} episode{season.episodeCount !== 1 ? 's' : ''}
                        {season.airYear ? ` · ${season.airYear}` : ''}
                      </p>
                      {hasProg && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#EFE4D2' }}>
                            <div className="h-full rounded-full" style={{ background: '#116149', width: `${Math.round(epWatched / epTotal * 100)}%` }} />
                          </div>
                          <span className="text-[10px] font-bold flex-shrink-0" style={{ color: '#116149' }}>{epWatched}/{epTotal}</span>
                        </div>
                      )}
                      <p className="text-xs mt-1 font-semibold" style={{ color: isWatched ? '#116149' : '#4A78FF' }}>
                        {isWatched ? 'Watched ✓' : 'View episodes →'}
                      </p>
                    </div>
                    {/* Per-season rating + right-click to rate */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      {isWatched && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); openSeasonRatingSheet(season.number); }}
                          className="flex gap-px"
                          aria-label={`Rate season ${season.number}`}
                        >
                          {[1, 2, 3, 4, 5].map(star => (
                            <span key={star} className="text-xs leading-none"
                              style={{ color: star <= (sd?.rating ?? 0) ? '#FFD34D' : '#D4C9BC' }}>★</span>
                          ))}
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4" style={{ color: '#D4C9BC' }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── About ── always visible ── */}
        {entry.synopsis && (
          <div className="rounded-2xl mb-4 p-4" style={{ background: '#ffffff', border: '1px solid #E2D9CE' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#7E7A73' }}>About</p>
            <p className="text-sm leading-relaxed" style={{ color: '#111111' }}>{entry.synopsis}</p>
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
                    <p className="text-[11px] font-bold mb-1.5" style={{ color: '#7E7A73' }}>{entry.type === 'movie' ? 'Director' : 'Creator'}</p>
                    <div className="flex flex-wrap gap-2">
                      {tmdbDetail.directors.map(d => (
                        <span key={d.name} className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: '#EFE4D2', color: '#116149' }}>{d.name}</span>
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
                  <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="text-[10px] underline" style={{ color: '#7E7A73' }}>The Movie Database (TMDB)</a>
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
                    {dedupeProviders(watchProviders.streaming).map(p => (
                      <div key={p.providerName} title={p.providerName}>
                        <img src={p.logoUrl} alt={p.providerName} className="w-10 h-10 rounded-xl object-cover" style={{ border: '1px solid #E2D9CE' }}
                          onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                      </div>
                    ))}
                  </div>
                ) : (watchProviders.rent.length > 0 || watchProviders.buy.length > 0) ? (
                  <>
                    <p className="text-xs mb-2" style={{ color: '#7E7A73' }}>Not on streaming — available to rent/buy</p>
                    <div className="flex flex-wrap gap-2">
                      {dedupeProviders([...watchProviders.rent, ...watchProviders.buy]).map(p => (
                          <div key={p.providerName} title={p.providerName}>
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
                  <div className="w-24 aspect-[2/3] rounded-xl overflow-hidden mb-1.5 shadow-sm" style={{ background: '#EFE4D2' }}>
                    {rec.posterUrl
                      ? <img src={rec.posterUrl} alt={rec.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-lg font-bold" style={{ color: '#116149' }}>{rec.title[0]}</div>}
                  </div>
                  <p className="text-[10px] font-bold leading-tight text-center" style={{ color: '#111111' }} title={rec.title}>
                    {rec.title.length > 16 ? rec.title.slice(0, 16) + '…' : rec.title}
                  </p>
                  {rec.year && <p className="text-[9px] text-center mt-0.5" style={{ color: '#7E7A73' }}>{rec.year}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Episode sheet ── */}
      {epSheet && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} onClick={() => setEpSheet(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl max-w-lg mx-auto flex flex-col" style={{ background: '#FFF3E8', maxHeight: '90vh' }}>
            {/* Handle */}
            <div className="flex-shrink-0 pt-4 pb-2 px-5">
              <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: '#D4C9BC' }} />
              <p className="text-base font-bold mb-3" style={{ color: '#111111' }}>Season Progress</p>
              {/* Season tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
                {epSheet.seasonNums.map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => switchEpSeason(num)}
                    className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                    style={epSheet.activeSeason === num
                      ? { background: '#116149', color: '#ffffff' }
                      : { background: '#EFE4D2', color: '#7E7A73' }}
                  >
                    Season {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress bar */}
            {activeEps.length > 0 && (() => {
              const watched = activeEps.filter(e => e.watched).length;
              const total = activeEps.length;
              return (
                <div className="flex-shrink-0 px-5 pb-3">
                  <div className="flex justify-between text-xs mb-1.5" style={{ color: '#7E7A73' }}>
                    <span>{watched} / {total} episodes watched</span>
                    <span>{Math.round(watched / total * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#EFE4D2' }}>
                    <div className="h-full rounded-full transition-all duration-300" style={{ background: '#116149', width: `${Math.round(watched / total * 100)}%` }} />
                  </div>
                </div>
              );
            })()}

            {/* Episode list — scrollable */}
            <div className="flex-1 overflow-y-auto px-5 min-h-0">
              {epSheet.loading[epSheet.activeSeason] ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#EFE4D2', borderTopColor: '#116149' }} />
                </div>
              ) : activeEps.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: '#7E7A73' }}>No episodes available</p>
              ) : (
                <div className="space-y-2 pb-4">
                  {activeEps.map(ep => (
                    <button
                      key={ep.number}
                      type="button"
                      onClick={() => toggleEpisode(ep.number)}
                      className="w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all"
                      style={ep.watched
                        ? { background: 'rgba(17,97,73,0.08)', border: '1px solid rgba(17,97,73,0.25)' }
                        : { background: '#ffffff', border: '1px solid #E2D9CE' }}
                    >
                      {/* Episode still */}
                      <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 96, height: 54, background: '#EFE4D2' }}>
                        {ep.stillUrl
                          ? <img src={ep.stillUrl} alt={`E${ep.number}`} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ color: '#116149' }}>E{ep.number}</div>}
                      </div>
                      {/* Episode info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold leading-tight" style={{ color: ep.watched ? '#116149' : '#111111' }}>
                          S{String(epSheet.activeSeason).padStart(2, '0')}E{String(ep.number).padStart(2, '0')}{ep.title ? ` · ${ep.title}` : ''}
                        </p>
                        {(ep.airDate || ep.runtime) && (
                          <p className="text-[10px] mt-0.5" style={{ color: '#7E7A73' }}>
                            {ep.airDate ?? ''}{ep.airDate && ep.runtime ? ' · ' : ''}{ep.runtime ? `${ep.runtime} min` : ''}
                          </p>
                        )}
                        {ep.overview && (
                          <p className="text-[10px] mt-0.5 leading-relaxed line-clamp-2" style={{ color: '#7E7A73' }}>{ep.overview}</p>
                        )}
                      </div>
                      {/* Checkbox */}
                      <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1"
                        style={{ background: ep.watched ? '#116149' : 'transparent', borderColor: ep.watched ? '#116149' : '#D4C9BC' }}>
                        {ep.watched && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex-shrink-0 px-5 py-4 flex gap-3" style={{ borderTop: '1px solid #E2D9CE' }}>
              <button
                type="button"
                onClick={() => { openSeasonRatingSheet(epSheet.activeSeason); }}
                className="px-4 py-3 rounded-full font-bold text-sm"
                style={{ background: '#EFE4D2', color: '#116149' }}
              >
                ★ Rate
              </button>
              <button type="button" onClick={() => setEpSheet(null)} className="flex-1 py-3 rounded-full font-bold text-sm" style={{ background: '#ffffff', border: '1px solid #E2D9CE', color: '#7E7A73' }}>
                Cancel
              </button>
              <button type="button" onClick={saveEpisodes} disabled={updateEntry.isPending} className="flex-1 py-3 rounded-full font-bold text-sm text-white disabled:opacity-60" style={{ background: '#116149' }}>
                {updateEntry.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Season rating sheet ── */}
      {seasonRatingSheet && (
        <>
          <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} onClick={() => setSeasonRatingSheet(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-3xl px-5 pt-5 pb-8 max-w-lg mx-auto" style={{ background: '#FFF3E8' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#D4C9BC' }} />
            <p className="text-base font-bold mb-4" style={{ color: '#111111' }}>Season {seasonRatingSheet.num} — Rate</p>
            <div className="mb-5">
              <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#7E7A73' }}>Rating (optional)</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} type="button"
                    onClick={() => setSeasonRatingSheet(s => s ? { ...s, rating: star === s.rating ? null : star } : s)}
                    className="text-3xl leading-none transition-transform active:scale-110"
                    style={{ color: star <= (seasonRatingSheet.rating ?? 0) ? '#FFD34D' : '#D4C9BC' }}>★</button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setSeasonRatingSheet(null)} className="flex-1 py-3.5 rounded-full font-bold text-sm" style={{ background: '#ffffff', border: '1px solid #E2D9CE', color: '#7E7A73' }}>Cancel</button>
              <button type="button" onClick={confirmSeasonRating} disabled={updateEntry.isPending} className="flex-1 py-3.5 rounded-full font-bold text-sm text-white disabled:opacity-60" style={{ background: '#116149' }}>
                {updateEntry.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Delete dialog ── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{entry.title}&rdquo; from your collection. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
