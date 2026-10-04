export const LEGACY_PENDING_PROFILE_KEY = 'pendingProfile';
export const PENDING_PROFILE_KEY = 'pendingProfile.v2';

export type PendingProfile = {
  firstName?: string;
  lastName?: string;
  username?: string;
};

export type PendingProfileStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

type PendingProfileRecord = {
  userId: string;
  profile: PendingProfile;
};

type ProfilePatchResponse = { ok: boolean };

type SyncPendingProfileOptions = {
  storage: PendingProfileStorage;
  userId: string | null;
  isCurrentIdentity: () => boolean;
  getToken: () => Promise<string | null>;
  patchProfile: (
    profile: PendingProfile,
    token: string,
  ) => Promise<ProfilePatchResponse>;
  waitBeforeRetry?: () => Promise<void>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRecord(raw: string): PendingProfileRecord | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isObject(value) || typeof value.userId !== 'string' || !value.userId || !isObject(value.profile)) {
      return null;
    }

    const profile: PendingProfile = {};
    for (const field of ['firstName', 'lastName', 'username'] as const) {
      const fieldValue = value.profile[field];
      if (typeof fieldValue === 'string' && fieldValue.length > 0) {
        profile[field] = fieldValue;
      }
    }
    if (Object.keys(profile).length === 0) return null;
    return { userId: value.userId, profile };
  } catch {
    return null;
  }
}

export async function savePendingProfile(
  storage: PendingProfileStorage,
  userId: string,
  profile: PendingProfile,
): Promise<void> {
  if (!userId || Object.keys(profile).length === 0) return;
  const record: PendingProfileRecord = { userId, profile };
  await storage.setItemAsync(PENDING_PROFILE_KEY, JSON.stringify(record));
}

async function deleteIfUnchanged(
  storage: PendingProfileStorage,
  key: string,
  expectedValue: string,
  isCurrentIdentity: () => boolean,
): Promise<void> {
  const latestValue = await storage.getItemAsync(key);
  if (isCurrentIdentity() && latestValue === expectedValue) {
    await storage.deleteItemAsync(key);
  }
}

export async function syncPendingProfile({
  storage,
  userId,
  isCurrentIdentity,
  getToken,
  patchProfile,
  waitBeforeRetry = () => new Promise((resolve) => setTimeout(resolve, 800)),
}: SyncPendingProfileOptions): Promise<void> {
  // The old key held unbound profile data. It must never be attributed to a
  // session, including when an existing account signs in after an abandoned
  // signup.
  await storage.deleteItemAsync(LEGACY_PENDING_PROFILE_KEY);

  if (!userId || !isCurrentIdentity()) return;

  const raw = await storage.getItemAsync(PENDING_PROFILE_KEY);
  if (!raw || !isCurrentIdentity()) return;

  const record = parseRecord(raw);
  if (!record || record.userId !== userId) {
    await deleteIfUnchanged(storage, PENDING_PROFILE_KEY, raw, isCurrentIdentity);
    return;
  }

  const token = await getToken();
  if (!token || !isCurrentIdentity()) return;

  // A profile PATCH is idempotent, so a single short retry handles transient
  // failures while leaving the stored record available for a later login too.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: ProfilePatchResponse | null = null;
    try {
      response = await patchProfile(record.profile, token);
    } catch {
      // Keep the pending profile and make the bounded retry below.
    }

    if (!isCurrentIdentity()) return;
    if (response?.ok) {
      await deleteIfUnchanged(storage, PENDING_PROFILE_KEY, raw, isCurrentIdentity);
      return;
    }
    if (attempt === 0) {
      await waitBeforeRetry();
      if (!isCurrentIdentity()) return;
    }
  }
}