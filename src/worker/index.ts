import crypto from 'node:crypto';
import process from 'node:process';
import type { PgBoss } from 'pg-boss';
import { getPool } from '../server/db/pool';
import { getFeedForFetch, listEnabledFeedsForFetch, recordFeedFetchResult } from '../server/repositories/feedsRepo';
import { insertArticleIgnoreDuplicate } from '../server/repositories/articlesRepo';
import { getAppSettings } from '../server/repositories/settingsRepo';
import { fetchFeedXml } from '../server/rss/fetchFeedXml';
import { parseFeed } from '../server/rss/parseFeed';
import { sanitizeContent } from '../server/rss/sanitizeContent';
import { isSafeExternalUrl } from '../server/rss/ssrfGuard';
import { fetchFulltextAndStore } from '../server/fulltext/fetchFulltextAndStore';
import { startBoss } from '../server/queue/boss';
import { JOB_ARTICLE_FULLTEXT_FETCH, JOB_FEED_FETCH, JOB_REFRESH_ALL } from '../server/queue/jobs';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildDedupeKey(input: {
  guid: string | null;
  link: string | null;
  title: string;
  publishedAt: Date;
}): string {
  const guid = input.guid?.trim();
  if (guid) return `guid:${guid}`;

  const link = input.link?.trim();
  if (link) return `link:${link}`;

  return `hash:${sha256(`${input.title}|${input.publishedAt.toISOString()}|${input.link ?? ''}`)}`;
}

async function enqueueRefreshAll(boss: PgBoss) {
  const pool = getPool();
  const feeds = await listEnabledFeedsForFetch(pool);
  await Promise.all(feeds.map((feed) => boss.send(JOB_FEED_FETCH, { feedId: feed.id })));
  return { enqueued: feeds.length };
}

async function fetchAndIngestFeed(feedId: string) {
  const pool = getPool();
  const feed = await getFeedForFetch(pool, feedId);
  if (!feed) return { inserted: 0 };

  if (!feed.enabled) return { inserted: 0 };

  if (!(await isSafeExternalUrl(feed.url))) {
    await recordFeedFetchResult(pool, feedId, {
      status: null,
      error: 'Unsafe URL',
    });
    return { inserted: 0 };
  }

  const settings = await getAppSettings(pool);
  const fetchedAt = new Date();

  let status: number | null = null;
  let etag: string | null = null;
  let lastModified: string | null = null;
  let error: string | null = null;
  let inserted = 0;

  try {
    const res = await fetchFeedXml(feed.url, {
      timeoutMs: settings.rssTimeoutMs,
      userAgent: settings.rssUserAgent,
      etag: feed.etag,
      lastModified: feed.lastModified,
    });
    status = res.status;
    etag = res.etag;
    lastModified = res.lastModified;

    if (status === 304 || !res.xml) return { inserted: 0 };

    if (status < 200 || status >= 300) {
      error = `HTTP ${status}`;
      return { inserted: 0 };
    }

    const parsed = await parseFeed(res.xml, fetchedAt);
    for (const item of parsed.items) {
      const baseUrl = item.link ?? parsed.link ?? feed.url;
      const created = await insertArticleIgnoreDuplicate(pool, {
        feedId,
        dedupeKey: buildDedupeKey(item),
        title: item.title || '(untitled)',
        link: item.link,
        author: item.author,
        publishedAt: item.publishedAt.toISOString(),
        contentHtml: sanitizeContent(item.contentHtml, { baseUrl }),
        summary: item.summary,
      });
      if (created) inserted += 1;
    }

    return { inserted };
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
    return { inserted: 0 };
  } finally {
    await recordFeedFetchResult(pool, feedId, {
      status,
      etag,
      lastModified,
      error,
    });
  }
}

async function main() {
  const boss = await startBoss();

  await boss.createQueue(JOB_REFRESH_ALL);
  await boss.createQueue(JOB_FEED_FETCH);
  await boss.createQueue(JOB_ARTICLE_FULLTEXT_FETCH);

  await boss.work(JOB_REFRESH_ALL, async (jobs) => {
    await Promise.all(jobs.map(() => enqueueRefreshAll(boss)));
  });

  await boss.work(JOB_FEED_FETCH, async (jobs) => {
    for (const job of jobs) {
      const feedId =
        typeof job.data === 'object' &&
        job.data !== null &&
        'feedId' in job.data &&
        typeof (job.data as { feedId?: unknown }).feedId === 'string'
          ? (job.data as { feedId: string }).feedId
          : null;

      if (!feedId) throw new Error('Missing feedId');
      await fetchAndIngestFeed(feedId);
    }
  });

  await boss.work(JOB_ARTICLE_FULLTEXT_FETCH, async (jobs) => {
    const pool = getPool();
    for (const job of jobs) {
      const articleId =
        typeof job.data === 'object' &&
        job.data !== null &&
        'articleId' in job.data &&
        typeof (job.data as { articleId?: unknown }).articleId === 'string'
          ? (job.data as { articleId: string }).articleId
          : null;

      if (!articleId) throw new Error('Missing articleId');
      await fetchFulltextAndStore(pool, articleId);
    }
  });

  await boss.schedule(JOB_REFRESH_ALL, '*/5 * * * *');
  await boss.send(JOB_REFRESH_ALL, {});

  const shutdown = async () => {
    await boss.stop();
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
