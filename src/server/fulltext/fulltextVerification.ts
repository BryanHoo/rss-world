export const FULLTEXT_VERIFICATION_REQUIRED_ERROR = 'Verification required';

const WECHAT_VERIFICATION_URL_RE =
  /^https?:\/\/mp\.weixin\.qq\.com\/mp\/wappoc_appmsgcaptcha(?:[/?#]|$)/i;
const WECHAT_VERIFICATION_TEXT_MARKERS = ['环境异常', '完成验证后即可继续访问'] as const;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function htmlToPlainText(html: string): string {
  return normalizeWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

export function isFulltextVerificationPage(input: {
  html?: string | null;
  sourceUrl?: string | null;
}): boolean {
  const sourceUrl = input.sourceUrl?.trim() ?? '';
  if (sourceUrl && WECHAT_VERIFICATION_URL_RE.test(sourceUrl)) {
    return true;
  }

  const html = input.html?.trim() ?? '';
  if (!html) {
    return false;
  }

  const plain = htmlToPlainText(html);
  return WECHAT_VERIFICATION_TEXT_MARKERS.every((marker) => plain.includes(marker));
}

export function getUsableFulltextHtml(input: {
  contentFullHtml?: string | null;
  contentFullSourceUrl?: string | null;
}): string | null {
  const contentFullHtml = input.contentFullHtml;
  if (!contentFullHtml?.trim()) {
    return null;
  }

  return isFulltextVerificationPage({
    html: contentFullHtml,
    sourceUrl: input.contentFullSourceUrl ?? null,
  })
    ? null
    : contentFullHtml;
}

export function isFulltextPending(
  input: {
  contentFullHtml?: string | null;
  contentFullSourceUrl?: string | null;
  contentFullError?: string | null;
  },
  fullTextOnOpenEnabled: boolean | null,
): boolean {
  return (
    fullTextOnOpenEnabled === true &&
    !getUsableFulltextHtml(input) &&
    !input.contentFullError
  );
}
