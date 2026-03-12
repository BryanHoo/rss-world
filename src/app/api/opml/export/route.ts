import { getPool } from '../../../../server/db/pool';
import { fail } from '../../../../server/http/apiResponse';
import { exportOpml } from '../../../../server/services/opmlService';

export async function GET() {
  try {
    const result = await exportOpml(getPool());

    return new Response(result.xml, {
      status: 200,
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'content-disposition': `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
