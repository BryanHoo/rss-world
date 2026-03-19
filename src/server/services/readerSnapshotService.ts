import type { Pool } from 'pg';
import { normalizePersistedSettings } from '../../features/settings/settingsSchema';
import { AI_DIGEST_VIEW_ID, isRssSmartView } from '../../lib/view';
import { getServerEnv } from '../env';
import { buildImageProxyUrl, getOptionalImageProxySecret } from '../media/imageProxyUrl';
import { evaluateArticleBodyTranslationEligibility } from '../ai/articleTranslationEligibility';
import { listCategories } from '../repositories/categoriesRepo';
import { listFeeds } from '../repositories/feedsRepo';
import { getUiSettings } from '../repositories/settingsRepo';
import {
  getArticleKeywordsForFeed,
  matchesArticleKeywordFilter,
} from './articleKeywordFilter';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface CursorPayload {
  publishedAt: string;
  id: string;
}

export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | null | undefined): CursorPayload | null {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as Partial<CursorPayload>;
    if (!parsed || typeof parsed.publishedAt !== 'string' || typeof parsed.id !== 'string') {
      return null;
    }
    return { publishedAt: parsed.publishedAt, id: parsed.id };
  } catch {
    return null;
  }
}

export function buildArticleFilter(input: {
  view: string;
  cursor?: string | null;
  limit?: number;
}): { whereSql: string; params: unknown[]; limit: number } {
  const whereParts: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (input.view === AI_DIGEST_VIEW_ID) {
    whereParts.push("feed_id in (select id from feeds where kind = 'ai_digest')");
  } else if (input.view === 'unread') {
    whereParts.push('is_read = false');
  } else if (input.view === 'starred') {
    whereParts.push('is_starred = true');
  } else if (input.view !== 'all') {
    whereParts.push(`feed_id = $${paramIndex++}`);
    params.push(input.view);
  }

  if (isRssSmartView(input.view)) {
    whereParts.push("feed_id in (select id from feeds where kind = 'rss')");
  }

  const decodedCursor = decodeCursor(input.cursor);
  if (decodedCursor) {
    whereParts.push(
      `(coalesce(published_at, 'epoch'::timestamptz), id) < ($${paramIndex++}, $${paramIndex++})`,
    );
    params.push(decodedCursor.publishedAt, decodedCursor.id);
  }

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Math.floor(input.limit ?? DEFAULT_LIMIT)),
  );

  return {
    whereSql: whereParts.length ? `where ${whereParts.join(' and ')}` : '',
    params,
    limit,
  };
}

export interface ReaderSnapshotArticleItem {
  id: string;
  feedId: string;
  title: string;
  titleOriginal: string | null;
  titleZh: string | null;
  summary: string | null;
  previewImage: string | null;
  author: string | null;
  publishedAt: string | null;
  link: string | null;
  isRead: boolean;
  isStarred: boolean;
  bodyTranslationEligible: boolean;
  bodyTranslationBlockedReason: string | null;
  aiSummarySession: {
    id: string;
    status: 'queued' | 'running' | 'succeeded' | 'failed';
    draftText: string;
    finalText: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    rawErrorMessage: string | null;
    startedAt: string;
    finishedAt: string | null;
    updatedAt: string;
  } | null;
}

export interface ReaderSnapshotFeed {
  id: string;
  kind: 'rss' | 'ai_digest';
  title: string;
  url: string;
  siteUrl: string | null;
  iconUrl: string | null;
  enabled: boolean;
  fullTextOnOpenEnabled: boolean;
  aiSummaryOnOpenEnabled: boolean;
  aiSummaryOnFetchEnabled: boolean;
  bodyTranslateOnFetchEnabled: boolean;
  bodyTranslateOnOpenEnabled: boolean;
  titleTranslateEnabled: boolean;
  bodyTranslateEnabled: boolean;
  articleListDisplayMode: 'card' | 'list';
  categoryId: string | null;
  fetchIntervalMinutes: number;
  lastFetchStatus: number | null;
  lastFetchError: string | null;
  lastFetchRawError: string | null;
  unreadCount: number;
}

export interface ReaderSnapshot {
  categories: Awaited<ReturnType<typeof listCategories>>;
  feeds: ReaderSnapshotFeed[];
  articles: {
    items: ReaderSnapshotArticleItem[];
    nextCursor: string | null;
  };
}

const ARTICLE_LIST_PREVIEW_IMAGE_WIDTH = 192;
const ARTICLE_LIST_PREVIEW_IMAGE_HEIGHT = 208;
const ARTICLE_LIST_PREVIEW_IMAGE_QUALITY = 55;
const FEED_ICON_IMAGE_SIZE = 32;
const FEED_ICON_IMAGE_QUALITY = 70;
const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
};

type ArticleKeywordFilter = ReturnType<typeof normalizePersistedSettings>['rss']['articleKeywordFilter'];

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi, (match, decimal, hex, named) => {
    if (decimal) {
      return String.fromCodePoint(Number.parseInt(decimal, 10));
    }

    if (hex) {
      return String.fromCodePoint(Number.parseInt(hex, 16));
    }

    return HTML_ENTITY_MAP[named.toLowerCase()] ?? match;
  });
}

function isExpiredSignedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const expiresAt = url.searchParams.get('x-expires');
    if (!expiresAt || !/^\d+$/.test(expiresAt)) {
      return false;
    }

    return Number.parseInt(expiresAt, 10) * 1000 <= Date.now();
  } catch {
    return false;
  }
}

function rewriteImageUrl(
  imageUrl: string | null,
  transform: { width?: number; height?: number; quality?: number },
): string | null {
  if (!imageUrl) return null;

  const normalizedImageUrl = decodeHtmlEntities(imageUrl).trim();
  if (!normalizedImageUrl) return null;
  if (isExpiredSignedImageUrl(normalizedImageUrl)) return null;

  const secret = getOptionalImageProxySecret(getServerEnv().IMAGE_PROXY_SECRET);
  if (!secret) return normalizedImageUrl;

  return buildImageProxyUrl({
    sourceUrl: normalizedImageUrl,
    secret,
    ...transform,
  });
}

function rewritePreviewImage(previewImage: string | null): string | null {
  return rewriteImageUrl(previewImage, {
    width: ARTICLE_LIST_PREVIEW_IMAGE_WIDTH,
    height: ARTICLE_LIST_PREVIEW_IMAGE_HEIGHT,
    quality: ARTICLE_LIST_PREVIEW_IMAGE_QUALITY,
  });
}

function rewriteFeedIcon(iconUrl: string | null): string | null {
  return rewriteImageUrl(iconUrl, {
    width: FEED_ICON_IMAGE_SIZE,
    height: FEED_ICON_IMAGE_SIZE,
    quality: FEED_ICON_IMAGE_QUALITY,
  });
}

type ArticleQueryRow = ReaderSnapshotArticleItem & {
  sortPublishedAt: unknown;
  sourceLanguage: string | null;
  contentHtml: string | null;
  contentFullHtml: string | null;
  aiSummarySessionId: string | null;
  aiSummarySessionStatus: 'queued' | 'running' | 'succeeded' | 'failed' | null;
  aiSummarySessionDraftText: string | null;
  aiSummarySessionFinalText: string | null;
  aiSummarySessionErrorCode: string | null;
  aiSummarySessionErrorMessage: string | null;
  aiSummarySessionRawErrorMessage: string | null;
  aiSummarySessionStartedAt: string | null;
  aiSummarySessionFinishedAt: string | null;
  aiSummarySessionUpdatedAt: string | null;
};

async function queryArticleRows(
  pool: Pool,
  input: { view: string; limit: number; cursor?: string | null },
): Promise<ArticleQueryRow[]> {
  const { whereSql, params, limit } = buildArticleFilter(input);
  const queryParams = [...params, limit + 1];
  const limitParamIndex = queryParams.length;

  const { rows } = await pool.query<ArticleQueryRow>(
    `
      select
        articles.id,
        articles.feed_id as "feedId",
        articles.title,
        articles.title_original as "titleOriginal",
        articles.title_zh as "titleZh",
        articles.summary,
        coalesce(
          preview_image_url,
          substring(articles.content_full_html from '<img[^>]+src=["'']([^"''>]+)["'']'),
          substring(articles.content_html from '<img[^>]+src=["'']([^"''>]+)["'']')
        ) as "previewImage",
        articles.author,
        articles.published_at as "publishedAt",
        articles.link,
        articles.source_language as "sourceLanguage",
        articles.content_html as "contentHtml",
        articles.content_full_html as "contentFullHtml",
        articles.is_read as "isRead",
        articles.is_starred as "isStarred",
        ai_summary_session.id as "aiSummarySessionId",
        ai_summary_session.status as "aiSummarySessionStatus",
        ai_summary_session.draft_text as "aiSummarySessionDraftText",
        ai_summary_session.final_text as "aiSummarySessionFinalText",
        ai_summary_session.error_code as "aiSummarySessionErrorCode",
        ai_summary_session.error_message as "aiSummarySessionErrorMessage",
        ai_summary_session.raw_error_message as "aiSummarySessionRawErrorMessage",
        ai_summary_session.started_at as "aiSummarySessionStartedAt",
        ai_summary_session.finished_at as "aiSummarySessionFinishedAt",
        ai_summary_session.updated_at as "aiSummarySessionUpdatedAt",
        coalesce(articles.published_at, 'epoch'::timestamptz) as "sortPublishedAt"
      from articles
      left join lateral (
        select
          id,
          status,
          draft_text,
          final_text,
          error_code,
          error_message,
          raw_error_message,
          started_at,
          finished_at,
          updated_at
        from article_ai_summary_sessions
        where article_id = articles.id
          and superseded_by_session_id is null
        order by
          case when status in ('queued', 'running') then 0 else 1 end,
          updated_at desc
        limit 1
      ) ai_summary_session on true
      ${whereSql}
      order by "sortPublishedAt" desc, id desc
      limit $${limitParamIndex}
    `,
    queryParams,
  );

  return rows;
}

async function listVisibleArticleRows(
  pool: Pool,
  input: { view: string; limit: number; cursor?: string | null },
  filterSettings: ArticleKeywordFilter,
): Promise<{ rows: ArticleQueryRow[]; nextCursor: string | null }> {
  const visible: ArticleQueryRow[] = [];
  const batchLimit = Math.max(input.limit * 2, DEFAULT_LIMIT);
  let cursor = input.cursor ?? null;
  let nextCursor: string | null = null;
  let iterations = 0;

  while (visible.length < input.limit + 1 && iterations < 5) {
    iterations += 1;
    const batch = await queryArticleRows(pool, {
      ...input,
      cursor,
      limit: batchLimit,
    });

    if (batch.length === 0) {
      break;
    }

    for (const row of batch) {
      cursor = encodeCursor({
        publishedAt: String(row.sortPublishedAt),
        id: row.id,
      });

      const keywords = getArticleKeywordsForFeed(filterSettings, row.feedId);
      if (matchesArticleKeywordFilter({ title: row.title, summary: row.summary }, keywords)) {
        continue;
      }

      visible.push(row);
      if (visible.length === input.limit + 1) {
        nextCursor = cursor;
        break;
      }
    }

    if (batch.length < batchLimit || nextCursor) {
      break;
    }
  }

  return {
    rows: visible.slice(0, input.limit),
    nextCursor,
  };
}

export async function getReaderSnapshot(
  pool: Pool,
  input: { view: string; limit?: number; cursor?: string | null },
): Promise<ReaderSnapshot> {
  const [categories, feeds, rawSettings] = await Promise.all([
    listCategories(pool),
    listFeeds(pool),
    getUiSettings(pool),
  ]);
  const settings = normalizePersistedSettings(rawSettings);

  const { rows: unreadRows } = await pool.query<{
    feedId: string;
    unreadCount: number;
  }>(`
    select feed_id as "feedId", count(*)::int as "unreadCount"
    from articles
    where is_read = false
    group by feed_id
  `);

  const unreadByFeedId = new Map<string, number>();
  for (const row of unreadRows) {
    unreadByFeedId.set(row.feedId, row.unreadCount);
  }

  const feedsWithUnread: ReaderSnapshotFeed[] = feeds.map((feed) => ({
    ...feed,
    iconUrl: rewriteFeedIcon(feed.iconUrl),
    unreadCount: unreadByFeedId.get(feed.id) ?? 0,
  }));

  const { limit } = buildArticleFilter(input);
  const { rows, nextCursor } = await listVisibleArticleRows(
    pool,
    {
      view: input.view,
      limit,
      cursor: input.cursor,
    },
    settings.rss.articleKeywordFilter,
  );

  return {
    categories,
    feeds: feedsWithUnread,
    articles: {
      items: rows.map((item) => {
        const {
          sortPublishedAt,
          sourceLanguage,
          contentHtml,
          contentFullHtml,
          aiSummarySessionId,
          aiSummarySessionStatus,
          aiSummarySessionDraftText,
          aiSummarySessionFinalText,
          aiSummarySessionErrorCode,
          aiSummarySessionErrorMessage,
          aiSummarySessionRawErrorMessage,
          aiSummarySessionStartedAt,
          aiSummarySessionFinishedAt,
          aiSummarySessionUpdatedAt,
          ...rest
        } = item;
        const eligibility = evaluateArticleBodyTranslationEligibility({
          sourceLanguage,
          contentHtml,
          contentFullHtml,
          summary: item.summary,
        });
        void sortPublishedAt;
        return {
          ...rest,
          previewImage: rewritePreviewImage(rest.previewImage),
          bodyTranslationEligible: eligibility.bodyTranslationEligible,
          bodyTranslationBlockedReason: eligibility.bodyTranslationBlockedReason,
          aiSummarySession:
            aiSummarySessionId &&
            aiSummarySessionStatus &&
            aiSummarySessionDraftText !== null &&
            aiSummarySessionStartedAt &&
            aiSummarySessionUpdatedAt
              ? {
                  id: aiSummarySessionId,
                  status: aiSummarySessionStatus,
                  draftText: aiSummarySessionDraftText,
                  finalText: aiSummarySessionFinalText,
                  errorCode: aiSummarySessionErrorCode,
                  errorMessage: aiSummarySessionErrorMessage,
                  rawErrorMessage: aiSummarySessionRawErrorMessage,
                  startedAt: aiSummarySessionStartedAt,
                  finishedAt: aiSummarySessionFinishedAt,
                  updatedAt: aiSummarySessionUpdatedAt,
                }
              : null,
        };
      }),
      nextCursor,
    },
  };
}
