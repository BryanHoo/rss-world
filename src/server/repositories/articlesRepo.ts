import 'server-only';
import type { Pool } from 'pg';

export interface ArticleRow {
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

export async function insertArticleIgnoreDuplicate(
  pool: Pool,
  input: {
    feedId: string;
    dedupeKey: string;
    title: string;
    link?: string | null;
    author?: string | null;
    publishedAt?: string | null;
    contentHtml?: string | null;
    summary?: string | null;
  },
): Promise<ArticleRow | null> {
  const { rows } = await pool.query<ArticleRow>(
    `
      insert into articles(
        feed_id,
        dedupe_key,
        title,
        link,
        author,
        published_at,
        content_html,
        summary
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (feed_id, dedupe_key) do nothing
      returning
        id,
        feed_id as "feedId",
        dedupe_key as "dedupeKey",
        title,
        link,
        author,
        published_at as "publishedAt",
        content_html as "contentHtml",
        summary,
        is_read as "isRead",
        read_at as "readAt",
        is_starred as "isStarred",
        starred_at as "starredAt"
    `,
    [
      input.feedId,
      input.dedupeKey,
      input.title,
      input.link ?? null,
      input.author ?? null,
      input.publishedAt ?? null,
      input.contentHtml ?? null,
      input.summary ?? null,
    ],
  );
  return rows[0] ?? null;
}

export async function getArticleById(
  pool: Pool,
  id: string,
): Promise<ArticleRow | null> {
  const { rows } = await pool.query<ArticleRow>(
    `
      select
        id,
        feed_id as "feedId",
        dedupe_key as "dedupeKey",
        title,
        link,
        author,
        published_at as "publishedAt",
        content_html as "contentHtml",
        summary,
        is_read as "isRead",
        read_at as "readAt",
        is_starred as "isStarred",
        starred_at as "starredAt"
      from articles
      where id = $1
    `,
    [id],
  );
  return rows[0] ?? null;
}

export async function setArticleRead(
  pool: Pool,
  id: string,
  isRead: boolean,
): Promise<void> {
  await pool.query(
    `
      update articles
      set
        is_read = $2,
        read_at = case when $2 then coalesce(read_at, now()) else null end
      where id = $1
    `,
    [id, isRead],
  );
}

export async function setArticleStarred(
  pool: Pool,
  id: string,
  isStarred: boolean,
): Promise<void> {
  await pool.query(
    `
      update articles
      set
        is_starred = $2,
        starred_at = case when $2 then coalesce(starred_at, now()) else null end
      where id = $1
    `,
    [id, isStarred],
  );
}

export async function markAllRead(
  pool: Pool,
  input: { feedId?: string },
): Promise<number> {
  const params: string[] = [];
  const values: string[] = [];
  let index = 1;

  if (input.feedId) {
    params.push(`feed_id = $${index++}`);
    values.push(input.feedId);
  }

  const whereParts = [...params, 'is_read = false'];

  const { rowCount } = await pool.query(
    `
      update articles
      set
        is_read = true,
        read_at = coalesce(read_at, now())
      where ${whereParts.join(' and ')}
    `,
    values,
  );
  return rowCount ?? 0;
}

