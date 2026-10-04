import type { ImageSourcePropType } from 'react-native';

export const SPUD_AVATAR_BACKGROUND = '#D4F5A0';

export const SPUD_AVATARS: ReadonlyArray<{
  id: string;
  source: ImageSourcePropType;
}> = [
  { id: '8', source: require('@/assets/images/spud-avatar-remote-chair.png') },
  { id: '5', source: require('@/assets/images/spud-avatar-laughing.png') },
  { id: '6', source: require('@/assets/images/spud-avatar-heart.png') },
  { id: '7', source: require('@/assets/images/spud-avatar-cheering.png') },
  { id: '9', source: require('@/assets/images/spud-avatar-obsessed.png') },
  { id: '10', source: require('@/assets/images/spud-avatar-pizza-chair.png') },
  { id: '4', source: require('@/assets/images/spud-avatar-sleepy.png') },
  { id: '11', source: require('@/assets/images/spud-avatar-angry-pastel.png') },
  { id: '12', source: require('@/assets/images/spud-avatar-sad-pastel.png') },
  { id: '13', source: require('@/assets/images/spud-avatar-double-peace.png') },
  { id: '14', source: require('@/assets/images/spud-avatar-thumbs-up.png') },
];

export const SPUD_AVATAR_MAP: Record<string, ImageSourcePropType> = Object.fromEntries(
  SPUD_AVATARS.map(avatar => [avatar.id, avatar.source]),
);

export function resolveSpudAvatar(avatarId: string | null | undefined): ImageSourcePropType | null {
  if (!avatarId) return null;

  const directMatch = SPUD_AVATAR_MAP[avatarId];
  if (directMatch) return directMatch;

  // Profiles that still hold an old mascot ID should immediately display one
  // of the new illustrations instead of retaining or breaking on old artwork.
  const legacyId = Number(avatarId);
  if (!Number.isInteger(legacyId) || legacyId < 2) return null;
  return SPUD_AVATARS[(legacyId - 2) % SPUD_AVATARS.length]?.source ?? null;
}