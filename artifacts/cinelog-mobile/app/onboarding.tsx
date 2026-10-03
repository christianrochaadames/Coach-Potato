import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useAuth } from '@clerk/expo';
import {
  getListEntriesQueryKey,
  useListEntries,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/utils/authFetch';
import { trackEvent } from '@/utils/analytics';
import { QuickLogSheet, TmdbItem } from './(tabs)/search';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? 'couch-potato.replit.app'}`;
const DRAFT_KEY = 'spud_onboarding_draft';

type Pick = TmdbItem;

type Status = 'completed' | 'watching' | 'plan_to_watch';
type SelectedStatuses = Record<number, Status>;

type Draft = {
  stage?: 'meet' | 'picks';
  selectedStatuses?: Record<string, Status>;
  selectedIds?: number[];
};

type ExistingEntry = {
  id?: number;
  tmdbId?: number | null;
  status?: Status;
};

const STATUS_OPTIONS: { key: Status; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'completed', label: 'Watched', icon: 'check-circle' },
  { key: 'watching', label: 'Watching now', icon: 'play-circle' },
  { key: 'plan_to_watch', label: 'Add to watchlist', icon: 'bookmark' },
];

const STATUS_BADGES: Record<Status, string> = {
  completed: 'Watched',
  watching: 'Watching',
  plan_to_watch: 'Watchlist',
};

function getDraftStatuses(draft: Draft): SelectedStatuses {
  if (draft.selectedStatuses) {
    return Object.fromEntries(
      Object.entries(draft.selectedStatuses).filter(([, status]) =>
        STATUS_OPTIONS.some(option => option.key === status),
      ),
    ) as SelectedStatuses;
  }

  return Object.fromEntries((draft.selectedIds ?? []).map(id => [id, 'completed'])) as SelectedStatuses;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const { data: existingEntries } = useListEntries();

  const [stage, setStage] = useState<'meet' | 'picks'>('meet');
  const [items, setItems] = useState<Pick[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<SelectedStatuses>({});
  const [draftStatuses, setDraftStatuses] = useState<SelectedStatuses>({});
  const [statusesHydrated, setStatusesHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [sheetItem, setSheetItem] = useState<Pick | null>(null);
  const [skipConfirmationVisible, setSkipConfirmationVisible] = useState(false);
  const refreshSeenIds = useRef<Set<string>>(new Set());

  const saveDraft = useCallback(async (nextStage: 'meet' | 'picks', statuses: SelectedStatuses) => {
    const draft: Draft = { stage: nextStage, selectedStatuses: statuses };
    try {
      await SecureStore.setItemAsync(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // SecureStore can be unavailable on web previews. The server completion
      // flag remains authoritative; this persistence is for interrupted mobile
      // onboarding only.
    }
  }, []);

  const markOnboardingComplete = useCallback(async () => {
    const response = await authFetch(`${API}/api/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingCompleted: true }),
    });
    if (!response.ok) throw new Error('Could not finish onboarding');
  }, []);

  const finish = useCallback(async () => {
    setSaving(true);
    setSelectionError(null);
    try {
      await markOnboardingComplete();
      await SecureStore.deleteItemAsync(DRAFT_KEY).catch(() => {});
      queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
      trackEvent('onboarding_skipped');
      router.replace('/(tabs)' as any);
    } catch {
      setSelectionError('We could not finish setting up your library. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [markOnboardingComplete, queryClient, router]);

  const loadPicks = useCallback(async (draft: Draft) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [profileResponse, picksResponse] = await Promise.all([
        authFetch(`${API}/api/profile`),
        authFetch(`${API}/api/tmdb/top-rated`),
      ]);

      if (profileResponse.ok) {
        const profile = await profileResponse.json().catch(() => ({}));
        if (profile?.onboardingCompleted === true) {
          router.replace('/(tabs)' as any);
          return;
        }
      }
      if (!picksResponse.ok) throw new Error('Picks unavailable');

       const payload = await picksResponse.json();
       const nextItems = (payload.items ?? []).slice(0, 16) as Pick[];
       refreshSeenIds.current = new Set(nextItems.map(item => `${item.type}-${item.tmdbId}`));
      setItems(nextItems);
      const restored = getDraftStatuses(draft);
      setDraftStatuses(restored);
      setSelectedStatuses(restored);
      setStatusesHydrated(false);
    } catch {
      setLoadError('We could not load Spud’s picks. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const refreshPicks = useCallback(async () => {
    if (loading || refreshing) return;
    setRefreshing(true);
    setLoadError(null);
    try {
      const response = await authFetch(`${API}/api/tmdb/onboarding-pool`);
      if (!response.ok) throw new Error('Fresh picks unavailable');

      const payload = await response.json();
      const currentIds = new Set(items.map(item => `${item.type}-${item.tmdbId}`));
      const candidates = (payload.items ?? []) as Pick[];
      let seen = refreshSeenIds.current;
      let freshItems = candidates.filter(candidate => {
        const key = `${candidate.type}-${candidate.tmdbId}`;
        return Boolean(candidate.posterUrl) && !currentIds.has(key) && !seen.has(key);
      }).slice(0, 16);

      // Once the whole pool has been shown, start a new cycle without
      // immediately repeating the cards currently on screen.
      if (freshItems.length < 16) {
        seen = new Set(currentIds);
        refreshSeenIds.current = seen;
        freshItems = candidates.filter(candidate => {
          const key = `${candidate.type}-${candidate.tmdbId}`;
          return Boolean(candidate.posterUrl) && !currentIds.has(key) && !seen.has(key);
        }).slice(0, 16);
      }

      if (freshItems.length < 16) throw new Error('Not enough fresh picks');
      freshItems.forEach(item => seen.add(`${item.type}-${item.tmdbId}`));
      setItems(freshItems.slice(0, 16));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setLoadError('We could not find fresh picks right now. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [items, loading, refreshing]);

  useEffect(() => {
    let active = true;
    (async () => {
      let draft: Draft = {};
      try {
        const raw = await SecureStore.getItemAsync(DRAFT_KEY);
        if (raw) draft = JSON.parse(raw) as Draft;
      } catch {
        draft = {};
      }
      if (!active) return;
      const nextStage = draft.stage === 'picks' ? 'picks' : 'meet';
      setStage(nextStage);
      if (nextStage === 'picks') void loadPicks(draft);
    })();
    return () => { active = false; };
  }, [loadPicks]);

  useEffect(() => {
    if (stage !== 'picks' || items.length === 0 || !existingEntries || statusesHydrated) return;

    const serverStatuses = Object.fromEntries(
      (existingEntries as ExistingEntry[])
        .filter(entry => entry.tmdbId != null && entry.status)
        .map(entry => [entry.tmdbId as number, entry.status as Status]),
    ) as SelectedStatuses;
    const itemIds = new Set(items.map(item => item.tmdbId));
    const merged = Object.fromEntries(
      Object.entries({ ...serverStatuses, ...draftStatuses })
        .filter(([id]) => itemIds.has(Number(id))),
    ) as SelectedStatuses;
    setSelectedStatuses(merged);
    setStatusesHydrated(true);
    void saveDraft('picks', merged);
  }, [draftStatuses, existingEntries, items, saveDraft, stage, statusesHydrated]);

  const goToPicks = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStage('picks');
    await saveDraft('picks', selectedStatuses);
    void loadPicks({ stage: 'picks', selectedStatuses });
  };

  const handleContinue = async () => {
    if (saving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (selectedCount === 0) {
      setSkipConfirmationVisible(true);
      return;
    }
    setSaving(true);
    setSelectionError(null);
    try {
      await markOnboardingComplete();
      await SecureStore.deleteItemAsync(DRAFT_KEY).catch(() => {});
      queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
      queryClient.invalidateQueries();
      trackEvent('onboarding_completed', { selected_count: selectedCount });
      router.replace('/(tabs)' as any);
    } catch {
      setSelectionError('We could not save your picks. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSkipConfirmationVisible(true);
  };

  const confirmSkip = async () => {
    setSkipConfirmationVisible(false);
    await finish();
  };

  const selectedCount = useMemo(
    () => Object.keys(selectedStatuses).length,
    [selectedStatuses],
  );
  const posterWidth = Math.max(1, (width - 40 - 24) / 4);
  const compactMeet = height < 760;
  const currentSheetStatus = sheetItem ? selectedStatuses[sheetItem.tmdbId] : undefined;
  const currentSheetEntry = sheetItem
    ? (existingEntries as ExistingEntry[] | undefined)?.find(entry => entry.tmdbId === sheetItem.tmdbId)
    : undefined;
  const isBusy = saving || loading || refreshing;

  const handleSheetSaved = (status?: Status) => {
    if (sheetItem && status) {
      const nextStatuses = { ...selectedStatuses, [sheetItem.tmdbId]: status };
      setSelectedStatuses(nextStatuses);
      void saveDraft('picks', nextStatuses);
    }
    setSelectionError(null);
    setSheetItem(null);
  };

  const handleSheetDeleted = () => {
    if (!sheetItem) return;
    const nextStatuses = { ...selectedStatuses };
    delete nextStatuses[sheetItem.tmdbId];
    setSelectedStatuses(nextStatuses);
    void saveDraft('picks', nextStatuses);
    setSheetItem(null);
  };

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/landing" />;

  if (stage === 'meet') {
    return (
      <View style={[styles.meetRoot, { paddingTop: topInset + 12, paddingBottom: bottomInset + 16 }]}>
        <View style={styles.meetCard}>
          <ScrollView
            style={styles.meetScroll}
            contentContainerStyle={[
              styles.meetScrollContent,
              compactMeet && styles.meetScrollContentCompact,
            ]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Image source={require('@/assets/images/spud-logo.png')} style={styles.logo} resizeMode="contain" />
            <View style={styles.meetIntroRow}>
              <View style={styles.meetHeading}>
                <Text style={[styles.meetTitle, compactMeet && styles.meetTitleCompact]}>Welcome</Text>
                <Text style={[styles.meetSubtitle, compactMeet && styles.meetSubtitleCompact]}>
                  I’m Spud, the couch potato.
                </Text>
              </View>
              <Image
                source={require('@/assets/images/spud-welcome-heart.png')}
                style={[styles.meetMascot, compactMeet && styles.meetMascotCompact]}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.meetBody, compactMeet && styles.meetBodyCompact]}>
              Think of me as your personal TV and movie sidekick. I’m here to help you remember everything you have watched, keep track of what you have been watching, and give you some great recommendations for what to watch next.
            </Text>
          </ScrollView>
          <View style={styles.meetBottom}>
            <Pressable
              style={({ pressed }) => [styles.greenButton, pressed && styles.pressed]}
              onPress={goToPicks}
              testID="onboarding-meet-button"
              accessibilityRole="button"
            >
              <Text style={styles.greenButtonText}>Let’s get comfy</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.picksRoot, { paddingTop: topInset + 12 }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomInset + 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.picksHeader}>
           <Image source={require('@/assets/images/spud-logo.png')} style={styles.smallLogo} resizeMode="contain" />
           <Text style={styles.picksTitle}>A quick taste check</Text>
          <Text style={styles.picksBody}>
            Tell me what you’ve watched, what you’re watching now and what’s waiting on your watchlist. This is just a
            quick way for us to get to know each other. You can always add more TV shows and movies to your collection
            later.
          </Text>
        </View>

         <View style={styles.posterTools}>
           <Pressable
             onPress={() => void refreshPicks()}
             disabled={isBusy}
             style={({ pressed }) => [
               styles.refreshButton,
               pressed && !isBusy && styles.pressed,
             ]}
             accessibilityRole="button"
             accessibilityLabel="View more recommendations"
             testID="onboarding-refresh"
           >
             {refreshing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
             ) : (
                <Feather name="refresh-cw" size={17} color="#FFFFFF" />
             )}
              <Text style={styles.refreshButtonText}>View more</Text>
           </Pressable>
         </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#116149" />
            <Text style={styles.mutedText}>Finding some good company…</Text>
          </View>
        ) : loadError ? (
          <View style={styles.errorState}>
            <Feather name="wifi-off" size={28} color="#116149" />
            <Text style={styles.errorText}>{loadError}</Text>
            <Pressable
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              onPress={() => void loadPicks({ stage: 'picks', selectedStatuses })}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map(item => {
              const status = selectedStatuses[item.tmdbId];
              return (
                <Pressable
                  key={`${item.type}-${item.tmdbId}`}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSheetItem(item);
                  }}
                  style={({ pressed }) => [
                    styles.poster,
                    { width: posterWidth, height: posterWidth * 1.5 },
                    status && styles.posterSelected,
                    pressed && styles.posterPressed,
                  ]}
                  testID={`onboarding-title-${item.tmdbId}`}
                >
                  {item.posterUrl ? (
                    <ExpoImage
                      source={item.posterUrl}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={120}
                    />
                  ) : (
                    <View style={styles.posterFallback}>
                      <Text style={styles.posterFallbackText}>{item.title}</Text>
                    </View>
                  )}
                  {status ? (
                    <View style={styles.statusBadge}>
                      <Feather
                        name={status === 'completed' ? 'check' : status === 'watching' ? 'play' : 'bookmark'}
                        size={10}
                        color="#116149"
                      />
                      <Text style={styles.statusBadgeText}>{STATUS_BADGES[status]}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.footer}>
          {selectionError ? <Text style={styles.selectionError}>{selectionError}</Text> : null}
          <Pressable
            onPress={() => void handleContinue()}
            disabled={saving}
            style={({ pressed }) => [
              styles.continueButton,
              saving && styles.disabled,
              pressed && !saving && styles.pressed,
            ]}
            testID="onboarding-work-magic"
          >
             {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.continueText}>Continue</Text>}
          </Pressable>
          <Pressable
            onPress={handleSkip}
            disabled={isBusy}
            style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
            testID="onboarding-skip"
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </View>
      </ScrollView>

       <QuickLogSheet
         item={sheetItem}
         visible={sheetItem !== null}
         onClose={() => setSheetItem(null)}
         onSaved={handleSheetSaved}
         onDeleted={handleSheetDeleted}
         insets={insets}
         initialStatus={currentSheetStatus ?? null}
         entryId={currentSheetEntry?.id ?? null}
         canDelete={Boolean(currentSheetEntry?.id)}
         showProviders={false}
         showRecommendations={false}
          source="onboarding"
       />

      <Modal
        visible={skipConfirmationVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSkipConfirmationVisible(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Leaving Spud to guess?</Text>
            <Text style={styles.confirmBody}>
              You can skip this, but your first recommendations may be a little generic until I get to know your taste.
            </Text>
            <Pressable
              onPress={() => setSkipConfirmationVisible(false)}
              style={({ pressed }) => [styles.keepPickingButton, pressed && styles.pressed]}
            >
              <Text style={styles.keepPickingText}>Keep picking</Text>
            </Pressable>
            <Pressable
              onPress={() => void confirmSkip()}
              style={({ pressed }) => [styles.skipConfirmButton, pressed && styles.pressed]}
            >
              <Text style={styles.skipConfirmText}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  meetRoot: { flex: 1, backgroundColor: '#0F2D1C', paddingHorizontal: 12 },
  meetCard: {
    flex: 1, borderRadius: 28, overflow: 'hidden', backgroundColor: '#D4F5A0',
    paddingHorizontal: 22, paddingTop: 18,
  },
  meetScroll: { flex: 1 },
  meetScrollContent: { paddingBottom: 18 },
  meetScrollContentCompact: { paddingBottom: 10 },
  logo: { width: 178, height: 88, marginLeft: 4, marginBottom: 4 },
  meetIntroRow: {
    minHeight: 176, flexDirection: 'row', alignItems: 'center',
    marginLeft: 18, marginRight: -8,
  },
  meetHeading: { flex: 1, zIndex: 1 },
  meetMascot: { width: 142, height: 188, marginLeft: -12 },
  meetMascotCompact: { width: 124, height: 158 },
  meetTitle: { color: '#116149', fontSize: 38, lineHeight: 44, fontFamily: 'Manrope_700Bold' },
  meetTitleCompact: { fontSize: 34, lineHeight: 40 },
  meetSubtitle: { color: '#116149', fontSize: 21, lineHeight: 28, fontFamily: 'Manrope_700Bold', marginTop: 4 },
  meetSubtitleCompact: { fontSize: 18, lineHeight: 24 },
  meetBody: {
    color: '#2D6A4F', fontSize: 15, lineHeight: 22, fontFamily: 'Manrope_500Medium',
    marginTop: 4, marginLeft: 18, marginRight: 12,
  },
  meetBodyCompact: { fontSize: 14, lineHeight: 20 },
  meetBottom: {
    justifyContent: 'center', alignItems: 'stretch',
    paddingTop: 12, paddingBottom: 16,
    backgroundColor: '#D4F5A0',
  },
  greenButton: {
    flexDirection: 'row', alignItems: 'center',
    minHeight: 54, justifyContent: 'center',
    borderRadius: 999, backgroundColor: '#0F2D1C', paddingHorizontal: 22, paddingVertical: 13,
  },
  greenButtonText: { color: '#D4F5A0', fontSize: 14, fontFamily: 'Manrope_700Bold' },
  picksRoot: { flex: 1, backgroundColor: '#FFF3E8' },
  picksHeader: { paddingHorizontal: 20, paddingBottom: 15 },
  smallLogo: { width: 143, height: 83, alignSelf: 'flex-start', marginBottom: 13 },
  eyebrow: { color: '#116149', fontSize: 11, letterSpacing: 1.3, fontFamily: 'Manrope_700Bold', marginBottom: 5 },
  picksTitle: { color: '#111111', fontSize: 25, lineHeight: 31, fontFamily: 'Manrope_700Bold' },
  picksBody: { color: '#7E7A73', fontSize: 14, lineHeight: 20, fontFamily: 'Manrope_400Regular', marginTop: 6 },
  instruction: { color: '#116149', fontSize: 14, fontFamily: 'Manrope_700Bold', marginTop: 12 },
  inlineOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  inlineOption: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F4EA',
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5,
  },
  inlineOptionText: { color: '#116149', fontSize: 10, fontFamily: 'Manrope_700Bold' },
  posterTools: { alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 9 },
  refreshButton: {
    minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 999, paddingHorizontal: 12, backgroundColor: '#FF4BAE',
  },
  refreshButtonText: { color: '#FFFFFF', fontSize: 12, fontFamily: 'Manrope_700Bold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  poster: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#EFE4D2' },
  posterSelected: { borderWidth: 2, borderColor: '#116149' },
  posterPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  statusBadge: {
    position: 'absolute', left: 5, top: 5, flexDirection: 'row', alignItems: 'center', gap: 3,
    maxWidth: '88%', borderRadius: 999, backgroundColor: 'rgba(255,243,232,0.94)',
    paddingHorizontal: 6, paddingVertical: 4,
  },
  statusBadgeText: { color: '#116149', fontSize: 8, fontFamily: 'Manrope_700Bold' },
  posterFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 6 },
  posterFallbackText: { color: '#116149', textAlign: 'center', fontSize: 11, fontFamily: 'Manrope_700Bold' },
  loadingState: { minHeight: 420, alignItems: 'center', justifyContent: 'center', gap: 12 },
  mutedText: { color: '#7E7A73', fontSize: 14, fontFamily: 'Manrope_400Regular' },
  errorState: { minHeight: 360, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  errorText: { color: '#116149', textAlign: 'center', fontSize: 14, lineHeight: 20, fontFamily: 'Manrope_500Medium' },
  retryButton: { backgroundColor: '#D4F5A0', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11 },
  retryButtonText: { color: '#116149', fontSize: 14, fontFamily: 'Manrope_700Bold' },
  footer: { paddingHorizontal: 20, paddingTop: 18, gap: 10 },
  selectionError: { color: '#A04A4A', textAlign: 'center', fontSize: 12, lineHeight: 17, fontFamily: 'Manrope_600SemiBold' },
  continueButton: {
    minHeight: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#6B46C1', paddingHorizontal: 20,
  },
  continueText: { color: '#ffffff', fontSize: 15, fontFamily: 'Manrope_700Bold' },
  disabled: { backgroundColor: '#5B3FA5' },
  skipButton: { alignItems: 'center', paddingVertical: 7 },
  skipText: { color: '#7E7A73', fontSize: 14, fontFamily: 'Manrope_600SemiBold' },
  pressed: { opacity: 0.78 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,17,17,0.34)', justifyContent: 'flex-end' },
  actionSheet: {
    backgroundColor: '#FFF3E8', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 10,
  },
  sheetHandle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 999, backgroundColor: '#D4C9BC', marginBottom: 18 },
  sheetEyebrow: { color: '#116149', fontSize: 10, letterSpacing: 1.2, fontFamily: 'Manrope_700Bold' },
  sheetTitle: { color: '#111111', fontSize: 23, lineHeight: 29, fontFamily: 'Manrope_700Bold', marginTop: 5 },
  sheetSubtitle: { color: '#7E7A73', fontSize: 14, fontFamily: 'Manrope_400Regular', marginTop: 4, marginBottom: 16 },
  sheetOptions: { gap: 9 },
  sheetOption: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 999,
    borderWidth: 1, borderColor: '#E2D9CE', backgroundColor: '#ffffff', paddingHorizontal: 17,
  },
  sheetOptionActive: { backgroundColor: '#9BD6FF', borderColor: '#9BD6FF' },
  sheetOptionText: { flex: 1, color: '#116149', fontSize: 15, fontFamily: 'Manrope_700Bold' },
  sheetOptionTextActive: { color: '#111111' },
  removeSelection: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 14 },
  removeSelectionText: { color: '#7E7A73', fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
  confirmBackdrop: {
    flex: 1, backgroundColor: 'rgba(17,17,17,0.42)', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  confirmCard: { width: '100%', maxWidth: 360, borderRadius: 24, backgroundColor: '#FFF3E8', padding: 24 },
  confirmTitle: { color: '#111111', fontSize: 24, lineHeight: 30, fontFamily: 'Manrope_700Bold' },
  confirmBody: { color: '#7E7A73', fontSize: 14, lineHeight: 21, fontFamily: 'Manrope_400Regular', marginTop: 10, marginBottom: 20 },
  keepPickingButton: { minHeight: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6B46C1' },
  keepPickingText: { color: '#ffffff', fontSize: 15, fontFamily: 'Manrope_700Bold' },
  skipConfirmButton: { minHeight: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  skipConfirmText: { color: '#7E7A73', fontSize: 14, fontFamily: 'Manrope_700Bold' },
});