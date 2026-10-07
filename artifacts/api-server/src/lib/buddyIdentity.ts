export type Identity = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  avatarId: string | null;
  avatarUrl: string | null;
};

export function serializeIdentity(profile: Identity) {
  return {
    userId: profile.userId,
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
    username: profile.username ?? null,
    avatarId: profile.avatarId ?? null,
    avatarUrl: profile.avatarUrl ?? null,
  };
}