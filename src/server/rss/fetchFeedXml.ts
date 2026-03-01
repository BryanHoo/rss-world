import { getFetchUrlCandidates } from './fetchUrlCandidates';

export interface FetchFeedXmlResult {
  status: number;
  xml: string | null;
  etag: string | null;
  lastModified: string | null;
}

export interface FetchFeedXmlOptions {
  timeoutMs: number;
  userAgent: string;
  etag?: string | null;
  lastModified?: string | null;
}

export async function fetchFeedXml(
  url: string,
  options: FetchFeedXmlOptions,
): Promise<FetchFeedXmlResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const headers: HeadersInit = {
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      'user-agent': options.userAgent,
    };

    if (options.etag) headers['if-none-match'] = options.etag;
    if (options.lastModified) headers['if-modified-since'] = options.lastModified;

    const candidates = getFetchUrlCandidates(url);
    let res: Response | null = null;
    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        res = await fetch(candidate, {
          method: 'GET',
          redirect: 'follow',
          headers,
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

    const etag = res.headers.get('etag');
    const lastModified = res.headers.get('last-modified');

    if (res.status === 304) {
      return {
        status: res.status,
        xml: null,
        etag,
        lastModified,
      };
    }

    const xml = await res.text();
    return {
      status: res.status,
      xml,
      etag,
      lastModified,
    };
  } finally {
    clearTimeout(timeout);
  }
}
