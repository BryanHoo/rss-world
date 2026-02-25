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

    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers,
      signal: controller.signal,
    });

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
