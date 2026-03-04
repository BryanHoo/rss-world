import { describe, expect, it } from 'vitest';

describe('immersiveTranslateWorker', () => {
  it('continues translating when one segment fails and marks session partial_failed', async () => {
    const mod = await import('./immersiveTranslateWorker');

    const session = {
      id: 'session-1',
      articleId: 'a1',
      sourceHtmlHash: 'hash-1',
      status: 'running' as const,
      totalSegments: 3,
      translatedSegments: 0,
      failedSegments: 0,
      startedAt: '2026-03-04T00:00:00.000Z',
      finishedAt: null,
      createdAt: '2026-03-04T00:00:00.000Z',
      updatedAt: '2026-03-04T00:00:00.000Z',
    };

    const segments = [
      {
        id: 'seg-0',
        sessionId: 'session-1',
        segmentIndex: 0,
        sourceText: 'A',
        translatedText: null,
        status: 'pending' as const,
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: '2026-03-04T00:00:00.000Z',
        updatedAt: '2026-03-04T00:00:00.000Z',
      },
      {
        id: 'seg-1',
        sessionId: 'session-1',
        segmentIndex: 1,
        sourceText: 'B',
        translatedText: null,
        status: 'pending' as const,
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: '2026-03-04T00:00:00.000Z',
        updatedAt: '2026-03-04T00:00:00.000Z',
      },
      {
        id: 'seg-2',
        sessionId: 'session-1',
        segmentIndex: 2,
        sourceText: 'C',
        translatedText: null,
        status: 'pending' as const,
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: '2026-03-04T00:00:00.000Z',
        updatedAt: '2026-03-04T00:00:00.000Z',
      },
    ];

    const calls: Array<{ kind: string; status?: string; segmentIndex?: number }> = [];
    const state = new Map(segments.map((segment) => [segment.segmentIndex, { ...segment }]));

    const result = await mod.runImmersiveTranslateSession({
      pool: {} as never,
      articleId: 'a1',
      deps: {
        getTranslationSessionByArticleId: async () => session,
        listTranslationSegmentsBySessionId: async () =>
          Array.from(state.values()).sort((a, b) => a.segmentIndex - b.segmentIndex),
        upsertTranslationSegment: async (_pool, input) => {
          const prev = state.get(input.segmentIndex)!;
          const next = {
            ...prev,
            status: input.status,
            translatedText: input.translatedText ?? null,
            errorCode: input.errorCode ?? null,
            errorMessage: input.errorMessage ?? null,
          };
          state.set(input.segmentIndex, next);
          calls.push({ kind: 'segment', status: input.status, segmentIndex: input.segmentIndex });
          return next;
        },
        upsertTranslationSession: async (_pool, input) => {
          calls.push({ kind: 'session', status: input.status });
          return { ...session, ...input };
        },
        insertTranslationEvent: async () => ({
          eventId: 1,
          sessionId: session.id,
          segmentIndex: null,
          eventType: 'noop',
          payload: {},
          createdAt: '2026-03-04T00:00:00.000Z',
        }),
      },
      translateText: async ({ segmentIndex, sourceText }) => {
        if (segmentIndex === 1) {
          throw new Error('429 rate limit');
        }
        return `ZH:${sourceText}`;
      },
      concurrency: 3,
    });

    expect(result.status).toBe('partial_failed');
    expect(result.translatedSegments).toBe(2);
    expect(result.failedSegments).toBe(1);
    expect(state.get(0)?.status).toBe('succeeded');
    expect(state.get(1)?.status).toBe('failed');
    expect(state.get(2)?.status).toBe('succeeded');
    expect(calls.some((call) => call.kind === 'session' && call.status === 'partial_failed')).toBe(
      true,
    );
  });
});
