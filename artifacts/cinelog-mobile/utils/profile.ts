export const getMobileProfileQueryKey = (userId: string | null | undefined) =>
  ['mobile-profile', userId] as const;