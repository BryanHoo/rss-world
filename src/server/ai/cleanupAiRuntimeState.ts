import type { Pool, PoolClient } from 'pg';
import {
  AI_CONFIG_CHANGED_ERROR_CODE,
  AI_CONFIG_CHANGED_ERROR_MESSAGE,
  AI_CONFIG_CHANGED_RAW_ERROR,
  type AiCleanupScopes,
} from './configFingerprints';

type DbClient = Pool | PoolClient;

export interface CleanupAiRuntimeStateResult {
  summarySessions: number;
  translationSessions: number;
  digestRuns: number;
  taskRows: number;
}

async function cleanupSummarySessions(pool: DbClient): Promise<number> {
  const { rows } = await pool.query<{ id: string; draftText: string }>(
    `
      select
        id,
        draft_text as "draftText"
      from article_ai_summary_sessions
      where status in ('queued', 'running')
        and superseded_by_session_id is null
    `,
  );

  if (!rows.length) {
    return 0;
  }

  await pool.query(
    `
      update article_ai_summary_sessions
      set
        status = 'failed',
        error_code = $1,
        error_message = $2,
        raw_error_message = $3,
        finished_at = now(),
        updated_at = now()
      where status in ('queued', 'running')
        and superseded_by_session_id is null
    `,
    [
      AI_CONFIG_CHANGED_ERROR_CODE,
      AI_CONFIG_CHANGED_ERROR_MESSAGE,
      AI_CONFIG_CHANGED_RAW_ERROR,
    ],
  );

  for (const row of rows) {
    await pool.query(
      `
        insert into article_ai_summary_events (
          session_id,
          event_type,
          payload
        )
        values ($1, $2, $3)
      `,
      [
        row.id,
        'session.failed',
        {
          sessionId: row.id,
          draftText: row.draftText,
          errorCode: AI_CONFIG_CHANGED_ERROR_CODE,
          errorMessage: AI_CONFIG_CHANGED_ERROR_MESSAGE,
          rawErrorMessage: AI_CONFIG_CHANGED_RAW_ERROR,
        },
      ],
    );
  }

  return rows.length;
}

async function cleanupTranslationSessions(pool: DbClient): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    `
      select id
      from article_translation_sessions
      where status = 'running'
    `,
  );

  for (const row of rows) {
    await pool.query(
      `
        update article_translation_segments
        set
          status = 'failed',
          translated_text = null,
          error_code = $2,
          error_message = $3,
          raw_error_message = $4,
          finished_at = now(),
          updated_at = now()
        where session_id = $1
          and status in ('pending', 'running')
      `,
      [
        row.id,
        AI_CONFIG_CHANGED_ERROR_CODE,
        AI_CONFIG_CHANGED_ERROR_MESSAGE,
        AI_CONFIG_CHANGED_RAW_ERROR,
      ],
    );

    const countsResult = await pool.query<{
      totalSegments: number;
      translatedSegments: number;
      failedSegments: number;
    }>(
      `
        select
          count(*)::int as "totalSegments",
          count(*) filter (where status = 'succeeded')::int as "translatedSegments",
          count(*) filter (where status = 'failed')::int as "failedSegments"
        from article_translation_segments
        where session_id = $1
      `,
      [row.id],
    );
    const counts = countsResult.rows[0] ?? {
      totalSegments: 0,
      translatedSegments: 0,
      failedSegments: 0,
    };

    await pool.query(
      `
        update article_translation_sessions
        set
          status = 'failed',
          total_segments = $2,
          translated_segments = $3,
          failed_segments = $4,
          raw_error_message = $5,
          finished_at = now(),
          updated_at = now()
        where id = $1
      `,
      [
        row.id,
        counts.totalSegments,
        counts.translatedSegments,
        counts.failedSegments,
        AI_CONFIG_CHANGED_RAW_ERROR,
      ],
    );

    await pool.query(
      `
        insert into article_translation_events (
          session_id,
          segment_index,
          event_type,
          payload
        )
        values ($1, null, $2, $3)
      `,
      [
        row.id,
        'session.failed',
        {
          errorCode: AI_CONFIG_CHANGED_ERROR_CODE,
          errorMessage: AI_CONFIG_CHANGED_ERROR_MESSAGE,
          rawErrorMessage: AI_CONFIG_CHANGED_RAW_ERROR,
        },
      ],
    );
  }

  return rows.length;
}

async function cleanupArticleTasks(
  pool: DbClient,
  input: { type: 'ai_summary' | 'ai_translate' },
): Promise<number> {
  const result = await pool.query(
    `
      update article_tasks
      set
        status = 'failed',
        error_code = $2,
        error_message = $3,
        raw_error_message = $4,
        finished_at = now(),
        updated_at = now()
      where type = $1
        and status in ('queued', 'running')
    `,
    [
      input.type,
      AI_CONFIG_CHANGED_ERROR_CODE,
      AI_CONFIG_CHANGED_ERROR_MESSAGE,
      AI_CONFIG_CHANGED_RAW_ERROR,
    ],
  );

  return result.rowCount ?? 0;
}

async function cleanupDigestRuns(pool: DbClient): Promise<number> {
  const result = await pool.query(
    `
      update ai_digest_runs
      set
        status = 'failed',
        error_code = $1,
        error_message = $2,
        updated_at = now()
      where status in ('queued', 'running')
    `,
    [AI_CONFIG_CHANGED_ERROR_CODE, AI_CONFIG_CHANGED_ERROR_MESSAGE],
  );

  return result.rowCount ?? 0;
}

export async function cleanupAiRuntimeState(input: {
  pool: DbClient;
  scopes: AiCleanupScopes;
}): Promise<CleanupAiRuntimeStateResult> {
  const result: CleanupAiRuntimeStateResult = {
    summarySessions: 0,
    translationSessions: 0,
    digestRuns: 0,
    taskRows: 0,
  };

  if (input.scopes.summary) {
    result.summarySessions = await cleanupSummarySessions(input.pool);
    result.taskRows += await cleanupArticleTasks(input.pool, { type: 'ai_summary' });
  }

  if (input.scopes.translation) {
    result.translationSessions = await cleanupTranslationSessions(input.pool);
    result.taskRows += await cleanupArticleTasks(input.pool, { type: 'ai_translate' });
  }

  if (input.scopes.digest) {
    result.digestRuns = await cleanupDigestRuns(input.pool);
  }

  return result;
}
