import Parser from 'rss-parser';
import { NextResponse } from 'next/server';
import { getFetchUrlCandidates } from '../../../../server/rss/fetchUrlCandidates';
import { isSafeExternalUrl } from '../../../../server/rss/ssrfGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RssValidationErrorCode =
  | 'invalid_url'
  | 'unauthorized'
  | 'timeout'
  | 'not_feed'
  | 'network_error';

type RssValidationResult =
  | {
      ok: true;
      kind: 'rss' | 'atom';
      title?: string;
    }
  | {
      ok: false;
      errorCode: RssValidationErrorCode;
      message?: string;
    };

const parser = new Parser();

function detectKind(xml: string): 'rss' | 'atom' {
  const head = xml.trimStart().slice(0, 2000).toLowerCase();
  if (head.includes('<feed')) return 'atom';
  return 'rss';
}

function toJson(result: RssValidationResult) {
  return NextResponse.json(result, { status: 200 });
}

export async function GET(request: Request) {
  const urlParam = new URL(request.url).searchParams.get('url') ?? '';

  let url: URL;
  try {
    url = new URL(urlParam);
  } catch {
    return toJson({ ok: false, errorCode: 'invalid_url', message: 'URL is invalid.' });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return toJson({
      ok: false,
      errorCode: 'invalid_url',
      message: 'URL must use http or https.',
    });
  }

  if (!(await isSafeExternalUrl(urlParam))) {
    return toJson({
      ok: false,
      errorCode: 'invalid_url',
      message: 'URL is invalid.',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const candidates = getFetchUrlCandidates(urlParam);
    let res: Response | null = null;
    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        res = await fetch(candidate, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            accept:
              'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
          },
          signal: controller.signal,
        });
        break;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err;
        lastError = err;
      }
    }

    if (!res) {
      if (lastError instanceof Error) throw lastError;
      throw new Error('Network error');
    }

    if (res.status === 401 || res.status === 403) {
      return toJson({
        ok: false,
        errorCode: 'unauthorized',
        message: 'Source requires authorization.',
      });
    }

    if (!res.ok) {
      return toJson({
        ok: false,
        errorCode: 'network_error',
        message: 'Network error.',
      });
    }

    const xml = await res.text();
    const kind = detectKind(xml);

    try {
      const feed = await parser.parseString(xml);
      return toJson({
        ok: true,
        kind,
        title: typeof feed.title === 'string' ? feed.title : undefined,
      });
    } catch {
      return toJson({
        ok: false,
        errorCode: 'not_feed',
        message: 'Response is not a valid RSS/Atom feed.',
      });
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return toJson({
        ok: false,
        errorCode: 'timeout',
        message: 'Validation timed out.',
      });
    }
    return toJson({
      ok: false,
      errorCode: 'network_error',
      message: 'Network error.',
    });
  } finally {
    clearTimeout(timeout);
  }
}
