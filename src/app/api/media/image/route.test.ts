import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { buildImageProxyUrl } from '../../../../server/media/imageProxyUrl';

const fetchImageBytesMock = vi.fn();

vi.mock('../../../../server/http/externalHttpClient', () => ({
  fetchImageBytes: (...args: unknown[]) => fetchImageBytesMock(...args),
}));

describe('/api/media/image', () => {
  beforeEach(() => {
    fetchImageBytesMock.mockReset();
    vi.unstubAllEnvs();
    vi.stubEnv('DATABASE_URL', 'postgres://example');
    vi.stubEnv('IMAGE_PROXY_SECRET', 'test-image-proxy-secret');
  });

  it('proxies image bytes for a valid signed request', async () => {
    fetchImageBytesMock.mockResolvedValue({
      kind: 'ok',
      status: 200,
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=600',
      bytes: Buffer.from([1, 2, 3]),
    });

    const proxied = buildImageProxyUrl({
      sourceUrl: 'https://img.example.com/a.jpg',
      secret: 'test-image-proxy-secret',
    });

    const mod = await import('./route');
    const res = await mod.GET(new Request(`http://localhost${proxied}`));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(fetchImageBytesMock).toHaveBeenCalled();
  });

  it('sends a same-origin referer to upstream image hosts', async () => {
    fetchImageBytesMock.mockResolvedValue({
      kind: 'ok',
      status: 200,
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=600',
      bytes: Buffer.from([1, 2, 3]),
    });

    const proxied = buildImageProxyUrl({
      sourceUrl: 'https://cdnfile.sspai.com/2026/02/25/cover.jpg',
      secret: 'test-image-proxy-secret',
    });

    const mod = await import('./route');
    const res = await mod.GET(new Request(`http://localhost${proxied}`));

    expect(res.status).toBe(200);
    expect(fetchImageBytesMock).toHaveBeenCalledWith(
      'https://cdnfile.sspai.com/2026/02/25/cover.jpg',
      expect.objectContaining({
        maxRedirects: 3,
        maxBytes: 5 * 1024 * 1024,
        userAgent: 'FeedFuse Image Proxy/1.0',
      }),
    );
  });

  it('redirects to the original image when upstream returns a non-success status', async () => {
    fetchImageBytesMock.mockResolvedValue({ kind: 'redirect_fallback' });

    const proxied = buildImageProxyUrl({
      sourceUrl: 'https://img.example.com/rate-limited.jpg',
      secret: 'test-image-proxy-secret',
    });

    const mod = await import('./route');
    const res = await mod.GET(new Request(`http://localhost${proxied}`));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://img.example.com/rate-limited.jpg');
  });

  it('rejects an invalid signature', async () => {
    const mod = await import('./route');
    const res = await mod.GET(
      new Request(
        'http://localhost/api/media/image?url=https%3A%2F%2Fimg.example.com%2Fa.jpg&sig=bad',
      ),
    );

    expect(res.status).toBe(403);
    expect(fetchImageBytesMock).not.toHaveBeenCalled();
  });

  it('rejects non-image upstream responses', async () => {
    fetchImageBytesMock.mockResolvedValue({ kind: 'unsupported_media_type' });

    const proxied = buildImageProxyUrl({
      sourceUrl: 'https://img.example.com/not-image',
      secret: 'test-image-proxy-secret',
    });

    const mod = await import('./route');
    const res = await mod.GET(new Request(`http://localhost${proxied}`));

    expect(res.status).toBe(415);
  });

  it('rejects redirects that end at private targets', async () => {
    fetchImageBytesMock.mockResolvedValue({ kind: 'forbidden' });

    const proxied = buildImageProxyUrl({
      sourceUrl: 'https://img.example.com/redirect.jpg',
      secret: 'test-image-proxy-secret',
    });

    const mod = await import('./route');
    const res = await mod.GET(new Request(`http://localhost${proxied}`));

    expect(res.status).toBe(403);
  });

  it('resizes and compresses signed preview image requests', async () => {
    const sourceImage = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 120, g: 140, b: 160 },
      },
    })
      .jpeg({ quality: 92 })
      .toBuffer();

    fetchImageBytesMock.mockResolvedValue({
      kind: 'ok',
      status: 200,
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=600',
      bytes: sourceImage,
    });

    const proxied = buildImageProxyUrl({
      sourceUrl: 'https://img.example.com/a.jpg',
      secret: 'test-image-proxy-secret',
      width: 192,
      height: 208,
      quality: 55,
    });

    const mod = await import('./route');
    const res = await mod.GET(new Request(`http://localhost${proxied}`));
    const transformedBytes = Buffer.from(await res.arrayBuffer());
    const metadata = await sharp(transformedBytes).metadata();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(192);
    expect(metadata.height).toBe(208);
    expect(transformedBytes.byteLength).toBeLessThan(sourceImage.byteLength);
  });
});
