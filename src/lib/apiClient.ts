import type { Article, Category, Feed } from '../types';

export interface ApiErrorPayload {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

type ApiOk<T> = { ok: true; data: T };
type ApiFail = { ok: false; error: ApiErrorPayload };
type ApiEnvelope<T> = ApiOk<T> | ApiFail;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost';
}

function toAbsoluteUrl(path: string): string {
  return new URL(path, getBaseUrl()).toString();
}

async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(toAbsoluteUrl(path), {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      accept: 'application/json',
    },
  });

  const json: unknown = await res.json().catch(() => null);
  if (!isRecord(json) || typeof json.ok !== 'boolean') {
    throw new Error('Invalid API response');
  }

  const envelope = json as ApiEnvelope<T>;
  if (envelope.ok) return envelope.data;

  const payload = envelope.error;
  throw new ApiError(
    payload?.message ?? 'Request failed',
    payload?.code ?? 'unknown_error',
    payload?.fields,
  );
}

export interface ReaderSnapshotDto {
  categories: Array<{
    id: string;
    name: string;
    position: number;
  }>;
  feeds: Array<{
    id: string;
    title: string;
    url: string;
    siteUrl: string | null;
    iconUrl: string | null;
    enabled: boolean;
    categoryId: string | null;
    fetchIntervalMinutes: number;
    unreadCount: number;
  }>;
  articles: {
    items: Array<{
      id: string;
      feedId: string;
      title: string;
      summary: string | null;
      author: string | null;
      publishedAt: string | null;
      link: string | null;
      isRead: boolean;
      isStarred: boolean;
    }>;
    nextCursor: string | null;
  };
}

export async function getReaderSnapshot(input?: {
  view?: string;
  limit?: number;
  cursor?: string;
}): Promise<ReaderSnapshotDto> {
  const params = new URLSearchParams();
  if (input?.view) params.set('view', input.view);
  if (typeof input?.limit === 'number') params.set('limit', String(input.limit));
  if (input?.cursor) params.set('cursor', input.cursor);

  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return requestApi<ReaderSnapshotDto>(`/api/reader/snapshot${suffix}`);
}

export async function createFeed(input: {
  title: string;
  url: string;
  categoryId: string | null;
}): Promise<
  ReaderSnapshotDto['feeds'][number] & {
    unreadCount: number;
  }
> {
  return requestApi('/api/feeds', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function refreshFeed(feedId: string): Promise<{ enqueued: true; jobId: string }> {
  return requestApi(`/api/feeds/${encodeURIComponent(feedId)}/refresh`, {
    method: 'POST',
  });
}

export async function patchArticle(
  articleId: string,
  input: { isRead?: boolean; isStarred?: boolean },
): Promise<{ updated: true }> {
  return requestApi(`/api/articles/${encodeURIComponent(articleId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function markAllRead(input: { feedId?: string } = {}): Promise<{ updatedCount: number }> {
  return requestApi('/api/articles/mark-all-read', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export interface ArticleDto {
  id: string;
  feedId: string;
  dedupeKey: string;
  title: string;
  link: string | null;
  author: string | null;
  publishedAt: string | null;
  contentHtml: string | null;
  summary: string | null;
  isRead: boolean;
  readAt: string | null;
  isStarred: boolean;
  starredAt: string | null;
}

export async function getArticle(articleId: string): Promise<ArticleDto> {
  return requestApi(`/api/articles/${encodeURIComponent(articleId)}`);
}

export function mapFeedDto(dto: ReaderSnapshotDto['feeds'][number], categories: Category[]): Feed {
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  return {
    id: dto.id,
    title: dto.title,
    url: dto.url,
    icon: undefined,
    unreadCount: dto.unreadCount,
    categoryId: dto.categoryId,
    category: dto.categoryId ? categoryNameById.get(dto.categoryId) ?? null : null,
  };
}

export function mapSnapshotArticleItem(dto: ReaderSnapshotDto['articles']['items'][number]): Article {
  return {
    id: dto.id,
    feedId: dto.feedId,
    title: dto.title,
    content: '',
    summary: dto.summary ?? '',
    author: dto.author ?? undefined,
    publishedAt: dto.publishedAt ?? new Date().toISOString(),
    link: dto.link ?? '',
    isRead: dto.isRead,
    isStarred: dto.isStarred,
  };
}

export function mapArticleDto(dto: ArticleDto): Article {
  return {
    id: dto.id,
    feedId: dto.feedId,
    title: dto.title,
    content: dto.contentHtml ?? '',
    summary: dto.summary ?? '',
    author: dto.author ?? undefined,
    publishedAt: dto.publishedAt ?? new Date().toISOString(),
    link: dto.link ?? '',
    isRead: dto.isRead,
    isStarred: dto.isStarred,
  };
}

