import { beforeEach, describe, expect, it, vi } from 'vitest';

const pool = {};
const articleId = '00000000-0000-0000-0000-000000000000';

const getArticleByIdMock = vi.fn();
const getActiveAiSummarySessionByArticleIdMock = vi.fn();
const listAiSummaryEventsAfterMock = vi.fn();

vi.mock('../../../../../../server/db/pool', () => ({
  getPool: () => pool,
}));
vi.mock('../../../../../../server/repositories/articlesRepo', () => ({
  getArticleById: (...args: unknown[]) => getArticleByIdMock(...args),
}));
vi.mock('../../../../../../server/repositories/articleAiSummaryRepo', () => ({
  getActiveAiSummarySessionByArticleId: (...args: unknown[]) =>
    getActiveAiSummarySessionByArticleIdMock(...args),
  listAiSummaryEventsAfter: (...args: unknown[]) => listAiSummaryEventsAfterMock(...args),
}));

describe('ai-summary stream route', () => {
  beforeEach(() => {
    getArticleByIdMock.mockReset();
    getActiveAiSummarySessionByArticleIdMock.mockReset();
    listAiSummaryEventsAfterMock.mockReset();
  });

  it('SSE stream replays summary events after Last-Event-ID', async () => {
    getArticleByIdMock.mockResolvedValue({
      id: articleId,
      feedId: '22222222-2222-2222-8222-222222222222',
    });
    getActiveAiSummarySessionByArticleIdMock.mockResolvedValue({
      id: 'summary-session-id-1',
      articleId,
      sourceTextHash: 'hash-1',
      status: 'running',
      draftText: 'TL;DR',
      finalText: null,
      model: 'gpt-4o-mini',
      jobId: 'job-id-1',
      errorCode: null,
      errorMessage: null,
      supersededBySessionId: null,
      startedAt: '2026-03-09T00:00:00.000Z',
      finishedAt: null,
      createdAt: '2026-03-09T00:00:00.000Z',
      updatedAt: '2026-03-09T00:00:10.000Z',
    });
    listAiSummaryEventsAfterMock.mockResolvedValue([
      {
        eventId: 8,
        sessionId: 'summary-session-id-1',
        eventType: 'summary.delta',
        payload: { deltaText: ' 第一条' },
        createdAt: '2026-03-09T00:00:11.000Z',
      },
    ]);

    const mod = await import('./route');
    const abortController = new AbortController();
    const res = await mod.GET(
      new Request(`http://localhost/api/articles/${articleId}/ai-summary/stream`, {
        headers: { 'last-event-id': '7' },
        signal: abortController.signal,
      }),
      { params: Promise.resolve({ id: articleId }) },
    );

    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body?.getReader();
    expect(reader).toBeTruthy();
    const firstChunk = await reader!.read();
    const text = new TextDecoder().decode(firstChunk.value ?? new Uint8Array());

    expect(text).toContain('id: 8');
    expect(text).toContain('event: summary.delta');
    expect(text).toContain('"deltaText":" 第一条"');

    await reader!.cancel();
    abortController.abort();
  });
});
