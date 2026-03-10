import { z } from 'zod';
import sharp from 'sharp';
import { getServerEnv } from '../../../../server/env';
import { fetchImageBytes } from '../../../../server/http/externalHttpClient';
import {
  getImageProxySecret,
  hasValidImageProxySignature,
} from '../../../../server/media/imageProxyUrl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  url: z.string().url(),
  w: z.coerce.number().int().positive().max(2048).optional(),
  h: z.coerce.number().int().positive().max(2048).optional(),
  q: z.coerce.number().int().positive().max(100).optional(),
  sig: z.string().min(1),
});

const MAX_REDIRECTS = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_TRANSFORM_QUALITY = 75;
const PASSTHROUGH_TRANSFORM_CONTENT_TYPES = new Set(['image/gif', 'image/svg+xml']);

function normalizeContentType(contentType: string): string {
  return contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

async function maybeTransformImage(input: {
  bytes: ArrayBuffer | Uint8Array;
  contentType: string;
  width?: number;
  height?: number;
  quality?: number;
}): Promise<{ bytes: Blob; contentType: string }> {
  const { bytes, contentType, width, height, quality } = input;
  const sourceBytes = new Uint8Array(bytes);
  const sourceBlob = new Blob([sourceBytes]);

  if (width === undefined && height === undefined && quality === undefined) {
    return { bytes: sourceBlob, contentType };
  }

  const normalizedContentType = normalizeContentType(contentType);
  if (PASSTHROUGH_TRANSFORM_CONTENT_TYPES.has(normalizedContentType)) {
    return { bytes: sourceBlob, contentType };
  }

  try {
    let pipeline = sharp(sourceBytes);

    if (width !== undefined || height !== undefined) {
      pipeline = pipeline.resize({
        width,
        height,
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: true,
      });
    }

    const transformed = await pipeline
      .webp({ quality: quality ?? DEFAULT_TRANSFORM_QUALITY })
      .toBuffer();
    const transformedBytes = Uint8Array.from(transformed);

    return {
      bytes: new Blob([transformedBytes]),
      contentType: 'image/webp',
    };
  } catch {
    return { bytes: sourceBlob, contentType };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    url: url.searchParams.get('url'),
    w: url.searchParams.get('w') ?? undefined,
    h: url.searchParams.get('h') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
    sig: url.searchParams.get('sig'),
  });

  if (!parsed.success) {
    return new Response('Bad request', { status: 400 });
  }

  const secret = getImageProxySecret(getServerEnv().IMAGE_PROXY_SECRET);
  if (
    !hasValidImageProxySignature({
      sourceUrl: parsed.data.url,
      width: parsed.data.w,
      height: parsed.data.h,
      quality: parsed.data.q,
      signature: parsed.data.sig,
      secret,
    })
  ) {
    return new Response('Forbidden', { status: 403 });
  }

  const upstream = await fetchImageBytes(parsed.data.url, {
    maxRedirects: MAX_REDIRECTS,
    maxBytes: MAX_BYTES,
    userAgent: 'FeedFuse Image Proxy/1.0',
  });

  if (upstream.kind === 'redirect_fallback') {
    return Response.redirect(parsed.data.url, 307);
  }

  if (upstream.kind === 'forbidden') {
    return new Response('Forbidden', { status: 403 });
  }

  if (upstream.kind === 'too_many_redirects') {
    return new Response('Too many redirects', { status: 502 });
  }

  if (upstream.kind === 'bad_gateway') {
    return new Response('Bad gateway', { status: 502 });
  }

  if (upstream.kind === 'unsupported_media_type') {
    return new Response('Unsupported media type', { status: 415 });
  }

  if (upstream.kind === 'too_large') {
    return new Response('Payload too large', { status: 413 });
  }

  const transformed = await maybeTransformImage({
    bytes: upstream.bytes,
    contentType: upstream.contentType,
    width: parsed.data.w,
    height: parsed.data.h,
    quality: parsed.data.q,
  });

  return new Response(transformed.bytes, {
    status: upstream.status,
    headers: {
      'content-type': transformed.contentType,
      'cache-control': upstream.cacheControl,
    },
  });
}
