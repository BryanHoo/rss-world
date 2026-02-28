import type { Pool, PoolClient } from 'pg';

export interface FeedRow {
  id: string;
  title: string;
  url: string;
  siteUrl: string | null;
  iconUrl: string | null;
  enabled: boolean;
  fullTextOnOpenEnabled: boolean;
  aiSummaryOnOpenEnabled: boolean;
  categoryId: string | null;
  fetchIntervalMinutes: number;
}

export async function listFeeds(pool: Pool): Promise<FeedRow[]> {
  const { rows } = await pool.query<FeedRow>(`
    select
      id,
      title,
      url,
      site_url as "siteUrl",
      icon_url as "iconUrl",
      enabled,
      full_text_on_open_enabled as "fullTextOnOpenEnabled",
      ai_summary_on_open_enabled as "aiSummaryOnOpenEnabled",
      category_id as "categoryId",
      fetch_interval_minutes as "fetchIntervalMinutes"
    from feeds
    order by created_at asc, id asc
  `);
  return rows;
}

export async function createFeed(
  pool: Pool,
  input: {
    title: string;
    url: string;
    siteUrl?: string | null;
    iconUrl?: string | null;
    enabled?: boolean;
    fullTextOnOpenEnabled?: boolean;
    aiSummaryOnOpenEnabled?: boolean;
    categoryId?: string | null;
    fetchIntervalMinutes?: number;
  },
): Promise<FeedRow> {
  const { rows } = await pool.query<FeedRow>(
    `
      insert into feeds(
        title,
        url,
        site_url,
        icon_url,
        enabled,
        full_text_on_open_enabled,
        ai_summary_on_open_enabled,
        category_id,
        fetch_interval_minutes
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning
        id,
        title,
        url,
        site_url as "siteUrl",
        icon_url as "iconUrl",
        enabled,
        full_text_on_open_enabled as "fullTextOnOpenEnabled",
        ai_summary_on_open_enabled as "aiSummaryOnOpenEnabled",
        category_id as "categoryId",
        fetch_interval_minutes as "fetchIntervalMinutes"
    `,
    [
      input.title,
      input.url,
      input.siteUrl ?? null,
      input.iconUrl ?? null,
      input.enabled ?? true,
      input.fullTextOnOpenEnabled ?? false,
      input.aiSummaryOnOpenEnabled ?? false,
      input.categoryId ?? null,
      input.fetchIntervalMinutes ?? 30,
    ],
  );
  return rows[0];
}

export async function updateFeed(
  pool: Pool,
  id: string,
  input: {
    title?: string;
    siteUrl?: string | null;
    iconUrl?: string | null;
    enabled?: boolean;
    fullTextOnOpenEnabled?: boolean;
    aiSummaryOnOpenEnabled?: boolean;
    categoryId?: string | null;
    fetchIntervalMinutes?: number;
  },
): Promise<FeedRow | null> {
  const fields: string[] = [];
  const values: Array<string | boolean | number | null> = [];
  let paramIndex = 1;

  if (typeof input.title !== 'undefined') {
    fields.push(`title = $${paramIndex++}`);
    values.push(input.title);
  }
  if (typeof input.siteUrl !== 'undefined') {
    fields.push(`site_url = $${paramIndex++}`);
    values.push(input.siteUrl);
  }
  if (typeof input.iconUrl !== 'undefined') {
    fields.push(`icon_url = $${paramIndex++}`);
    values.push(input.iconUrl);
  }
  if (typeof input.enabled !== 'undefined') {
    fields.push(`enabled = $${paramIndex++}`);
    values.push(input.enabled);
  }
  if (typeof input.fullTextOnOpenEnabled !== 'undefined') {
    fields.push(`full_text_on_open_enabled = $${paramIndex++}`);
    values.push(Boolean(input.fullTextOnOpenEnabled));
  }
  if (typeof input.aiSummaryOnOpenEnabled !== 'undefined') {
    fields.push(`ai_summary_on_open_enabled = $${paramIndex++}`);
    values.push(Boolean(input.aiSummaryOnOpenEnabled));
  }
  if (typeof input.categoryId !== 'undefined') {
    fields.push(`category_id = $${paramIndex++}`);
    values.push(input.categoryId);
  }
  if (typeof input.fetchIntervalMinutes !== 'undefined') {
    fields.push(`fetch_interval_minutes = $${paramIndex++}`);
    values.push(input.fetchIntervalMinutes);
  }
  if (fields.length === 0) return null;

  fields.push('updated_at = now()');
  values.push(id);

  const { rows } = await pool.query<FeedRow>(
    `
      update feeds
      set ${fields.join(', ')}
      where id = $${paramIndex}
      returning
        id,
        title,
        url,
        site_url as "siteUrl",
        icon_url as "iconUrl",
        enabled,
        full_text_on_open_enabled as "fullTextOnOpenEnabled",
        ai_summary_on_open_enabled as "aiSummaryOnOpenEnabled",
        category_id as "categoryId",
        fetch_interval_minutes as "fetchIntervalMinutes"
    `,
    values,
  );
  return rows[0] ?? null;
}

export async function deleteFeed(pool: Pool, id: string): Promise<boolean> {
  const res = await pool.query('delete from feeds where id = $1', [id]);
  return (res.rowCount ?? 0) > 0;
}

export async function getFeedFullTextOnOpenEnabled(
  pool: Pool,
  id: string,
): Promise<boolean | null> {
  const { rows } = await pool.query<{ fullTextOnOpenEnabled: boolean }>(
    `
      select full_text_on_open_enabled as "fullTextOnOpenEnabled"
      from feeds
      where id = $1
      limit 1
    `,
    [id],
  );
  return typeof rows[0]?.fullTextOnOpenEnabled === 'boolean'
    ? rows[0].fullTextOnOpenEnabled
    : null;
}

export interface FeedFetchRow {
  id: string;
  url: string;
  enabled: boolean;
  etag: string | null;
  lastModified: string | null;
  fetchIntervalMinutes: number;
  lastFetchedAt: string | null;
}

export async function listEnabledFeedsForFetch(pool: Pool): Promise<FeedFetchRow[]> {
  const { rows } = await pool.query<FeedFetchRow>(`
    select
      id,
      url,
      enabled,
      etag,
      last_modified as "lastModified",
      fetch_interval_minutes as "fetchIntervalMinutes",
      last_fetched_at as "lastFetchedAt"
    from feeds
    where enabled = true
    order by created_at asc, id asc
  `);
  return rows;
}

export async function getFeedForFetch(
  pool: Pool,
  id: string,
): Promise<FeedFetchRow | null> {
  const { rows } = await pool.query<FeedFetchRow>(
    `
      select
        id,
        url,
        enabled,
        etag,
        last_modified as "lastModified",
        fetch_interval_minutes as "fetchIntervalMinutes",
        last_fetched_at as "lastFetchedAt"
      from feeds
      where id = $1
      limit 1
    `,
    [id],
  );
  return rows[0] ?? null;
}

export async function recordFeedFetchResult(
  pool: Pool,
  id: string,
  input: {
    status: number | null;
    etag?: string | null;
    lastModified?: string | null;
    error?: string | null;
  },
): Promise<void> {
  await pool.query(
    `
      update feeds
      set
        etag = coalesce($2, etag),
        last_modified = coalesce($3, last_modified),
        last_fetched_at = now(),
        last_fetch_status = $4,
        last_fetch_error = $5,
        updated_at = now()
      where id = $1
    `,
    [
      id,
      input.etag ?? null,
      input.lastModified ?? null,
      input.status,
      input.error ?? null,
    ],
  );
}

export async function updateAllFeedsFetchIntervalMinutes(
  pool: Pool | PoolClient,
  minutes: number,
): Promise<{ updatedCount: number }> {
  const res = await pool.query(
    `
      update feeds
      set
        fetch_interval_minutes = $1,
        updated_at = now()
    `,
    [minutes],
  );

  return { updatedCount: res.rowCount ?? 0 };
}
