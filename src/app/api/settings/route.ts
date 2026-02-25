import { getPool } from '../../../server/db/pool';
import { ok, fail } from '../../../server/http/apiResponse';
import { getUiSettings, updateUiSettings } from '../../../server/repositories/settingsRepo';
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
    const normalized = normalizePersistedSettings(json);

    const pool = getPool();
    const saved = await updateUiSettings(pool, normalized);
    return ok(normalizePersistedSettings(saved));
  } catch (err) {
    return fail(err);
  }
}

