import { getPool } from '../../../server/db/pool';
import { ok, fail } from '../../../server/http/apiResponse';
import { getUiSettings, updateUiSettings } from '../../../server/repositories/settingsRepo';
import { updateAllFeedsFetchIntervalMinutes } from '../../../server/repositories/feedsRepo';
import { normalizePersistedSettings } from '../../../features/settings/settingsSchema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getPool();
    const raw = await getUiSettings(pool);
    return ok(normalizePersistedSettings(raw));
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const next = normalizePersistedSettings(json);

    const pool = getPool();
    const prevRaw = await getUiSettings(pool);
    const prev = normalizePersistedSettings(prevRaw);

    const client = await pool.connect();

    try {
      await client.query('begin');
      const saved = await updateUiSettings(client, next);

      if (prev.rss.fetchIntervalMinutes !== next.rss.fetchIntervalMinutes) {
        await updateAllFeedsFetchIntervalMinutes(client, next.rss.fetchIntervalMinutes);
      }

      await client.query('commit');
      return ok(normalizePersistedSettings(saved));
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    return fail(err);
  }
}
