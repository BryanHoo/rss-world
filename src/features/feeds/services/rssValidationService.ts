export type RssValidationErrorCode =
  | 'invalid_url'
  | 'unauthorized'
  | 'timeout'
  | 'not_feed'
  | 'network_error';

export interface RssValidationResult {
  ok: boolean;
  kind?: 'rss' | 'atom';
  title?: string;
  siteUrl?: string;
  errorCode?: RssValidationErrorCode;
  message?: string;
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost';
}

export async function validateRssUrl(url: string): Promise<RssValidationResult> {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, errorCode: 'invalid_url', message: 'URL is invalid.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, errorCode: 'invalid_url', message: 'URL must use http or https.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const endpoint = new URL('/api/rss/validate', getBaseUrl());
    endpoint.searchParams.set('url', url);

    const res = await fetch(endpoint.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });

    const json: unknown = await res.json().catch(() => null);
    if (typeof json === 'object' && json !== null && 'ok' in json) {
      return json as RssValidationResult;
    }

    return { ok: false, errorCode: 'network_error', message: 'Network error.' };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, errorCode: 'timeout', message: 'Validation timed out.' };
    }
    return { ok: false, errorCode: 'network_error', message: 'Network error.' };
  } finally {
    clearTimeout(timeout);
  }
}
