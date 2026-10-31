export const TITLE_SHARE_SUBTITLE = 'Spud [TV show and movie tracker]';

/** Public title information only; never include personal watch history or notes. */
export function buildTitleSharePayload(title: {
  title: string; year?: number | null; shareUrl: string; posterUrl?: string | null;
}) {
  const label = `${title.title}${title.year ? ` (${title.year})` : ''}`;
  const heading = `Check out ${label} on Spud`;
  return {
    heading,
    subtitle: TITLE_SHARE_SUBTITLE,
    url: title.shareUrl,
    posterUrl: title.posterUrl ?? null,
    message: `${heading}\n${title.shareUrl}`,
  };
}
