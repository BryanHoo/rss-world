import { ok, fail } from '../../../../server/http/apiResponse';
import { JOB_REFRESH_ALL } from '../../../../server/queue/jobs';
import { enqueue } from '../../../../server/queue/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const jobId = await enqueue(JOB_REFRESH_ALL, { force: true });
    return ok({ enqueued: true, jobId });
  } catch (err) {
    return fail(err);
  }
}

