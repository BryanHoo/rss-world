import Parser from 'rss-parser';
import { ok } from '../../../../server/http/apiResponse';
import { fetchRssXml } from '../../../../server/http/externalHttpClient';
import { isSafeExternalUrl } from '../../../../server/rss/ssrfGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RssValidationErrorCode =
  | 'invalid_url'
  | 'unauthorized'
  | 'timeout'
  | 'not_feed'
  | 'network_error';

type RssValidationResultData =
  | {
      valid: true;
      kind: 'rss' | 'atom';
      title?: string;
      siteUrl?: string;
    }
  | {
      valid: false;
      reason: RssValidationErrorCode;
      message: string;
    };

const parser = new Parser();

function detectKind(xml: string): 'rss' | 'atom' {
  const head = xml.trimStart().slice(0, 2000).toLowerCase();
  if (head.includes('<feed')) return 'atom';
  return 'rss';
}

function toJson(result: RssValidationResultData) {
  return ok(result);
}

function normalizeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const urlParam = new URL(request.url).searchParams.get('url') ?? '';

  let url: URL;
  try {
    url = new URL(urlParam);
  } catch {
    return toJson({ valid: false, reason: 'invalid_url', message: '链接格式不正确' });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return toJson({
      valid: false,
      reason: 'invalid_url',
      message: '链接必须使用 http 或 https',
    });
  }

  if (!(await isSafeExternalUrl(urlParam))) {
    return toJson({ valid: false, reason: 'invalid_url', message: '链接格式不正确' });
  }

  try {
    const res = await fetchRssXml(urlParam, {
      timeoutMs: 10_000,
      userAgent: 'FeedFuse RSS Validator',
    });

    if (res.status === 401 || res.status === 403) {
      return toJson({
        valid: false,
        reason: 'unauthorized',
        message: '源站需要授权访问',
      });
    }

    if (res.status < 200 || res.status >= 300) {
      return toJson({
        valid: false,
        reason: 'network_error',
        message: '校验失败，请稍后重试',
      });
    }

    if (!res.xml) {
      return toJson({
        valid: false,
        reason: 'not_feed',
        message: '响应不是合法的 RSS/Atom 源',
      });
    }

    const xml = res.xml;
    const kind = detectKind(xml);

    try {
      const feed = await parser.parseString(xml);
      const parsedSiteUrl = normalizeHttpUrl(feed.link);
      return toJson({
        valid: true,
        kind,
        title: typeof feed.title === 'string' ? feed.title : undefined,
        siteUrl: parsedSiteUrl ?? undefined,
      });
    } catch {
      return toJson({
        valid: false,
        reason: 'not_feed',
        message: '响应不是合法的 RSS/Atom 源',
      });
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return toJson({
        valid: false,
        reason: 'timeout',
        message: '校验超时，请稍后重试',
      });
    }
    return toJson({
      valid: false,
      reason: 'network_error',
      message: '校验失败，请稍后重试',
    });
  }
}
