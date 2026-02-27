import type { Pool } from 'pg';
import { getArticleById, setArticleFulltext, setArticleFulltextError } from '../repositories/articlesRepo';
import { getAppSettings } from '../repositories/settingsRepo';
import { sanitizeContent } from '../rss/sanitizeContent';
import { isSafeExternalUrl } from '../rss/ssrfGuard';
import { extractFulltext } from './extractFulltext';

const MAX_HTML_BYTES = 2 * 1024 * 1024;

function isHtmlContentType(value: string | null): boolean {
  return typeof value === 'string' && value.toLowerCase().includes('text/html');
}

function toShortErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const name = typeof (err as { name?: unknown }).name === 'string' ? (err as { name: string }).name : '';
    if (name === 'AbortError') return 'timeout';
    const msg = err.message?.trim();
    return msg ? msg : 'Unknown error';
  }
  return 'Unknown error';
}

async function readTextWithLimit(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('Missing response body');
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;

    received += value.byteLength;
    if (received > maxBytes) {
      throw new Error('Response too large');
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
}

export async function fetchFulltextAndStore(pool: Pool, articleId: string): Promise<void> {
  const article = await getArticleById(pool, articleId);
  if (!article) return;

  if (article.contentFullHtml) return;

  const link = article.link?.trim() ?? '';
  if (!link) {
    await setArticleFulltextError(pool, articleId, { error: 'Missing link', sourceUrl: null });
    return;
  }

  if (!(await isSafeExternalUrl(link))) {
    await setArticleFulltextError(pool, articleId, { error: 'Unsafe URL', sourceUrl: link });
    return;
  }

  const settings = await getAppSettings(pool);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), settings.rssTimeoutMs);

  let sourceUrl: string | null = link;

  try {
    const res = await fetch(link, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'user-agent': settings.rssUserAgent,
      },
      signal: controller.signal,
    });

    sourceUrl = res.url || sourceUrl;

    if (!(await isSafeExternalUrl(sourceUrl))) {
      throw new Error('Unsafe URL');
    }

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`HTTP ${res.status}`);
    }

    if (!isHtmlContentType(res.headers.get('content-type'))) {
      throw new Error('Non-HTML response');
    }

    const html = await readTextWithLimit(res, MAX_HTML_BYTES);
    const extracted = extractFulltext({ html, url: sourceUrl });
    if (!extracted?.contentHtml) {
      throw new Error('Readability parse failed');
    }

    const sanitized = sanitizeContent(extracted.contentHtml, { baseUrl: sourceUrl });
    if (!sanitized) {
      throw new Error('Empty content');
    }

    await setArticleFulltext(pool, articleId, {
      contentFullHtml: sanitized,
      sourceUrl,
    });
  } catch (err) {
    await setArticleFulltextError(pool, articleId, {
      error: toShortErrorMessage(err),
      sourceUrl,
    });
  } finally {
    clearTimeout(timeout);
  }
}

