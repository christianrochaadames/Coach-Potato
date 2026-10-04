/**
 * Profile screen — accessible via avatar button on the Home tab.
 * Dark green page; always-visible Spud avatar grid + photo picker;
 * inline-editable NAME and BIO cards; sign-out pill at bottom.
 */
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Alert, TextInput, ActivityIndicator, Linking, Modal, KeyboardAvoidingView, Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useUser, useClerk, useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/utils/authFetch';
import { trackEvent } from '@/utils/analytics';
import { getMobileProfileQueryKey } from '@/utils/profile';
import { useBuddyLists } from '@/utils/buddies';
import { BuddyRow, buddyColors } from '@/components/BuddyUI';
import {
  resolveSpudAvatar,
  SPUD_AVATAR_BACKGROUND,
  SPUD_AVATARS,
} from '@/constants/avatars';

// ── Constants ─────────────────────────────────────────────────────────────────
const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app';
const API = `https://${DOMAIN}`;

type EditingField = 'name' | 'username' | 'bio' | null;
type FavoriteKind = 'tv' | 'movie';
type FavoriteSearchItem = {
  tmdbId: number;
  title: string;
  type: 'movie' | 'show';
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
};
type FavoriteDetailData = {
  title: string;
  overview: string | null;
  cast: { name: string; character: string; profileUrl: string | null; personId?: number | null }[];
  directors: { name: string; job: string; profileUrl: string | null; personId?: number | null }[];
  runtime: number | null;
  releaseYear: number | null;
  voteAverage: number | null;
  genres: string[];
};
type FavoriteProvidersData = {
  streaming: FavoriteProvider[];
  rent: FavoriteProvider[];
  buy: FavoriteProvider[];
};
type FavoriteProvider = {
  providerId: number;
  providerName: string;
  logoUrl: string;
  displayPriority?: number;
};
type FavoriteDetailState = {
  title: string;
  type: FavoriteKind;
  posterUrl: string | null;
  detail: FavoriteDetailData | null;
  providers: FavoriteProvidersData | null;
  loading: boolean;
  error: string | null;
};

type LegalPage = 'privacy' | 'terms' | null;
type LegalSection = { title: string; body: string };

const LEGAL_CONTENT: Record<Exclude<LegalPage, null>, {
  title: string;
  intro: string;
  sections: LegalSection[];
}> = {
  privacy: {
    title: 'Privacy Policy',
    intro: "Spud is a movie and TV tracking app. This policy explains what information Spud collects, why, and what your options are. It only covers what Spud actually does — there's no advertising and no data sold to anyone.",
    sections: [
      { title: '1. Who runs Spud', body: 'Spud is operated by Christian Rocha Adames, trading as an individual (sole trader) based in Australia. Contact details are at the bottom of this page.' },
      { title: '2. Information you give us', body: "Account details. When you sign up, you create a profile with a first name, last name, username, and optional bio. You can choose an avatar from Spud's built-in character set, or upload your own photo. Signed-in users can search for your name or username and see your name, username, and avatar in results.\n\nLogin. Spud doesn't store your password. Sign-in is handled by our authentication provider, Clerk, either by email and password or by connecting a Google, Apple, GitHub, or X account. Clerk holds your email address, your OAuth login tokens, and session information on their servers, not ours.\n\nWhat you log. Every title you add to your list — its watch status, your rating, the date, your notes, and which streaming service you watched it on — is saved to your Spud account so the app can build your history and recommendations." },
      { title: '3. Information we collect automatically', body: "Spud's web app sets one functional cookie and briefly uses browser session storage for interface preferences. The published web app uses Replit-hosted analytics to measure anonymous page views and selected product interactions. The mobile app uses PostHog only for selected product interactions such as adding a title, completing onboarding, changing a watch status, or saving a rating. Mobile events may include the app version, build number, operating system name and version, and a randomly generated analytics identifier. We do not send your name, email address, username, bio, notes, title names, search text, account identifiers, advertising identifiers, or precise location in these events. Our servers may briefly log technical request data such as an IP address as part of normal traffic, but it is not stored against your account or kept long-term." },
      { title: "4. What we don't collect", body: "Spud does not collect your precise location or advertising device identifiers, and does not use analytics for advertising. Mobile session replay, automatic touch capture, surveys, and automatic screen capture are disabled. There are no ad networks in Spud." },
      { title: '5. How we use and share your information', body: "We use your information to run your account, save your watch history, show you personalised recommendations, verify your identity when you sign in, provide customer support, send essential account and operational messages, and understand aggregate usage of Spud. Signed-in users can find your name, username and avatar through buddy search. Only after you accept a buddy request can that buddy see your bio, top three TV shows and movies, and the posters, titles, statuses and counts on your watching, watchlist and watched shelves. Your email, notes, dates and ratings are never shared with buddies. You can remove a buddy to stop sharing those shelves. We don't send marketing emails, use your data for marketing, or sell it to anyone." },
      { title: '6. Services we rely on', body: "Clerk (sign-up, login, password resets, and essential account emails), TMDB (show/movie details, posters, streaming availability), OMDB (IMDb/Rotten Tomatoes scores), Replit (hosts our servers, database, and web analytics), PostHog (anonymous mobile product analytics), and Expo/EAS (builds and distributes the mobile app). None of these are ad networks." },
      { title: '7. Where your data lives', body: "Spud's servers, database, and authentication provider are hosted in the United States. PostHog processes anonymous mobile analytics in the region configured for our PostHog project. If you're using Spud from Australia or elsewhere, some information will be transferred overseas." },
      { title: '8. How long we keep your data', body: "We keep your account and log data for as long as your account is active. If you delete your account, your profile and log entries are removed from our database." },
      { title: '9. Your rights', body: "Under Australia's Privacy Act, you can ask us to tell you what personal information we hold about you, correct anything wrong, or delete your account entirely by emailing us. If you're outside Australia, you may have additional rights under your local law (such as GDPR); we'll honour reasonable requests regardless." },
      { title: '10. Security', body: "We take reasonable steps to protect your information, including relying on Clerk's security practices. No online service can guarantee complete security." },
      { title: '11. Age requirement', body: "Spud is intended for people aged 18 and over. By creating an account, you're confirming you meet that requirement." },
      { title: '12. Changes to this policy', body: "If we make meaningful changes to how we handle your data, we'll update this page and the date at the top." },
      { title: '13. Contact us', body: 'Email: mrspudcouchpotato@gmail.com' },
    ],
  },
  terms: {
    title: 'Terms of Service',
    intro: "These terms cover your use of Spud, a movie and TV tracking app. By creating an account or using Spud, you're agreeing to them. If something here doesn't sit right with you, the best move is not to use the app.",
    sections: [
      { title: '1. Who we are', body: 'Spud is operated by Christian Rocha Adames as a sole trader based in Australia. You can reach us at mrspudcouchpotato@gmail.com.' },
      { title: '2. Age requirement', body: "You need to be 18 or older to use Spud. By signing up, you're confirming that's true." },
      { title: '3. Your account', body: "You'll need an account to use Spud, created either with an email and password or by signing in through Google or Apple. You're responsible for keeping your login secure and for anything that happens under your account. If you notice any unauthorised use, let us know straight away. We can suspend or close accounts that break these terms." },
      { title: '4. What you log stays yours', body: 'Everything you add to Spud — ratings, notes, watch history — belongs to you. Signed-in users can search your name or username and see your name, username and avatar. If you accept a buddy request, that buddy can also see your bio, top three TV shows and movies, and the posters, titles, statuses and counts on your watching, watchlist and watched shelves. Your email, notes, dates and ratings are never shared with buddies. You can remove a buddy at any time to stop sharing those shelves.' },
      { title: '5. Using Spud fairly', body: "When using Spud, please don't: break any applicable law, pretend to be someone you're not, try to access parts of the system you're not meant to, scrape or pull data out of Spud using automated tools, upload anything harmful like malicious code, or use Spud for a commercial purpose without asking us first. We can suspend or remove access for anyone who does." },
      { title: '6. Movie and show data', body: "Titles, posters, and streaming availability shown in Spud come from The Movie Database (TMDB) and OMDB. That data belongs to those services and is subject to their own terms, not ours. We display it as-is and can't guarantee it's always accurate or current." },
      { title: '7. Ownership', body: "The Spud name, logo, and app design belong to us. Please don't copy, rebuild, or redistribute any part of it without asking first." },
      { title: '8. No guarantees', body: "Spud is provided as it is. We do our best to keep it running smoothly, but we can't promise it'll always be available, bug-free, or that the movie and show data pulled from third parties will always be accurate." },
      { title: '9. Limits on our liability', body: "To the extent the law allows, we're not liable for indirect or consequential losses arising from your use of Spud. Since Spud is currently free with no paid features, our total liability to you is limited to nil beyond what's required by law." },
      { title: '10. Ending your access', body: 'You can stop using Spud and delete your account whenever you like. We can also suspend or end your access if you break these terms. Sections that naturally need to survive that, like ownership and liability limits, will keep applying afterward.' },
      { title: '11. Governing law', body: 'These terms are governed by the laws of New South Wales, Australia, and any disputes will be handled in NSW courts.' },
      { title: '12. Changes to these terms', body: "We may update these terms from time to time. If we do, we'll update the date at the top." },
      { title: '13. Contact', body: 'Email: mrspudcouchpotato@gmail.com' },
    ],
  },
};

function favoriteProviderGroup(name: string): string {
  const value = name.toLowerCase();
  const groups: Array<[string, RegExp]> = [
    ['netflix', /netflix/],
    ['disney', /disney/],
    ['apple', /apple tv/],
    ['paramount', /paramount/],
    ['max', /\bmax\b|hbo max/],
    ['prime', /amazon|prime video/],
    ['hulu', /hulu/],
    ['peacock', /peacock/],
    ['youtube', /youtube/],
  ];
  return groups.find(([, pattern]) => pattern.test(value))?.[0]
    ?? value.replace(/\b(with ads|standard|essential|premium|on tv|channel)\b/g, '')
      .replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' ');
}

function dedupeFavoriteProviders(providers: FavoriteProvider[]): FavoriteProvider[] {
  const groups = new Map<string, FavoriteProvider[]>();
  for (const provider of providers) {
    const group = favoriteProviderGroup(provider.providerName);
    groups.set(group, [...(groups.get(group) ?? []), provider]);
  }
  return Array.from(groups.values()).map(candidates =>
    [...candidates].sort((a, b) => {
      const aName = a.providerName.toLowerCase();
      const bName = b.providerName.toLowerCase();
      const aVariant = /channel|with ads|standard|essential|premium/.test(aName) ? 1 : 0;
      const bVariant = /channel|with ads|standard|essential|premium/.test(bName) ? 1 : 0;
      return aVariant - bVariant || aName.length - bName.length;
    })[0],
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { userId, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const queryClient = useQueryClient();
  const buddies = useBuddyLists();

  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Inline editing
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [nameVal, setNameVal]     = useState('');
  const [usernameVal, setUsernameVal] = useState('');
  const [bioVal,  setBioVal]      = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [avatarPickerExpanded, setAvatarPickerExpanded] = useState(false);
  const [favoriteEditor, setFavoriteEditor] = useState<FavoriteKind | null>(null);
  const [favoriteTitle, setFavoriteTitle] = useState('');
  const [favoriteSelection, setFavoriteSelection] = useState<FavoriteSearchItem | null>(null);
  const [favoriteResults, setFavoriteResults] = useState<FavoriteSearchItem[]>([]);
  const [favoriteSearchLoading, setFavoriteSearchLoading] = useState(false);
  const [favoriteSearchError, setFavoriteSearchError] = useState<string | null>(null);
  const [favoriteDetail, setFavoriteDetail] = useState<FavoriteDetailState | null>(null);
  const [legalPage, setLegalPage] = useState<LegalPage>(null);

  const nameRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const bioRef  = useRef<TextInput>(null);

  // Derive avatar
  const avatarUrl =
    typeof profile?.avatarUrl === 'string' && profile.avatarUrl.trim().length > 0
      ? profile.avatarUrl
      : null;
  const avatarId  = typeof profile?.avatarId === 'string' ? profile.avatarId : null;
  const firstName = profile?.firstName ?? user?.firstName ?? '';
  const lastName  = profile?.lastName  ?? user?.lastName  ?? '';
  const email     = user?.primaryEmailAddress?.emailAddress ?? '';
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || email;

  const createdAt = user?.createdAt ? new Date(user.createdAt) : null;
  const memberSince = createdAt && !Number.isNaN(createdAt.getTime())
    ? createdAt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  let initials = '';
  if (firstName && lastName) initials = (firstName[0] + lastName[0]).toUpperCase();
  else if (firstName)        initials = firstName[0].toUpperCase();
  else if (email)            initials = email[0].toUpperCase();

  const avatarSource: any = avatarUrl
    ? { uri: avatarUrl }
    : resolveSpudAvatar(avatarId);
  const avatarItemSize = Math.floor((screenWidth - 94) / 4);

  // ── Load profile ──────────────────────────────────────────────────────────
  const loadProfile = async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const token = await getTokenRef.current();
      const res = await authFetch(`${API}/api/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        const p = body && typeof body === 'object' ? body as Record<string, any> : {};
        setProfile(p);
        setNameVal([p.firstName, p.lastName].filter(Boolean).join(' '));
        setUsernameVal(typeof p.username === 'string' ? p.username : '');
        setBioVal(typeof p.bio === 'string' ? p.bio : '');
      } else if (res.status === 401) {
        setProfileError('Your session expired. Please sign in again.');
      } else {
        setProfileError('We could not load your profile. You can try again.');
      }
    } catch {
      setProfileError('We could not load your profile. You can try again.');
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    setProfile(null);
    void loadProfile();
  }, [userId]);

  // ── Save profile field ────────────────────────────────────────────────────
  const saveField = async (payload: Record<string, any>): Promise<boolean> => {
    setSaving(true);
    setFieldError(null);
    try {
      const token = await getTokenRef.current();
      const res = await authFetch(`${API}/api/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFieldError(typeof body?.error === 'string' ? body.error : 'Could not save that change.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return false;
      }
      setProfile((p: any) => ({ ...p, ...payload }));
      queryClient.setQueryData(
        getMobileProfileQueryKey(userId),
        (cachedProfile: Record<string, any> | undefined) => ({
          ...(cachedProfile ?? profile ?? {}),
          ...payload,
        }),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch {
      setFieldError('Could not save that change. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    } finally { setSaving(false); }
  };

  const saveName = async () => {
    const parts = nameVal.trim().split(/\s+/);
    const newFirst = parts[0] ?? '';
    const newLast  = parts.slice(1).join(' ') || null;
    if (!newFirst) {
      setFieldError('Name cannot be empty.');
      return;
    }
    if (await saveField({ firstName: newFirst, lastName: newLast })) {
      trackEvent('profile_updated', { field: 'name' });
      setEditingField(null);
    }
  };

  const saveUsername = async () => {
    const next = usernameVal.trim();
    if (!/^[a-zA-Z0-9_]{2,30}$/.test(next)) {
      setFieldError('Use 2–30 letters, numbers, or underscores.');
      return;
    }
    if (await saveField({ username: next })) {
      trackEvent('profile_updated', { field: 'username' });
      setEditingField(null);
    }
  };

  const saveBio = async () => {
    if (await saveField({ bio: bioVal.trim() || null })) {
      trackEvent('profile_updated', { field: 'bio' });
      setEditingField(null);
    }
  };

  const topTvShows = Array.isArray(profile?.topTvShows) ? profile.topTvShows as string[] : [];
  const topMovies = Array.isArray(profile?.topMovies) ? profile.topMovies as string[] : [];
  const topTvShowPosters = Array.isArray(profile?.topTvShowPosters)
    ? profile.topTvShowPosters as (string | null)[]
    : [];
  const topMoviePosters = Array.isArray(profile?.topMoviePosters)
    ? profile.topMoviePosters as (string | null)[]
    : [];

  const openFavoriteEditor = (kind: FavoriteKind) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFavoriteEditor(kind);
    setFavoriteTitle('');
    setFavoriteSelection(null);
    setFavoriteResults([]);
    setFavoriteSearchError(null);
    setFieldError(null);
  };

  useEffect(() => {
    const query = favoriteTitle.trim();
    if (!favoriteEditor || !query) {
      setFavoriteResults([]);
      setFavoriteSearchLoading(false);
      setFavoriteSearchError(null);
      return;
    }

    let cancelled = false;
    setFavoriteSearchLoading(true);
    setFavoriteSearchError(null);
    const timer = setTimeout(async () => {
      try {
        const token = await getTokenRef.current();
        const res = await authFetch(`${API}/api/tmdb/search?q=${encodeURIComponent(query)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            res.status === 401
              ? 'Your session expired. Please sign in again.'
              : body?.error ?? 'Could not search the movie database.',
          );
        }
        const results = Array.isArray(body?.results)
          ? (body.results as FavoriteSearchItem[]).filter(item =>
              item.type === favoriteEditor
                || (favoriteEditor === 'tv' && item.type === 'show'),
            )
          : [];
        if (!cancelled) setFavoriteResults(results);
      } catch (error) {
        if (!cancelled) {
          setFavoriteResults([]);
          setFavoriteSearchError(error instanceof Error ? error.message : 'Could not search the movie database.');
        }
      } finally {
        if (!cancelled) setFavoriteSearchLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [favoriteEditor, favoriteTitle, userId]);

  const saveFavorite = async () => {
    const title = favoriteSelection?.title.trim() || favoriteTitle.trim();
    if (!title || !favoriteEditor) {
      setFieldError('Search for a title and choose one of the poster results.');
      return;
    }
    const key = favoriteEditor === 'tv' ? 'topTvShows' : 'topMovies';
    const posterKey = favoriteEditor === 'tv' ? 'topTvShowPosters' : 'topMoviePosters';
    const current = favoriteEditor === 'tv' ? topTvShows : topMovies;
    const currentPosters = favoriteEditor === 'tv' ? topTvShowPosters : topMoviePosters;
    if (current.length >= 3) return;
    if (current.some(item => item.toLowerCase() === title.toLowerCase())) {
      setFieldError('That one is already on your list.');
      return;
    }
    const posterUrl = favoriteSelection?.posterUrl ?? null;
    if (await saveField({
      [key]: [...current, title],
      [posterKey]: [...currentPosters, posterUrl],
    })) {
      setFavoriteEditor(null);
      setFavoriteTitle('');
      setFavoriteSelection(null);
    }
  };

  const removeFavorite = async (kind: FavoriteKind, title: string) => {
    const key = kind === 'tv' ? 'topTvShows' : 'topMovies';
    const posterKey = kind === 'tv' ? 'topTvShowPosters' : 'topMoviePosters';
    const current = kind === 'tv' ? topTvShows : topMovies;
    const currentPosters = kind === 'tv' ? topTvShowPosters : topMoviePosters;
    const index = current.indexOf(title);
    await saveField({
      [key]: current.filter(item => item !== title),
      [posterKey]: currentPosters.filter((_, posterIndex) => posterIndex !== index),
    });
  };

  const openFavoriteDetail = async (kind: FavoriteKind, title: string, posterUrl: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFavoriteDetail({
      title,
      type: kind,
      posterUrl,
      detail: null,
      providers: null,
      loading: true,
      error: null,
    });

    try {
      const token = await getTokenRef.current();
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      const searchResponse = await authFetch(`${API}/api/tmdb/search?q=${encodeURIComponent(title)}`, { headers });
      const searchBody = await searchResponse.json().catch(() => null);
      if (!searchResponse.ok) throw new Error(searchBody?.error ?? 'Could not find this title.');

      const expectedType = kind === 'movie' ? 'movie' : 'show';
      const results = Array.isArray(searchBody?.results)
        ? searchBody.results as FavoriteSearchItem[]
        : [];
      const match = results.find(item =>
        item.type === expectedType && item.title.toLowerCase() === title.toLowerCase(),
      ) ?? results.find(item => item.type === expectedType);
      if (!match) throw new Error('We could not find current details for this title.');

      const media = match.type === 'movie' ? 'movie' : 'tv';
      const [detailResponse, providersResponse] = await Promise.all([
        authFetch(`${API}/api/tmdb/${media}/${match.tmdbId}`, { headers }),
        authFetch(`${API}/api/tmdb/${media}/${match.tmdbId}/providers?region=US`, { headers }),
      ]);
      const detailBody = await detailResponse.json().catch(() => null);
      const providersBody = await providersResponse.json().catch(() => null);
      if (!detailResponse.ok) throw new Error(detailBody?.error ?? 'Could not load title details.');

      setFavoriteDetail(current => current ? {
        ...current,
        posterUrl: match.posterUrl ?? current.posterUrl,
        detail: detailBody as FavoriteDetailData,
        providers: providersResponse.ok ? providersBody as FavoriteProvidersData : null,
        loading: false,
      } : current);
    } catch (error) {
      setFavoriteDetail(current => current ? {
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Could not load title details.',
      } : current);
    }
  };

  // ── Avatar selection ──────────────────────────────────────────────────────
  const selectAvatar = async (id: string) => {
    Haptics.selectionAsync();
    if (await saveField({ avatarId: id, avatarUrl: null })) {
      trackEvent('avatar_updated', { source: 'preset' });
      setAvatarPickerExpanded(false);
    }
  };

  // ── Photo upload ──────────────────────────────────────────────────────────
  const handlePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Could not use that photo', 'Please choose another image and try again.');
      return;
    }
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${asset.base64}`;
    if (await saveField({ avatarUrl: dataUrl, avatarId: null })) {
      trackEvent('avatar_updated', { source: 'photo' });
      setAvatarPickerExpanded(false);
    }
    // Note: Clerk setProfileImage / File API not available in React Native —
    // the profile photo is stored in our own DB via saveField above.
  };

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } finally {
            queryClient.clear();
            router.replace('/(auth)/landing' as any);
          }
        },
      },
    ]);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#0F2D1C' }}>
      {profileLoading ? (
        <View style={[styles.state, { paddingTop: insets.top + 80 }]}>
          <ActivityIndicator size="large" color="#7EDC5A" />
          <Text style={styles.stateText}>Loading your profile…</Text>
        </View>
      ) : profileError ? (
        <View style={[styles.state, { paddingTop: insets.top + 80 }]}>
          <Feather name="alert-circle" size={34} color="#7EDC5A" />
          <Text style={styles.stateTitle}>Profile unavailable</Text>
          <Text style={styles.stateText}>{profileError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void loadProfile()}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace('/(tabs)' as any)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="arrow-left" size={20} color="#7EDC5A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>

        {/* Avatar circle */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            {avatarSource ? (
              <Image
                key={avatarUrl ?? avatarId ?? 'avatar'}
                source={avatarSource}
                style={styles.avatarImage}
                resizeMode={avatarUrl ? 'cover' : 'contain'}
              />
            ) : (
              <Text style={styles.initialsText}>{initials || '?'}</Text>
            )}
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          {email ? <Text style={styles.emailText}>{email}</Text> : null}
          {memberSince ? (
            <Text style={styles.memberText}>Member since {memberSince}</Text>
          ) : null}
          <TouchableOpacity
            style={styles.editPicturePill}
            onPress={() => setAvatarPickerExpanded(true)}
            activeOpacity={0.85}
          >
            <Feather name="edit-2" size={13} color="#0F2D1C" />
            <Text style={styles.editPictureText}>Edit picture</Text>
          </TouchableOpacity>
        </View>

        {/* ── Expanded avatar picker ── */}
        {avatarPickerExpanded && (
          <View style={styles.gridCard}>
            <TouchableOpacity
              style={styles.gridLabelRow}
              onPress={() => setAvatarPickerExpanded(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.gridLabel}>EDIT PROFILE PICTURE</Text>
              <Feather name="chevron-up" size={17} color="#0F2D1C" />
            </TouchableOpacity>

            <View style={styles.grid}>
              {SPUD_AVATARS.map(({ id, source }) => (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.gridItem,
                    { width: avatarItemSize, height: avatarItemSize },
                    avatarId === String(id) && !avatarUrl && styles.gridItemActive,
                  ]}
                  onPress={() => selectAvatar(id)}
                  activeOpacity={0.8}
                >
                  <Image source={source} style={styles.gridImg} resizeMode="contain" />
                  {avatarId === String(id) && !avatarUrl && (
                    <View style={styles.gridCheck}>
                      <Feather name="check" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[
                  styles.photoBtn,
                  { width: avatarItemSize, height: avatarItemSize },
                  avatarUrl && styles.photoBtnActive,
                ]}
                onPress={handlePhoto}
                activeOpacity={0.8}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.previewPhoto} resizeMode="cover" />
                ) : (
                  <>
                    <Feather name="camera" size={22} color="#7EDC5A" />
                    <Text style={styles.photoBtnText}>Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            {saving && (
              <ActivityIndicator style={styles.avatarSaving} size="small" color="#0F2D1C" />
            )}
          </View>
        )}

        {/* ── NAME card ── */}
        <View style={styles.fieldCard}>
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldLabel}>NAME</Text>
            {editingField === 'name' ? (
              <View style={styles.fieldActions}>
                <TouchableOpacity onPress={() => setEditingField(null)} activeOpacity={0.7}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveName} disabled={saving} activeOpacity={0.7}>
                  {saving ? <ActivityIndicator size="small" color="#7EDC5A" /> : (
                    <Text style={styles.saveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setNameVal([profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || displayName);
                  setFieldError(null);
                  setEditingField('name');
                  setTimeout(() => nameRef.current?.focus(), 100);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="edit-2" size={16} color="#A8D4B0" />
              </TouchableOpacity>
            )}
          </View>
          {editingField === 'name' ? (
            <TextInput
              ref={nameRef}
              style={styles.fieldInput}
              value={nameVal}
              onChangeText={setNameVal}
              placeholder="Your name"
              placeholderTextColor="#4A7A5A"
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
          ) : (
            <Text style={styles.fieldValue}>{displayName || '—'}</Text>
          )}
          {editingField === 'name' && fieldError ? <Text style={styles.fieldError}>{fieldError}</Text> : null}
        </View>

        {/* ── USERNAME card ── */}
        <View style={styles.fieldCard}>
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldLabel}>USERNAME</Text>
            {editingField === 'username' ? (
              <View style={styles.fieldActions}>
                <TouchableOpacity
                  onPress={() => { setFieldError(null); setEditingField(null); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveUsername} disabled={saving} activeOpacity={0.7}>
                  {saving ? <ActivityIndicator size="small" color="#7EDC5A" /> : (
                    <Text style={styles.saveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setFieldError(null);
                  setEditingField('username');
                  setTimeout(() => usernameRef.current?.focus(), 100);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="edit-2" size={16} color="#A8D4B0" />
              </TouchableOpacity>
            )}
          </View>
          {editingField === 'username' ? (
            <TextInput
              ref={usernameRef}
              style={styles.fieldInput}
              value={usernameVal}
              onChangeText={setUsernameVal}
              placeholder="Choose a username"
              placeholderTextColor="#4A7A5A"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={saveUsername}
            />
          ) : (
            <Text style={[styles.fieldValue, !profile?.username && { color: '#4A7A5A', fontStyle: 'italic' }]}>
              {profile?.username || 'Tap the pencil to add a username'}
            </Text>
          )}
          {editingField === 'username' && fieldError ? <Text style={styles.fieldError}>{fieldError}</Text> : null}
        </View>

        {/* ── BIO card ── */}
        <View style={[styles.fieldCard, styles.bioCard]}>
          <View style={styles.fieldHeader}>
            <Text style={[styles.fieldLabel, styles.bioText]}>BIO</Text>
            {editingField === 'bio' ? (
              <View style={styles.fieldActions}>
                <TouchableOpacity onPress={() => setEditingField(null)} activeOpacity={0.7}>
                  <Text style={[styles.cancelText, styles.bioText]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveBio} disabled={saving} activeOpacity={0.7}>
                  {saving ? <ActivityIndicator size="small" color="#0F2D1C" /> : (
                    <Text style={[styles.saveText, styles.bioText]}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setBioVal(profile?.bio ?? '');
                  setFieldError(null);
                  setEditingField('bio');
                  setTimeout(() => bioRef.current?.focus(), 100);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="edit-2" size={16} color="#0F2D1C" />
              </TouchableOpacity>
            )}
          </View>
          {editingField === 'bio' ? (
            <TextInput
              ref={bioRef}
              style={[styles.fieldInput, styles.bioText, styles.bioFieldInput, { minHeight: 80 }]}
              value={bioVal}
              onChangeText={v => setBioVal(v.slice(0, 200))}
              placeholder="Tell Spud a bit about yourself…"
              placeholderTextColor="#2A6040"
              multiline
              maxLength={200}
            />
          ) : (
            <Text style={[
              styles.fieldValue,
              styles.bioText,
              !profile?.bio && styles.bioPlaceholder,
            ]}>
              {profile?.bio || 'Tap the pencil to add a bio'}
            </Text>
          )}
          {editingField === 'bio' && fieldError ? <Text style={styles.fieldError}>{fieldError}</Text> : null}
        </View>

        {/* ── Spud Buddies ── */}
        <View style={styles.buddiesCard}>
          <View style={styles.buddiesHeader}>
            <View style={styles.buddiesCopy}>
              <Text style={styles.buddiesTitle}>Spud Buddies</Text>
              <Text style={styles.buddiesSubtitle}>Connect with your fellow couch potatoes.</Text>
              <Text style={styles.buddiesDescription}>
                Find your buddies and share what you have watched, what you're watching, and what you will watch next.
              </Text>
            </View>
          </View>
          {buddies.data?.incoming.length ? (
            <Text style={styles.buddiesAlert}>{buddies.data.incoming.length} {buddies.data.incoming.length === 1 ? 'person wants' : 'people want'} to connect</Text>
          ) : null}
          {buddies.data?.accepted.slice(0, 3).map(person => (
            <BuddyRow key={person.userId} person={person}
              onPress={() => router.push({ pathname: '/buddies/[userId]', params: { userId: person.userId } } as any)} />
          ))}
          <TouchableOpacity style={styles.buddiesButton} onPress={() => router.push('/buddies' as any)}
            accessibilityRole="button" accessibilityLabel="Find and manage Spud buddies" testID="open-buddies">
            <Text style={styles.buddiesButtonText}>Find & manage buddies</Text>
            <Feather name="arrow-up-right" size={17} color={buddyColors.background} />
          </TouchableOpacity>
        </View>

        {/* ── Favourite titles ── */}
        {([
          {
            kind: 'tv' as const,
            title: 'My top 3 TV shows of all time',
            items: topTvShows,
            posters: topTvShowPosters,
            hint: 'The shows that set the standard for everything else.',
            addLabel: 'Add your top TV shows',
          },
          {
            kind: 'movie' as const,
            title: 'My top 3 movies of all time',
            items: topMovies,
            posters: topMoviePosters,
            hint: 'The movies that stayed with you long after the credits.',
            addLabel: 'Add your top movies',
          },
        ]).map(section => (
          <View key={section.kind} style={styles.favoriteCard}>
            <View style={styles.favoriteHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.favoriteLabel}>{section.title}</Text>
                <Text style={styles.favoriteHint}>{section.hint}</Text>
              </View>
              <Text style={styles.favoriteCount}>{section.items.length}/3</Text>
            </View>

            {section.items.map((title, index) => (
              <View key={`${title}-${index}`} style={styles.favoriteItem}>
                <TouchableOpacity
                  style={styles.favoritePosterTouch}
                  onPress={() => openFavoriteDetail(section.kind, title, section.posters[index] ?? null)}
                  activeOpacity={0.82}
                  accessibilityLabel={`View details for ${title}`}
                >
                  {section.posters[index] ? (
                    <Image
                      source={{ uri: section.posters[index] as string }}
                      style={styles.favoritePoster}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.favoritePoster, styles.favoritePosterPlaceholder]}>
                      <Feather name="film" size={20} color="#2A6040" />
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={styles.favoriteItemText} numberOfLines={1}>{title}</Text>
                <TouchableOpacity
                  onPress={() => removeFavorite(section.kind, title)}
                  disabled={saving}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={16} color="#A8D4B0" />
                </TouchableOpacity>
              </View>
            ))}

            {section.items.length < 3 && (
              <TouchableOpacity
                style={styles.addFavoritePill}
                onPress={() => openFavoriteEditor(section.kind)}
                activeOpacity={0.85}
              >
                <Feather name="plus" size={16} color="#0F2D1C" />
                <Text style={styles.addFavoriteText}>{section.addLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* ── Legal links ── */}
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => setLegalPage('privacy')} activeOpacity={0.7}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity onPress={() => setLegalPage('terms')} activeOpacity={0.7}>
            <Text style={styles.legalLink}>Terms of Service</Text>
          </TouchableOpacity>
        </View>

        {/* ── Sign out ── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Feather name="log-out" size={16} color="#0F2D1C" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
      )}

      <Modal
        transparent
        visible={favoriteEditor !== null}
        animationType="slide"
        onRequestClose={() => setFavoriteEditor(null)}
      >
        <KeyboardAvoidingView
          style={styles.favoriteModalBackdrop}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => { setFavoriteEditor(null); setFieldError(null); }}
          />
          <View style={[styles.favoriteModalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.favoriteModalTitle}>
              Add a top {favoriteEditor === 'tv' ? 'TV show' : 'movie'}
            </Text>
            <Text style={styles.favoriteModalSubtitle}>
              Search the movie database and choose the poster you want to remember.
            </Text>
            <View style={styles.favoriteSearchRow}>
              <Feather name="search" size={17} color="#A8D4B0" />
              <TextInput
                style={styles.favoriteInput}
                value={favoriteTitle}
                onChangeText={value => {
                  setFavoriteTitle(value);
                  setFavoriteSelection(null);
                  setFieldError(null);
                }}
                placeholder={favoriteEditor === 'tv' ? 'Search TV shows' : 'Search movies'}
                placeholderTextColor="#7E9B85"
                autoFocus
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {favoriteSearchLoading && <ActivityIndicator size="small" color="#7EDC5A" />}
            </View>
            {favoriteSearchError ? <Text style={styles.fieldError}>{favoriteSearchError}</Text> : null}
            {favoriteTitle.trim().length > 0 && !favoriteSearchLoading && !favoriteSearchError && favoriteResults.length === 0 ? (
              <Text style={styles.favoriteNoResults}>No matching posters yet. Try another title.</Text>
            ) : null}
            {favoriteResults.length > 0 && (
              <ScrollView
                style={styles.favoriteResults}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={false}
              >
                {favoriteResults.map(item => {
                  const selected = favoriteSelection?.tmdbId === item.tmdbId;
                  return (
                    <TouchableOpacity
                      key={`${item.type}-${item.tmdbId}`}
                      style={[styles.favoriteResultItem, selected && styles.favoriteResultItemSelected]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setFavoriteSelection(item);
                        setFavoriteTitle(item.title);
                        setFieldError(null);
                      }}
                      activeOpacity={0.8}
                    >
                      {item.posterUrl ? (
                        <Image source={{ uri: item.posterUrl }} style={styles.favoriteResultPoster} resizeMode="cover" />
                      ) : (
                        <View style={[styles.favoriteResultPoster, styles.favoritePosterPlaceholder]}>
                          <Feather name="film" size={16} color="#A8D4B0" />
                        </View>
                      )}
                      <View style={styles.favoriteResultBody}>
                        <Text style={styles.favoriteResultTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.favoriteResultMeta}>
                          {[item.year, item.type === 'movie' ? 'Movie' : 'TV Show'].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <Feather
                        name={selected ? 'check-circle' : 'chevron-right'}
                        size={18}
                        color={selected ? '#7EDC5A' : '#A8D4B0'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            {fieldError && fieldError !== favoriteSearchError ? <Text style={styles.fieldError}>{fieldError}</Text> : null}
            <View style={styles.favoriteModalActions}>
              <TouchableOpacity
                style={styles.favoriteCancelButton}
                onPress={() => { setFavoriteEditor(null); setFieldError(null); }}
                activeOpacity={0.8}
              >
                <Text style={styles.favoriteCancelText}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.favoriteSaveButton, !favoriteSelection && { opacity: 0.45 }]}
                onPress={saveFavorite}
                disabled={saving || !favoriteSelection}
                activeOpacity={0.8}
              >
                {saving ? <ActivityIndicator size="small" color="#0F2D1C" /> : (
                  <Text style={styles.favoriteSaveText}>Add it</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        transparent
        visible={favoriteDetail !== null}
        animationType="slide"
        onRequestClose={() => setFavoriteDetail(null)}
      >
        <View style={styles.favoriteDetailBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setFavoriteDetail(null)}
          />
          <View style={[styles.favoriteDetailSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.favoriteDetailHeader}>
              <Text style={styles.favoriteDetailEyebrow}>
                {favoriteDetail?.type === 'tv' ? 'TV SHOW' : 'MOVIE'}
              </Text>
              <TouchableOpacity
                onPress={() => setFavoriteDetail(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={21} color="#A8D4B0" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.favoriteDetailContent}
            >
              {favoriteDetail?.loading ? (
                <View style={styles.favoriteDetailLoading}>
                  <ActivityIndicator size="large" color="#7EDC5A" />
                  <Text style={styles.favoriteDetailMuted}>Finding title details…</Text>
                </View>
              ) : favoriteDetail?.error ? (
                <View style={styles.favoriteDetailLoading}>
                  <Feather name="alert-circle" size={28} color="#7EDC5A" />
                  <Text style={styles.favoriteDetailError}>{favoriteDetail.error}</Text>
                </View>
              ) : favoriteDetail?.detail ? (
                <>
                  <View style={styles.favoriteDetailHero}>
                    {favoriteDetail.posterUrl ? (
                      <Image
                        source={{ uri: favoriteDetail.posterUrl }}
                        style={styles.favoriteDetailPoster}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.favoriteDetailPoster, styles.favoritePosterPlaceholder]}>
                        <Feather name="film" size={28} color="#2A6040" />
                      </View>
                    )}
                    <View style={styles.favoriteDetailHeroCopy}>
                      <Text style={styles.favoriteDetailTitle}>{favoriteDetail.detail.title}</Text>
                      <Text style={styles.favoriteDetailMeta}>
                        {[
                          favoriteDetail.detail.releaseYear,
                          favoriteDetail.detail.voteAverage
                            ? `★ ${favoriteDetail.detail.voteAverage.toFixed(1)}`
                            : null,
                        ].filter(Boolean).join('  ·  ')}
                      </Text>
                      {favoriteDetail.detail.genres.length > 0 ? (
                        <Text style={styles.favoriteDetailGenres}>
                          {favoriteDetail.detail.genres.slice(0, 3).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {favoriteDetail.detail.overview ? (
                    <View style={styles.favoriteDetailSection}>
                      <Text style={styles.favoriteDetailSectionLabel}>ABOUT</Text>
                      <Text style={styles.favoriteDetailBody}>{favoriteDetail.detail.overview}</Text>
                    </View>
                  ) : null}

                  <View style={styles.favoriteDetailSection}>
                    <Text style={styles.favoriteDetailSectionLabel}>PUBLIC RATING</Text>
                    <Text style={styles.favoritePublicRating}>
                      {favoriteDetail.detail.voteAverage != null
                        ? `${favoriteDetail.detail.voteAverage.toFixed(1)} / 10`
                        : 'Not rated yet'}
                    </Text>
                    <Text style={styles.favoriteDetailMuted}>The Movie Database (TMDB)</Text>
                  </View>

                  <View style={styles.favoriteDetailSection}>
                    <Text style={styles.favoriteDetailSectionLabel}>WHERE TO WATCH</Text>
                    {favoriteDetail.providers?.streaming?.length ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.providerRow}>
                        {dedupeFavoriteProviders(favoriteDetail.providers.streaming).map(provider => (
                          <View key={provider.providerId} style={styles.providerPill}>
                            {provider.logoUrl ? (
                              <Image source={{ uri: provider.logoUrl }} style={styles.providerLogo} resizeMode="cover" />
                            ) : null}
                          </View>
                        ))}
                      </ScrollView>
                    ) : (
                      <Text style={styles.favoriteDetailMuted}>No streaming providers found in the US right now.</Text>
                    )}
                  </View>

                  {favoriteDetail.detail.cast.length > 0 ? (
                    <View style={styles.favoriteDetailSection}>
                      <Text style={styles.favoriteDetailSectionLabel}>CAST</Text>
                      <View style={styles.castList}>
                        {favoriteDetail.detail.cast.slice(0, 6).map(member => (
                          <TouchableOpacity
                            key={`${member.name}-${member.character}`}
                            style={styles.castRow}
                            disabled={!member.personId}
                            onPress={() => member.personId
                              ? Linking.openURL(`https://www.themoviedb.org/person/${member.personId}`).catch(() => {})
                              : undefined}
                            accessibilityRole={member.personId ? 'link' : undefined}
                            accessibilityLabel={member.personId ? `Open ${member.name}'s profile` : member.name}
                          >
                            {member.profileUrl ? (
                              <Image source={{ uri: member.profileUrl }} style={styles.castAvatar} resizeMode="cover" />
                            ) : (
                              <View style={[styles.castAvatar, styles.castAvatarPlaceholder]}>
                                <Feather name="user" size={16} color="#2A6040" />
                              </View>
                            )}
                            <View style={styles.castCopy}>
                              <Text style={styles.castName}>{member.name}</Text>
                              <Text style={styles.castCharacter} numberOfLines={1}>{member.character}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ) : null}

                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={legalPage !== null}
        animationType="slide"
        onRequestClose={() => setLegalPage(null)}
      >
        <View style={styles.legalModal}>
          <View style={[styles.legalModalHeader, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity
              style={styles.legalClose}
              onPress={() => setLegalPage(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Close legal information"
            >
              <Feather name="arrow-left" size={20} color="#D4F5A0" />
            </TouchableOpacity>
            <Text style={styles.legalModalTitle}>
              {legalPage ? LEGAL_CONTENT[legalPage].title : ''}
            </Text>
            <View style={styles.legalHeaderSpacer} />
          </View>
          {legalPage ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.legalContent, { paddingBottom: insets.bottom + 28 }]}
            >
              <Text style={styles.legalUpdated}>Last updated: August 7, 2026</Text>
              <Text style={styles.legalIntro}>{LEGAL_CONTENT[legalPage].intro}</Text>
              {LEGAL_CONTENT[legalPage].sections.map(section => (
                <View key={section.title} style={styles.legalSection}>
                  <Text style={styles.legalSectionTitle}>{section.title}</Text>
                  <Text style={styles.legalBody}>{section.body}</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  buddiesCard: { marginHorizontal: 16, marginTop: 10, marginBottom: 22, backgroundColor: buddyColors.panelLight, borderRadius: 20, padding: 16 },
  buddiesHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  buddiesCopy: { flex: 1, minWidth: 0 },
  buddiesTitle: { color: buddyColors.text, fontSize: 18, fontFamily: 'Manrope_700Bold' },
  buddiesSubtitle: { color: buddyColors.text, fontSize: 13, lineHeight: 19, fontFamily: 'Manrope_500Medium', marginTop: 5 },
  buddiesDescription: { color: buddyColors.muted, fontFamily: 'Manrope_400Regular', fontSize: 13, lineHeight: 19, marginTop: 12 },
  buddiesAlert: { color: buddyColors.background, fontFamily: 'Manrope_700Bold', fontSize: 12, backgroundColor: buddyColors.soft, overflow: 'hidden', borderRadius: 9, padding: 10, marginBottom: 12 },
  buddiesButton: { backgroundColor: buddyColors.lime, borderRadius: 999, minHeight: 45, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 6 },
  buddiesButtonText: { color: buddyColors.background, fontFamily: 'Manrope_700Bold', fontSize: 13 },
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1A4A2A', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontFamily: 'Manrope_700Bold', color: '#ffffff' },

  // Avatar section
  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatarCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: SPUD_AVATAR_BACKGROUND,
    borderWidth: 3, borderColor: '#7EDC5A',
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  initialsText: { fontSize: 38, fontFamily: 'Manrope_700Bold', color: '#7EDC5A' },
  displayName: {
    fontSize: 22, fontFamily: 'Manrope_700Bold', color: '#ffffff', marginBottom: 4,
  },
  emailText: {
    fontSize: 13, fontFamily: 'Manrope_400Regular', color: '#A8D4B0', marginBottom: 4,
  },
  memberText: {
    fontSize: 12, fontFamily: 'Manrope_400Regular', color: '#7EDC5A',
  },
  editPicturePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: '#7EDC5A',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editPictureText: {
    color: '#0F2D1C',
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
  },

  // Avatar grid card
  gridCard: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: '#2A6040', borderRadius: 20, padding: 16,
  },
  gridLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridLabel: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', color: '#0F2D1C',
    letterSpacing: 0.5,
  },
  previewPhoto: {
    width: '100%',
    height: '100%',
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  gridItem: {
    borderRadius: 999,
    backgroundColor: SPUD_AVATAR_BACKGROUND,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  },
  gridItemActive: { backgroundColor: SPUD_AVATAR_BACKGROUND, borderColor: '#7EDC5A' },
  gridImg: { width: '85%', height: '85%' },
  gridCheck: {
    position: 'absolute', bottom: 5, right: 5,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#7EDC5A', alignItems: 'center', justifyContent: 'center',
  },
  photoBtn: {
    borderRadius: 999,
    backgroundColor: '#0F2D1C',
    borderWidth: 2, borderColor: '#7EDC5A', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    gap: 2,
  },
  photoBtnActive: { borderStyle: 'solid', borderColor: '#7EDC5A' },
  photoBtnText: { fontSize: 9, fontFamily: 'Manrope_700Bold', color: '#7EDC5A' },

  // Editable field cards
  fieldCard: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#1A4A2A', borderRadius: 16, padding: 16,
  },
  bioCard: { backgroundColor: '#7EDC5A' },
  fieldHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 11, fontFamily: 'Manrope_700Bold', color: '#A8D4B0', letterSpacing: 0.8,
  },
  fieldActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cancelText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: '#A8D4B0' },
  saveText: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: '#7EDC5A' },
  fieldValue: {
    fontSize: 15, fontFamily: 'Manrope_400Regular', color: '#ffffff', lineHeight: 22,
  },
  fieldInput: {
    fontSize: 15, fontFamily: 'Manrope_400Regular', color: '#ffffff',
    borderBottomWidth: 1, borderBottomColor: '#3A6A4A',
    paddingBottom: 6, lineHeight: 22,
  },
  bioText: { color: '#0F2D1C' },
  bioFieldInput: { borderBottomColor: '#2A6040' },
  bioPlaceholder: { color: '#2A6040', fontStyle: 'italic' },
  fieldError: {
    color: '#FFB4B4',
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
    lineHeight: 17,
    marginTop: 8,
  },

  // Favourite TV and movie lists
  favoriteCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#DAF4AA',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  favoriteLabel: {
    color: '#0F2D1C',
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    letterSpacing: 0.8,
  },
  favoriteHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 2,
  },
  favoriteHint: {
    color: '#2A6040',
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    marginTop: 5,
  },
  favoriteCount: {
    color: '#0F2D1C',
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#DAF4AA',
    borderWidth: 1,
    borderColor: 'rgba(15,45,28,0.12)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  favoritePoster: {
    width: 66,
    height: 96,
    borderRadius: 10,
    backgroundColor: '#D4F5A0',
  },
  favoritePosterTouch: {
    width: 66,
    height: 96,
    borderRadius: 10,
    overflow: 'hidden',
  },
  favoritePosterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteItemText: {
    flex: 1,
    color: '#0F2D1C',
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
  },
  addFavoritePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#7EDC5A',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 2,
  },
  addFavoriteText: {
    color: '#0F2D1C',
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
  },
  avatarSaving: {
    marginTop: 10,
  },

  // Add-title sheet
  favoriteModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  favoriteModalSheet: {
    backgroundColor: '#1A4A2A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: '88%',
    flexShrink: 1,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#7E9B85',
    alignSelf: 'center',
    marginBottom: 20,
  },
  favoriteModalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontFamily: 'Manrope_700Bold',
    marginBottom: 5,
  },
  favoriteModalSubtitle: {
    color: '#A8D4B0',
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    lineHeight: 19,
    marginBottom: 18,
  },
  favoriteSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#7EDC5A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#2A6040',
  },
  favoriteInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Manrope_500Medium',
    padding: 0,
  },
  favoriteNoResults: {
    color: '#A8D4B0',
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    marginTop: 12,
  },
  favoriteResults: {
    maxHeight: 260,
    flexShrink: 1,
    marginTop: 12,
  },
  favoriteResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
    backgroundColor: '#2A6040',
  },
  favoriteResultItemSelected: {
    backgroundColor: '#356E49',
    borderWidth: 1,
    borderColor: '#7EDC5A',
  },
  favoriteResultPoster: {
    width: 42,
    height: 62,
    borderRadius: 7,
    backgroundColor: '#1A4A2A',
  },
  favoriteResultBody: {
    flex: 1,
    gap: 3,
  },
  favoriteResultTitle: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 19,
    fontFamily: 'Manrope_600SemiBold',
  },
  favoriteResultMeta: {
    color: '#A8D4B0',
    fontSize: 11,
    fontFamily: 'Manrope_400Regular',
  },
  favoriteModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  favoriteCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 13,
    backgroundColor: '#2A6040',
  },
  favoriteCancelText: {
    color: '#A8D4B0',
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
  },
  favoriteSaveButton: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 13,
    backgroundColor: '#7EDC5A',
  },
  favoriteSaveText: {
    color: '#0F2D1C',
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
  },
  // Favorite title detail sheet
  favoriteDetailBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  favoriteDetailSheet: {
    maxHeight: '90%',
    backgroundColor: '#0F2D1C',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  favoriteDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  favoriteDetailEyebrow: {
    color: '#7EDC5A',
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: 'Manrope_700Bold',
  },
  favoriteDetailContent: {
    paddingTop: 10,
    paddingBottom: 12,
    gap: 18,
  },
  favoriteDetailLoading: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  favoriteDetailMuted: {
    color: '#A8D4B0',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Manrope_400Regular',
  },
  favoritePublicRating: {
    color: '#D4F5A0',
    fontSize: 21,
    lineHeight: 27,
    fontFamily: 'Manrope_700Bold',
  },
  favoriteDetailError: {
    color: '#FFB4B4',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontFamily: 'Manrope_500Medium',
  },
  favoriteDetailHero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  favoriteDetailPoster: {
    width: 112,
    height: 168,
    borderRadius: 12,
    backgroundColor: '#D4F5A0',
  },
  favoriteDetailHeroCopy: {
    flex: 1,
    paddingTop: 6,
    gap: 8,
  },
  favoriteDetailTitle: {
    color: '#ffffff',
    fontSize: 23,
    lineHeight: 29,
    fontFamily: 'Manrope_700Bold',
  },
  favoriteDetailMeta: {
    color: '#D4F5A0',
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
  },
  favoriteDetailGenres: {
    color: '#A8D4B0',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Manrope_400Regular',
  },
  favoriteDetailSection: {
    gap: 8,
  },
  favoriteDetailSectionLabel: {
    color: '#7EDC5A',
    fontSize: 11,
    letterSpacing: 0.9,
    fontFamily: 'Manrope_700Bold',
  },
  favoriteDetailBody: {
    color: '#E7F2E8',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Manrope_400Regular',
  },
  providerRow: {
    gap: 8,
    paddingRight: 4,
  },
  providerPill: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    backgroundColor: '#2A6040',
    borderRadius: 12,
    padding: 6,
  },
  providerLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  castList: {
    gap: 9,
  },
  castRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  castAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D4F5A0',
  },
  castAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  castCopy: {
    flex: 1,
    gap: 2,
  },
  castName: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Manrope_600SemiBold',
  },
  castCharacter: {
    color: '#A8D4B0',
    fontSize: 11,
    fontFamily: 'Manrope_400Regular',
  },
  // Legal
  legalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, marginBottom: 16, marginTop: 8,
  },
  legalLink: { fontSize: 12, fontFamily: 'Manrope_400Regular', color: '#A8D4B0' },
  legalDot: { fontSize: 12, color: '#4A7A5A' },
  legalModal: { flex: 1, backgroundColor: '#0F2D1C' },
  legalModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A6040',
  },
  legalClose: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A4A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  legalHeaderSpacer: { width: 36, height: 36 },
  legalModalTitle: { color: '#ffffff', fontSize: 18, fontFamily: 'Manrope_700Bold' },
  legalContent: { paddingHorizontal: 20, paddingTop: 18 },
  legalUpdated: { color: '#7EDC5A', fontSize: 12, fontFamily: 'Manrope_600SemiBold', marginBottom: 18 },
  legalIntro: { color: '#E7F2E8', fontSize: 14, lineHeight: 22, fontFamily: 'Manrope_400Regular', marginBottom: 24 },
  legalSection: { gap: 7, marginBottom: 22 },
  legalSectionTitle: { color: '#ffffff', fontSize: 15, lineHeight: 20, fontFamily: 'Manrope_700Bold' },
  legalBody: { color: '#C6DDCA', fontSize: 13, lineHeight: 21, fontFamily: 'Manrope_400Regular' },

  // Sign out
  signOutBtn: {
    marginHorizontal: 16, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#7EDC5A', borderRadius: 32, paddingVertical: 16,
  },
  signOutText: { fontSize: 15, fontFamily: 'Manrope_700Bold', color: '#0F2D1C' },
  state: { flex: 1, alignItems: 'center', paddingHorizontal: 28, gap: 12 },
  stateTitle: { fontSize: 20, fontFamily: 'Manrope_700Bold', color: '#ffffff' },
  stateText: { fontSize: 14, fontFamily: 'Manrope_400Regular', color: '#A8D4B0', textAlign: 'center' },
  retryBtn: {
    marginTop: 6, paddingHorizontal: 20, paddingVertical: 11,
    borderRadius: 999, backgroundColor: '#7EDC5A',
  },
  retryText: { fontSize: 14, fontFamily: 'Manrope_700Bold', color: '#0F2D1C' },
});
