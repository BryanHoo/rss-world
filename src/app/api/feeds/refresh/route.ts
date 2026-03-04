import { ok, fail } from '../../../../server/http/apiResponse';
import { getQueueSendOptions } from '../../../../server/queue/contracts';
import { JOB_REFRESH_ALL } from '../../../../server/queue/jobs';
import { enqueueWithResult } from '../../../../server/queue/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const payload = { force: true };
    const result = await enqueueWithResult(
      JOB_REFRESH_ALL,
      payload,
      getQueueSendOptions(JOB_REFRESH_ALL, payload),
    );
    if (result.status !== 'enqueued') return ok({ enqueued: false });
    return ok({ enqueued: true, jobId: result.jobId });
  } catch (err) {
    return fail(err);
  }
}
