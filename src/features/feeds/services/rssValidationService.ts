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
  errorCode?: RssValidationErrorCode;
  message?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  await delay(350);

  const normalized = url.toLowerCase();

  if (normalized.includes('401') || normalized.includes('403')) {
    return { ok: false, errorCode: 'unauthorized', message: 'Source requires authorization.' };
  }

  if (normalized.includes('timeout')) {
    return { ok: false, errorCode: 'timeout', message: 'Validation timed out.' };
  }

  if (normalized.includes('network')) {
    return { ok: false, errorCode: 'network_error', message: 'Network error.' };
  }

  if (normalized.includes('success') || normalized.includes('rss') || normalized.includes('atom')) {
    return {
      ok: true,
      kind: normalized.includes('atom') ? 'atom' : 'rss',
      title: 'Mock Feed',
    };
  }

  return {
    ok: false,
    errorCode: 'not_feed',
    message: 'Response is not a valid RSS/Atom feed.',
  };
}
