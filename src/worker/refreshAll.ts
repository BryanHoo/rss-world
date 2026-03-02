import { isFeedDue } from './rssScheduler';

export interface RefreshAllFeedRow {
  id: string;
  fetchIntervalMinutes: number;
  lastFetchedAt: string | null;
}

export function selectFeedsForRefreshAll(
  feeds: RefreshAllFeedRow[],
  now: Date,
  input: { force: boolean },
): RefreshAllFeedRow[] {
  if (input.force) return feeds;

  return feeds.filter((feed) =>
    isFeedDue(
      { lastFetchedAt: feed.lastFetchedAt, fetchIntervalMinutes: feed.fetchIntervalMinutes },
      now,
    ),
  );
}

export function buildFeedFetchJobData(
  feedId: string,
  input: { force: boolean },
): { feedId: string; force?: true } {
  if (!input.force) return { feedId };
  return { feedId, force: true };
}

