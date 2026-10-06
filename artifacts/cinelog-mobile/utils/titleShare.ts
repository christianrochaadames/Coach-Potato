import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Share } from 'react-native';
import { getPublicTitle, getSocialConfig, tmdbSearch } from '@workspace/api-client-react';

export type ShareableTitle = {
  title: string;
  type: 'movie' | 'show' | string;
  year?: number | null;
  tmdbId?: number | null;
};

const norm = (s: string) => s.trim().toLowerCase();

/** Finds a TMDB id for a legacy entry saved without one. Returns null when nothing matches. */
export async function lookupTmdbId(t: ShareableTitle): Promise<number | null> {
  const type = t.type === 'movie' ? 'movie' : 'show';
  const body = await tmdbSearch({ q: t.title });
  const results = Array.isArray(body?.results) ? body.results : [];
  const sameType = results.filter(r => r.type === type);
  const exact = sameType.filter(r => norm(r.title) === norm(t.title));
  // Never share an unrelated title just because its release year happens to match.
  // Legacy log years can be watched years, not release years; refuse ambiguous remakes.
  return exact.length === 1 ? exact[0].tmdbId : null;
}

/** Resolves a stable TMDB identity for a title, looking it up when missing. */
export function useTitleIdentity(t: { title?: string; type?: string; year?: number | null; tmdbId?: number | null } | null | undefined) {
  const given = t?.tmdbId ?? null;
  const title = t?.title; const type = t?.type; const year = t?.year ?? null;
  const [found, setFound] = useState<number | null>(null);
  const [resolving, setResolving] = useState(false);
  useEffect(() => {
    setFound(null);
    if (given || !title || !type) { setResolving(false); return; }
    let cancelled = false;
    setResolving(true);
    lookupTmdbId({ title, type, year })
      .then(id => { if (!cancelled) setFound(id); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setResolving(false); });
    return () => { cancelled = true; };
  }, [given, title, type, year]);
  return { tmdbId: given ?? found, resolving };
}

export async function shareTitle(t: ShareableTitle): Promise<void> {
  const type = t.type === 'movie' ? 'movie' : 'show';
  const id = t.tmdbId ?? (await lookupTmdbId(t));
  if (!id) {
    // Manual/uncatalogued entries can still be shared, without leaking private entry metadata.
    const { inviteUrl } = await getSocialConfig();
    const shareUrl = `${inviteUrl}/api/share/unmatched?type=${type}&title=${encodeURIComponent(t.title)}`;
    const message = `Check out ${t.title} on Spud!`;
    await Share.share(Platform.OS === 'ios' ? { message, url: shareUrl } : { message: `${message}\n${shareUrl}` });
    return;
  }
  const pub = await getPublicTitle(type, id);
  if (!pub?.shareUrl) throw new Error('This title does not have a share link yet.');
  const message = `${pub.title}${pub.year ? ` (${pub.year})` : ''} on Spud. Take a look:`;
  await Share.share(
    Platform.OS === 'ios'
      ? { message, url: pub.shareUrl }
      : { message: `${message}\n${pub.shareUrl}`, title: pub.title },
  );
}

export function useTitleShare(t: ShareableTitle | null | undefined) {
  const [busy, setBusy] = useState(false);
  const share = useCallback(async () => {
    if (!t || busy) return;
    setBusy(true);
    try { await shareTitle(t); }
    catch (e) { Alert.alert('Could not share', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }, [t?.title, t?.type, t?.year, t?.tmdbId, busy]);
  return { share, busy };
}

/** Opens the public title sheet for a title shown on a buddy's profile (resolving a TMDB id if needed). */
export async function openTitleSheet(t: ShareableTitle, push: (path: string) => void) {
  try {
    const type = t.type === 'movie' ? 'movie' : 'show';
    const id = t.tmdbId ?? (await lookupTmdbId({ ...t, type }));
    if (!id) throw new Error('We could not find details for this title.');
    push(`/title/${type}/${id}`);
  } catch (e) {
    Alert.alert('Could not open title', e instanceof Error ? e.message : 'Please try again.');
  }
}
