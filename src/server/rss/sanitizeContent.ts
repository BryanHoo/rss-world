import sanitizeHtml from 'sanitize-html';

const allowedTags = [...sanitizeHtml.defaults.allowedTags, 'img'];

const allowedAttributes: sanitizeHtml.IOptions['allowedAttributes'] = {
  ...sanitizeHtml.defaults.allowedAttributes,
  a: ['href', 'name', 'target', 'rel'],
  img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
};

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeUrl(value: string, base: URL | null): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;

  try {
    return base ? new URL(normalized, base) : new URL(normalized);
  } catch {
    return null;
  }
}

function isAllowedScheme(url: URL, allowed: readonly string[]): boolean {
  return allowed.includes(url.protocol);
}

function mergeRel(existing: string | undefined, required: string[]): string {
  const tokens = new Set<string>();
  (existing ?? '')
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .forEach((token) => tokens.add(token));

  required.forEach((token) => tokens.add(token));
  return Array.from(tokens).join(' ');
}

function normalizeSrcset(value: string, base: URL | null): string | null {
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const normalized = parts
    .map((part) => {
      const [rawUrl, ...descriptorParts] = part.split(/\s+/);
      if (!rawUrl) return null;
      const url = normalizeUrl(rawUrl, base);
      if (!url) return null;
      if (!isAllowedScheme(url, ['http:', 'https:'])) return null;

      const descriptor = descriptorParts.join(' ').trim();
      return descriptor ? `${url.toString()} ${descriptor}` : url.toString();
    })
    .filter((item): item is string => Boolean(item));

  return normalized.length ? normalized.join(', ') : null;
}

function normalizeNumeric(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? trimmed : undefined;
}

export function sanitizeContent(
  html: string | null | undefined,
  options: { baseUrl: string } | undefined = undefined,
): string | null {
  if (!html) return null;

  const base = options?.baseUrl ? parseUrl(options.baseUrl) : null;

  const cleaned = sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https'],
    },
    allowProtocolRelative: false,
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
    transformTags: {
      a: (tagName: string, attribs: sanitizeHtml.Attributes) => {
        const href = attribs.href?.trim();
        if (!href) {
          return { tagName, attribs };
        }

        if (href.startsWith('#')) {
          const rest: sanitizeHtml.Attributes = { ...attribs, href };
          delete rest['target'];
          delete rest['rel'];
          return { tagName, attribs: rest };
        }

        const url = normalizeUrl(href, base);
        if (!url) {
          const rest: sanitizeHtml.Attributes = { ...attribs };
          delete rest['href'];
          return { tagName, attribs: rest };
        }

        if (!isAllowedScheme(url, ['http:', 'https:', 'mailto:'])) {
          const rest: sanitizeHtml.Attributes = { ...attribs };
          delete rest['href'];
          return { tagName, attribs: rest };
        }

        if (url.protocol === 'mailto:') {
          const rest: sanitizeHtml.Attributes = { ...attribs, href: url.toString() };
          delete rest['target'];
          delete rest['rel'];
          return { tagName, attribs: rest };
        }

        return {
          tagName,
          attribs: {
            ...attribs,
            href: url.toString(),
            target: '_blank',
            rel: mergeRel(attribs.rel, ['noopener', 'noreferrer', 'ugc']),
          },
        };
      },
      img: (tagName: string, attribs: sanitizeHtml.Attributes) => {
        const rawSrc = (attribs.src ?? attribs['data-src'] ?? '').trim();
        const srcUrl = rawSrc ? normalizeUrl(rawSrc, base) : null;
        const src =
          srcUrl && isAllowedScheme(srcUrl, ['http:', 'https:']) ? srcUrl.toString() : undefined;

        const rawSrcset = (attribs.srcset ?? attribs['data-srcset'] ?? '').trim();
        const srcset = rawSrcset ? normalizeSrcset(rawSrcset, base) ?? undefined : undefined;

        const width = normalizeNumeric(attribs.width);
        const height = normalizeNumeric(attribs.height);

        return {
          tagName,
          attribs: {
            ...(src ? { src } : {}),
            ...(srcset ? { srcset } : {}),
            ...(attribs.alt ? { alt: attribs.alt } : {}),
            ...(attribs.title ? { title: attribs.title } : {}),
            ...(width ? { width } : {}),
            ...(height ? { height } : {}),
            loading: attribs.loading?.trim() ? attribs.loading : 'lazy',
            decoding: attribs.decoding?.trim() ? attribs.decoding : 'async',
          },
        };
      },
    },
  });

  const trimmed = cleaned.trim();
  return trimmed.length > 0 ? trimmed : null;
}
