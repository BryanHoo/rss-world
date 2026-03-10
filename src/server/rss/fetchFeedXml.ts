import { fetchRssXml } from '../http/externalHttpClient';

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
  const res = await fetchRssXml(url, options);

  return {
    status: res.status,
    xml: res.xml,
    etag: res.etag,
    lastModified: res.lastModified,
  };
}
