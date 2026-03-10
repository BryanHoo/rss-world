import got from 'got';
import { getFetchUrlCandidates } from '../rss/fetchUrlCandidates';
import { isSafeMediaUrl } from '../media/mediaProxyGuard';

const client = got.extend({
  retry: { limit: 0 },
  throwHttpErrors: false,
});

export interface FetchRssXmlResult {
  status: number;
  xml: string | null;
  etag: string | null;
  lastModified: string | null;
  finalUrl: string;
}

export interface FetchHtmlResult {
  status: number;
  finalUrl: string;
  contentType: string | null;
  html: string;
}

export async function fetchRssXml(
  url: string,
  options: {
    timeoutMs: number;
    userAgent: string;
    etag?: string | null;
    lastModified?: string | null;
  },
): Promise<FetchRssXmlResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const headers: Record<string, string> = {
      accept:
        'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      'user-agent': options.userAgent,
    };

    if (options.etag) headers['if-none-match'] = options.etag;
    if (options.lastModified) headers['if-modified-since'] = options.lastModified;

    const candidates = getFetchUrlCandidates(url);
    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        const res = await client(candidate, {
          method: 'GET',
          followRedirect: true,
          headers,
          signal: controller.signal,
          responseType: 'text',
        });

        const status = res.statusCode;
        const etag = typeof res.headers.etag === 'string' ? res.headers.etag : null;
        const lastModified =
          typeof res.headers['last-modified'] === 'string'
            ? res.headers['last-modified']
            : null;
        const urlValue = (res as { url?: unknown }).url;
        const finalUrl =
          typeof urlValue === 'string'
            ? urlValue
            : urlValue instanceof URL
              ? urlValue.toString()
              : candidate;

        if (status === 304) {
          return { status, xml: null, etag, lastModified, finalUrl };
        }

        return { status, xml: res.body, etag, lastModified, finalUrl };
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err;
        lastError = err;
      }
    }

    if (lastError instanceof Error) throw lastError;
    throw new Error('Network error');
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchHtml(
  url: string,
  options: {
    timeoutMs: number;
    userAgent: string;
    maxBytes: number;
    headers?: Record<string, string>;
  },
): Promise<FetchHtmlResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const headers: Record<string, string> = {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': options.userAgent,
      ...options.headers,
    };

    const req = client.stream(url, {
      method: 'GET',
      followRedirect: true,
      headers,
      signal: controller.signal,
    });

    let status = 0;
    let finalUrl = url;
    let contentType: string | null = null;

    req.on('response', (res) => {
      status = res.statusCode;
      finalUrl = res.url || finalUrl;

      const headerValue = res.headers['content-type'];
      contentType = typeof headerValue === 'string' ? headerValue : headerValue?.[0] ?? null;
    });

    const chunks: Buffer[] = [];
    let received = 0;

    const html = await new Promise<string>((resolve, reject) => {
      req.on('data', (chunk) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

        received += buf.byteLength;
        if (received > options.maxBytes) {
          req.destroy(new Error('Response too large'));
          return;
        }

        chunks.push(buf);
      });

      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });

      req.on('error', reject);
    });

    return { status, finalUrl, contentType, html };
  } finally {
    clearTimeout(timeout);
  }
}

export type FetchImageBytesResult =
  | {
      kind: 'ok';
      status: number;
      contentType: string;
      cacheControl: string;
      bytes: Buffer;
    }
  | { kind: 'redirect_fallback' }
  | { kind: 'forbidden' }
  | { kind: 'too_many_redirects' }
  | { kind: 'bad_gateway' }
  | { kind: 'unsupported_media_type' }
  | { kind: 'too_large' };

type FetchImageBytesHopResult =
  | { kind: 'redirect'; nextUrl: string }
  | {
      kind: 'ok';
      status: number;
      contentType: string;
      cacheControl: string;
      bytes: Buffer;
    }
  | { kind: 'redirect_fallback' }
  | { kind: 'bad_gateway' }
  | { kind: 'unsupported_media_type' }
  | { kind: 'too_large' };

async function fetchImageBytesHop(
  url: string,
  options: { maxBytes: number; userAgent: string; timeoutMs: number },
): Promise<FetchImageBytesHopResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const sourceUrl = new URL(url);
    const req = client.stream(url, {
      method: 'GET',
      followRedirect: false,
      headers: {
        'user-agent': options.userAgent,
        accept: 'image/*,*/*;q=0.8',
        referer: `${sourceUrl.origin}/`,
      },
      signal: controller.signal,
    });

    return await new Promise<FetchImageBytesHopResult>((resolve) => {
      let settled = false;
      const safeResolve = (value: FetchImageBytesHopResult) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      req.on('response', (res) => {
        const status = res.statusCode;

        if ([301, 302, 303, 307, 308].includes(status)) {
          const locationHeader = res.headers.location;
          const location =
            typeof locationHeader === 'string'
              ? locationHeader
              : locationHeader?.[0] ?? null;
          if (!location) {
            safeResolve({ kind: 'bad_gateway' });
            req.destroy();
            return;
          }

          const nextUrl = new URL(location, url).toString();
          safeResolve({ kind: 'redirect', nextUrl });
          req.destroy();
          return;
        }

        if (status < 200 || status >= 300) {
          safeResolve({ kind: 'redirect_fallback' });
          req.destroy();
          return;
        }

        const contentTypeHeader = res.headers['content-type'];
        const contentType =
          typeof contentTypeHeader === 'string'
            ? contentTypeHeader
            : contentTypeHeader?.[0] ?? '';
        if (!contentType.toLowerCase().startsWith('image/')) {
          safeResolve({ kind: 'unsupported_media_type' });
          req.destroy();
          return;
        }
      });

      const chunks: Buffer[] = [];
      let received = 0;

      req.on('data', (chunk) => {
        if (settled) return;
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

        received += buf.byteLength;
        if (received > options.maxBytes) {
          safeResolve({ kind: 'too_large' });
          req.destroy();
          return;
        }

        chunks.push(buf);
      });

      req.on('end', () => {
        if (settled) return;
        const res = req.response;
        const status = res?.statusCode ?? 0;
        const contentTypeHeader = res?.headers?.['content-type'];
        const cacheControlHeader = res?.headers?.['cache-control'];

        const contentType =
          typeof contentTypeHeader === 'string'
            ? contentTypeHeader
            : contentTypeHeader?.[0] ?? '';
        const cacheControl =
          typeof cacheControlHeader === 'string'
            ? cacheControlHeader
            : cacheControlHeader?.[0] ?? 'public, max-age=3600';

        safeResolve({
          kind: 'ok',
          status,
          contentType,
          cacheControl,
          bytes: Buffer.concat(chunks),
        });
      });

      req.on('error', () => {
        safeResolve({ kind: 'bad_gateway' });
      });
    });
  } catch {
    return { kind: 'bad_gateway' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchImageBytes(
  url: string,
  options: {
    maxRedirects: number;
    maxBytes: number;
    userAgent: string;
    timeoutMs?: number;
  },
): Promise<FetchImageBytesResult> {
  let currentUrl = url;
  let redirects = 0;

  while (true) {
    if (!(await isSafeMediaUrl(currentUrl))) {
      return { kind: 'forbidden' };
    }

    const hop = await fetchImageBytesHop(currentUrl, {
      maxBytes: options.maxBytes,
      userAgent: options.userAgent,
      timeoutMs: options.timeoutMs ?? 10_000,
    });

    if (hop.kind === 'redirect') {
      if (redirects >= options.maxRedirects) {
        return { kind: 'too_many_redirects' };
      }

      redirects += 1;
      currentUrl = hop.nextUrl;
      continue;
    }

    if (hop.kind === 'ok') return hop;
    return hop;
  }
}
