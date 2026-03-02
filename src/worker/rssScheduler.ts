export function isFeedDue(
  input: { lastFetchedAt: string | null; fetchIntervalMinutes: number },
  now: Date,
): boolean {
  if (input.fetchIntervalMinutes <= 0) return true;
  if (!input.lastFetchedAt) return true;

  const lastFetchedAt = new Date(input.lastFetchedAt);
  if (Number.isNaN(lastFetchedAt.getTime())) return true;

  return now.getTime() >= lastFetchedAt.getTime() + input.fetchIntervalMinutes * 60 * 1000;
}

