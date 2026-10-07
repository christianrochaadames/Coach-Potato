export function summariseRatings(buckets: Array<{ stars: number; count: number }>) {
  const counts = new Map(buckets.filter(b => Number.isInteger(b.stars) && b.stars >= 1 && b.stars <= 5)
    .map(b => [b.stars, Math.max(0, Number(b.count))]));
  const count = [...counts.values()].reduce((a, b) => a + b, 0);
  const sum = [...counts].reduce((a, [stars, n]) => a + stars * n, 0);
  return {
    average: count ? Math.round(sum / count * 100) / 100 : null,
    count,
    distribution: [5, 4, 3, 2, 1].map(stars => ({
      stars, count: counts.get(stars) ?? 0,
      percentage: count ? (counts.get(stars) ?? 0) / count * 100 : 0,
    })),
  };
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
