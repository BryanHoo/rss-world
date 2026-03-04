import { beforeEach, describe, expect, it, vi } from 'vitest';

const pool = {};
const articleId = '00000000-0000-0000-0000-000000000000';

const getArticleByIdMock = vi.fn();
const getTranslationSessionByArticleIdMock = vi.fn();
const listTranslationEventsAfterMock = vi.fn();

vi.mock('../../../../../../server/db/pool', () => ({
  getPool: () => pool,
}));
vi.mock('../../../../../../server/repositories/articlesRepo', () => ({
  getArticleById: (...args: unknown[]) => getArticleByIdMock(...args),
}));
vi.mock('../../../../../../server/repositories/articleTranslationRepo', () => ({
  getTranslationSessionByArticleId: (...args: unknown[]) =>
    getTranslationSessionByArticleIdMock(...args),
  listTranslationEventsAfter: (...args: unknown[]) => listTranslationEventsAfterMock(...args),
}));

describe('ai-translate stream route', () => {
  beforeEach(() => {
    getArticleByIdMock.mockReset();
    getTranslationSessionByArticleIdMock.mockReset();
    listTranslationEventsAfterMock.mockReset();
  });

  it('SSE stream replays events after Last-Event-ID', async () => {
    getArticleByIdMock.mockResolvedValue({
      id: articleId,
      feedId: '22222222-2222-2222-8222-222222222222',
    });
    getTranslationSessionByArticleIdMock.mockResolvedValue({
      id: 'session-id-1',
      articleId,
      sourceHtmlHash: 'hash-1',
      status: 'running',
      totalSegments: 2,
      translatedSegments: 1,
      failedSegments: 0,
      startedAt: '2026-03-04T00:00:00.000Z',
      finishedAt: null,
      createdAt: '2026-03-04T00:00:00.000Z',
      updatedAt: '2026-03-04T00:00:00.000Z',
    });
    listTranslationEventsAfterMock.mockResolvedValue([
      {
        eventId: 6,
        sessionId: 'session-id-1',
        segmentIndex: 1,
        eventType: 'segment.succeeded',
        payload: { segmentIndex: 1, translatedText: '你好' },
        createdAt: '2026-03-04T00:00:01.000Z',
      },
    ]);

    const mod = await import('./route');
    const abortController = new AbortController();
    const res = await mod.GET(
      new Request(`http://localhost/api/articles/${articleId}/ai-translate/stream`, {
        headers: { 'last-event-id': '5' },
        signal: abortController.signal,
      }),
      { params: Promise.resolve({ id: articleId }) },
    );

    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body?.getReader();
    expect(reader).toBeTruthy();
    const firstChunk = await reader!.read();
    const text = new TextDecoder().decode(firstChunk.value ?? new Uint8Array());

    expect(text).toContain('id: 6');
    expect(text).toContain('event: segment.succeeded');
    expect(text).toContain('"segmentIndex":1');

    await reader!.cancel();
    abortController.abort();
  });
});
