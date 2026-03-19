import type { Pool } from 'pg';

export type ArticleTaskType = 'fulltext' | 'ai_summary' | 'ai_translate';
export type ArticleTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface ArticleTaskRow {
  id: string;
  articleId: string;
  type: ArticleTaskType;
  status: ArticleTaskStatus;
  jobId: string | null;
  requestedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  attempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  rawErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getArticleTasksByArticleId(
  pool: Pool,
  articleId: string,
): Promise<ArticleTaskRow[]> {
  const { rows } = await pool.query<ArticleTaskRow>(
    `
      select
        id,
        article_id as "articleId",
        type,
        status,
        job_id as "jobId",
        requested_at as "requestedAt",
        started_at as "startedAt",
        finished_at as "finishedAt",
        attempts,
        error_code as "errorCode",
        error_message as "errorMessage",
        raw_error_message as "rawErrorMessage",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from article_tasks
      where article_id = $1
    `,
    [articleId],
  );
  return rows;
}

async function upsertBase(
  pool: Pool,
  input: {
    articleId: string;
    type: ArticleTaskType;
    status: ArticleTaskStatus;
    jobId: string | null;
    requestedAt?: 'now' | 'keep' | 'null';
    startedAt?: 'now' | 'keep' | 'null';
    finishedAt?: 'now' | 'keep' | 'null';
    attempts?: 'inc' | number | 'keep';
    errorCode?: string | null;
    errorMessage?: string | null;
    rawErrorMessage?: string | null;
    clearError?: boolean;
  },
): Promise<void> {
  const requestedAtSql =
    input.requestedAt === 'now'
      ? 'now()'
      : input.requestedAt === 'null'
        ? 'null'
        : 'article_tasks.requested_at';
  const startedAtSql =
    input.startedAt === 'now'
      ? 'now()'
      : input.startedAt === 'null'
        ? 'null'
        : 'article_tasks.started_at';
  const finishedAtSql =
    input.finishedAt === 'now'
      ? 'now()'
      : input.finishedAt === 'null'
        ? 'null'
        : 'article_tasks.finished_at';
  const attemptsSql =
    input.attempts === 'inc'
      ? 'article_tasks.attempts + 1'
      : typeof input.attempts === 'number'
        ? String(input.attempts)
        : 'article_tasks.attempts';

  const errorCode = input.clearError ? null : (input.errorCode ?? null);
  const errorMessage = input.clearError ? null : (input.errorMessage ?? null);
  const rawErrorMessage = input.clearError ? null : (input.rawErrorMessage ?? null);

  await pool.query(
    `
      insert into article_tasks (
        article_id,
        type,
        status,
        job_id,
        requested_at,
        started_at,
        finished_at,
        attempts,
        error_code,
        error_message,
        raw_error_message,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, now(), null, null, 0, null, null, null, now(), now())
      on conflict (article_id, type) do update
      set
        status = $3,
        job_id = coalesce($4, article_tasks.job_id),
        requested_at = ${requestedAtSql},
        started_at = ${startedAtSql},
        finished_at = ${finishedAtSql},
        attempts = ${attemptsSql},
        error_code = $5,
        error_message = $6,
        raw_error_message = $7,
        updated_at = now()
    `,
    [input.articleId, input.type, input.status, input.jobId, errorCode, errorMessage, rawErrorMessage],
  );
}

export async function upsertTaskQueued(
  pool: Pool,
  input: { articleId: string; type: ArticleTaskType; jobId: string | null },
): Promise<void> {
  await upsertBase(pool, {
    articleId: input.articleId,
    type: input.type,
    status: 'queued',
    jobId: input.jobId,
    requestedAt: 'now',
    startedAt: 'null',
    finishedAt: 'null',
    attempts: 'keep',
    clearError: true,
  });
}

export async function upsertTaskRunning(
  pool: Pool,
  input: { articleId: string; type: ArticleTaskType; jobId: string | null },
): Promise<void> {
  await upsertBase(pool, {
    articleId: input.articleId,
    type: input.type,
    status: 'running',
    jobId: input.jobId,
    requestedAt: 'keep',
    startedAt: 'now',
    finishedAt: 'null',
    attempts: 'keep',
    clearError: false,
  });
}

export async function upsertTaskSucceeded(
  pool: Pool,
  input: { articleId: string; type: ArticleTaskType; jobId: string | null },
): Promise<void> {
  await upsertBase(pool, {
    articleId: input.articleId,
    type: input.type,
    status: 'succeeded',
    jobId: input.jobId,
    requestedAt: 'keep',
    startedAt: 'keep',
    finishedAt: 'now',
    attempts: 'keep',
    clearError: true,
  });
}

export async function upsertTaskFailed(
  pool: Pool,
  input: {
    articleId: string;
    type: ArticleTaskType;
    jobId: string | null;
    errorCode: string;
    errorMessage: string;
    rawErrorMessage: string | null;
  },
): Promise<void> {
  await upsertBase(pool, {
    articleId: input.articleId,
    type: input.type,
    status: 'failed',
    jobId: input.jobId,
    requestedAt: 'keep',
    startedAt: 'keep',
    finishedAt: 'now',
    attempts: 'inc',
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    rawErrorMessage: input.rawErrorMessage,
    clearError: false,
  });
}
