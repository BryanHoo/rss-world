import type { Pool } from 'pg';

export interface AppSettingsRow {
  aiSummaryEnabled: boolean;
  aiTranslateEnabled: boolean;
  aiAutoSummarize: boolean;
  aiModel: string;
  aiApiBaseUrl: string;
  rssUserAgent: string;
  rssTimeoutMs: number;
}

export async function getAppSettings(pool: Pool): Promise<AppSettingsRow> {
  const { rows } = await pool.query<AppSettingsRow>(`
    select
      ai_summary_enabled as "aiSummaryEnabled",
      ai_translate_enabled as "aiTranslateEnabled",
      ai_auto_summarize as "aiAutoSummarize",
      ai_model as "aiModel",
      ai_api_base_url as "aiApiBaseUrl",
      rss_user_agent as "rssUserAgent",
      rss_timeout_ms as "rssTimeoutMs"
    from app_settings
    where id = 1
  `);
  return rows[0];
}

export async function updateAppSettings(
  pool: Pool,
  input: Partial<AppSettingsRow>,
): Promise<AppSettingsRow> {
  const fields: string[] = [];
  const values: Array<string | boolean | number> = [];
  let paramIndex = 1;

  if (typeof input.aiSummaryEnabled !== 'undefined') {
    fields.push(`ai_summary_enabled = $${paramIndex++}`);
    values.push(input.aiSummaryEnabled);
  }
  if (typeof input.aiTranslateEnabled !== 'undefined') {
    fields.push(`ai_translate_enabled = $${paramIndex++}`);
    values.push(input.aiTranslateEnabled);
  }
  if (typeof input.aiAutoSummarize !== 'undefined') {
    fields.push(`ai_auto_summarize = $${paramIndex++}`);
    values.push(input.aiAutoSummarize);
  }
  if (typeof input.aiModel !== 'undefined') {
    fields.push(`ai_model = $${paramIndex++}`);
    values.push(input.aiModel);
  }
  if (typeof input.aiApiBaseUrl !== 'undefined') {
    fields.push(`ai_api_base_url = $${paramIndex++}`);
    values.push(input.aiApiBaseUrl);
  }
  if (typeof input.rssUserAgent !== 'undefined') {
    fields.push(`rss_user_agent = $${paramIndex++}`);
    values.push(input.rssUserAgent);
  }
  if (typeof input.rssTimeoutMs !== 'undefined') {
    fields.push(`rss_timeout_ms = $${paramIndex++}`);
    values.push(input.rssTimeoutMs);
  }

  if (fields.length === 0) {
    return getAppSettings(pool);
  }

  const { rows } = await pool.query<AppSettingsRow>(
    `
      update app_settings
      set
        ${fields.join(', ')},
        updated_at = now()
      where id = 1
      returning
        ai_summary_enabled as "aiSummaryEnabled",
        ai_translate_enabled as "aiTranslateEnabled",
        ai_auto_summarize as "aiAutoSummarize",
        ai_model as "aiModel",
        ai_api_base_url as "aiApiBaseUrl",
        rss_user_agent as "rssUserAgent",
        rss_timeout_ms as "rssTimeoutMs"
    `,
    values,
  );
  return rows[0];
}
