/** Never uncover Expo Router's temporary index/redirect screen. */
export function canRevealStartup(
  authLoaded: boolean,
  splashElapsed: boolean,
  segments: readonly string[],
): boolean {
  return authLoaded && splashElapsed && segments.length > 0 && segments[0] !== 'index';
}
