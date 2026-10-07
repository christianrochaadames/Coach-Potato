import PostHog from 'posthog-react-native';

export type MobileAnalyticsEvent =
  | 'onboarding_completed'
  | 'onboarding_skipped'
  | 'profile_updated'
  | 'avatar_updated'
  | 'title_detail_viewed'
  | 'entry_created'
  | 'recommendation_skipped'
  | 'watchlist_item_started'
  | 'title_completed'
  | 'watchlist_item_removed'
  | 'rating_saved'
  | 'season_progress_saved'
  | 'season_completed'
  | 'entry_deleted';

type AnalyticsValue = string | number | boolean;
type AnalyticsProperties = Record<string, AnalyticsValue | null | undefined>;

const ALLOWED_PROPERTY_KEYS = new Set([
  'app_platform',
  'build_environment',
  'cleared',
  'field',
  'in_collection',
  'media_type',
  'rating',
  'selected_count',
  'signal',
  'source',
  'status',
]);

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim();
const configuredHost = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || '';
const host =
  configuredHost === 'US Cloud' || configuredHost.toLowerCase() === 'us'
    ? 'https://us.i.posthog.com'
    : configuredHost === 'EU Cloud' || configuredHost.toLowerCase() === 'eu'
      ? 'https://eu.i.posthog.com'
      : configuredHost || 'https://us.i.posthog.com';

const client = apiKey
  ? new PostHog(apiKey, {
      host,
      captureAppLifecycleEvents: false,
      customAppProperties: (properties) => ({
        $app_build: properties.$app_build,
        $app_name: 'Spud',
        $app_version: properties.$app_version,
        $os_name: properties.$os_name,
        $os_version: properties.$os_version,
      }),
      disableGeoip: true,
      disableRemoteConfig: true,
      disableSurveys: true,
      enableSessionReplay: false,
      preloadFeatureFlags: false,
      sendFeatureFlagEvent: false,
      setDefaultPersonProperties: false,
    })
  : null;

/**
 * Records a deliberately small, anonymous product event.
 *
 * Property names are allow-listed so names, emails, notes, title names,
 * searches, account IDs, and media IDs cannot be added accidentally.
 */
export function trackEvent(
  event: MobileAnalyticsEvent,
  properties: AnalyticsProperties = {},
): void {
  if (!client) return;

  const safeProperties: Record<string, AnalyticsValue> = {
    app_platform: 'mobile',
    build_environment: __DEV__ ? 'development' : 'production',
  };

  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) continue;
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      continue;
    }
    safeProperties[key] = value;
  }

  try {
    client.capture(event, safeProperties);
  } catch {
    // Analytics must never interrupt the app's primary behavior.
  }
}

export async function flushAnalytics(): Promise<void> {
  if (!client) return;
  try {
    await client.flush();
  } catch {
    // Analytics delivery is best-effort.
  }
}