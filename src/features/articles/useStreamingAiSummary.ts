import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createArticleAiSummaryEventSource,
  enqueueArticleAiSummary,
  getArticleAiSummarySnapshot,
  type ArticleAiSummarySessionSnapshotDto,
} from '../../lib/apiClient';
import { parseEventPayload } from '../../lib/utils';

export interface StreamingAiSummaryApi {
  enqueueArticleAiSummary: typeof enqueueArticleAiSummary;
  getArticleAiSummarySnapshot: typeof getArticleAiSummarySnapshot;
  createArticleAiSummaryEventSource: typeof createArticleAiSummaryEventSource;
}

interface UseStreamingAiSummaryInput {
  articleId: string | null;
  initialSession?: ArticleAiSummarySessionSnapshotDto | null;
  onCompleted?: (articleId: string) => Promise<void> | void;
  api?: StreamingAiSummaryApi;
}

export interface UseStreamingAiSummaryResult {
  loading: boolean;
  missingApiKey: boolean;
  waitingFulltext: boolean;
  session: ArticleAiSummarySessionSnapshotDto | null;
  requestSummary: (input?: { force?: boolean }) => Promise<void>;
  clearTransientState: () => void;
}

const defaultApi: StreamingAiSummaryApi = {
  enqueueArticleAiSummary,
  getArticleAiSummarySnapshot,
  createArticleAiSummaryEventSource,
};

function getUpdatedAtMs(session: { updatedAt?: string | null } | null): number {
  const updatedAt = session?.updatedAt;
  if (!updatedAt) return 0;
  const parsed = Date.parse(updatedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isPendingSession(session: ArticleAiSummarySessionSnapshotDto | null): boolean {
  return session?.status === 'queued' || session?.status === 'running';
}

type LocalState = {
  articleId: string | null;
  loading: boolean;
  missingApiKey: boolean;
  waitingFulltext: boolean;
  session: ArticleAiSummarySessionSnapshotDto | null;
};

export function useStreamingAiSummary(
  input: UseStreamingAiSummaryInput,
): UseStreamingAiSummaryResult {
  const api = useMemo(() => input.api ?? defaultApi, [input.api]);
  const [localState, setLocalState] = useState<LocalState>(() => {
    const initialSession = input.initialSession ?? null;
    return {
      articleId: input.articleId,
      loading: Boolean(input.articleId && isPendingSession(initialSession)),
      missingApiKey: false,
      waitingFulltext: false,
      session: initialSession,
    };
  });

  const articleIdRef = useRef<string | null>(input.articleId);
  const onCompletedRef = useRef(input.onCompleted);
  const initialSessionRef = useRef<ArticleAiSummarySessionSnapshotDto | null>(input.initialSession ?? null);
  const requestTokenRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onCompletedRef.current = input.onCompleted;
  }, [input.onCompleted]);

  useEffect(() => {
    articleIdRef.current = input.articleId;
    initialSessionRef.current = input.initialSession ?? null;
  }, [input.articleId, input.initialSession]);

  const session = useMemo(() => {
    const baseSession = input.initialSession ?? null;
    const localSession =
      localState.articleId === input.articleId ? localState.session : null;

    if (!localSession) return baseSession;
    if (!baseSession) return localSession;
    return getUpdatedAtMs(baseSession) > getUpdatedAtMs(localSession) ? baseSession : localSession;
  }, [input.articleId, input.initialSession, localState.articleId, localState.session]);

  const loading = useMemo(() => {
    const currentArticleMatches = localState.articleId === input.articleId;
    return Boolean((currentArticleMatches && localState.loading) || isPendingSession(session));
  }, [input.articleId, localState.articleId, localState.loading, session]);

  const missingApiKey = useMemo(() => {
    return localState.articleId === input.articleId ? localState.missingApiKey : false;
  }, [input.articleId, localState.articleId, localState.missingApiKey]);

  const waitingFulltext = useMemo(() => {
    return localState.articleId === input.articleId ? localState.waitingFulltext : false;
  }, [input.articleId, localState.articleId, localState.waitingFulltext]);

  const closeStream = useCallback(() => {
    streamCleanupRef.current?.();
    streamCleanupRef.current = null;
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  const isCurrentRequest = useCallback((articleId: string, token: number): boolean => {
    return articleIdRef.current === articleId && requestTokenRef.current === token;
  }, []);

  const connectStream = useCallback(
    (articleId: string, token: number) => {
      if (!isCurrentRequest(articleId, token)) return;

      closeStream();
      const stream = api.createArticleAiSummaryEventSource(articleId);
      eventSourceRef.current = stream;

      const onSummaryDelta: EventListener = (event) => {
        if (!isCurrentRequest(articleId, token)) return;
        const payload = parseEventPayload(event);
        const deltaText = typeof payload.deltaText === 'string' ? payload.deltaText : '';
        if (!deltaText) return;

        setLocalState((current) => {
          const baseSession =
            current.articleId === articleId ? current.session : initialSessionRef.current;
          if (!baseSession) return current;

          return {
            articleId,
            loading: true,
            missingApiKey: current.articleId === articleId ? current.missingApiKey : false,
            waitingFulltext: current.articleId === articleId ? current.waitingFulltext : false,
            session: {
              ...baseSession,
              status: baseSession.status === 'queued' ? 'running' : baseSession.status,
              draftText: `${baseSession.draftText}${deltaText}`,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      };

      const onSummarySnapshot: EventListener = (event) => {
        if (!isCurrentRequest(articleId, token)) return;
        const payload = parseEventPayload(event);
        if (typeof payload.draftText !== 'string') return;
        const draftText = payload.draftText;

        setLocalState((current) => {
          const baseSession =
            current.articleId === articleId ? current.session : initialSessionRef.current;
          if (!baseSession) return current;

          return {
            articleId,
            loading: true,
            missingApiKey: current.articleId === articleId ? current.missingApiKey : false,
            waitingFulltext: current.articleId === articleId ? current.waitingFulltext : false,
            session: {
              ...baseSession,
              draftText,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      };

      const onSessionCompleted: EventListener = (event) => {
        if (!isCurrentRequest(articleId, token)) return;
        const payload = parseEventPayload(event);

        setLocalState((current) => {
          const baseSession =
            current.articleId === articleId ? current.session : initialSessionRef.current;
          if (!baseSession) return current;

          const finalText =
            typeof payload.finalText === 'string' && payload.finalText.trim()
              ? payload.finalText
              : baseSession.draftText;

          return {
            articleId,
            loading: false,
            missingApiKey: current.articleId === articleId ? current.missingApiKey : false,
            waitingFulltext: current.articleId === articleId ? current.waitingFulltext : false,
            session: {
              ...baseSession,
              status: 'succeeded',
              draftText: finalText,
              finalText,
              errorCode: null,
              errorMessage: null,
              finishedAt: baseSession.finishedAt ?? new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          };
        });
        closeStream();
        void Promise.resolve(onCompletedRef.current?.(articleId)).catch((err) => {
          console.error(err);
        });
      };

      const onSessionFailed: EventListener = (event) => {
        if (!isCurrentRequest(articleId, token)) return;
        const payload = parseEventPayload(event);

        setLocalState((current) => {
          const baseSession =
            current.articleId === articleId ? current.session : initialSessionRef.current;
          if (!baseSession) return current;

          return {
            articleId,
            loading: false,
            missingApiKey: current.articleId === articleId ? current.missingApiKey : false,
            waitingFulltext: current.articleId === articleId ? current.waitingFulltext : false,
            session: {
              ...baseSession,
              status: 'failed',
              draftText: typeof payload.draftText === 'string' ? payload.draftText : baseSession.draftText,
              errorCode: typeof payload.errorCode === 'string' ? payload.errorCode : null,
              errorMessage: typeof payload.errorMessage === 'string' ? payload.errorMessage : null,
              finishedAt: baseSession.finishedAt ?? new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          };
        });
        closeStream();
      };

      stream.addEventListener('summary.delta', onSummaryDelta);
      stream.addEventListener('summary.snapshot', onSummarySnapshot);
      stream.addEventListener('session.completed', onSessionCompleted);
      stream.addEventListener('session.failed', onSessionFailed);

      streamCleanupRef.current = () => {
        stream.removeEventListener('summary.delta', onSummaryDelta);
        stream.removeEventListener('summary.snapshot', onSummarySnapshot);
        stream.removeEventListener('session.completed', onSessionCompleted);
        stream.removeEventListener('session.failed', onSessionFailed);
      };
    },
    [api, closeStream, isCurrentRequest],
  );

  const loadSnapshot = useCallback(
    async (articleId: string, token: number) => {
      const snapshot = await api.getArticleAiSummarySnapshot(articleId);
      if (!isCurrentRequest(articleId, token)) return null;

      setLocalState((current) => {
        const base: LocalState =
          current.articleId === articleId
            ? current
            : {
                articleId,
                loading: false,
                missingApiKey: false,
                waitingFulltext: false,
                session: null,
              };

        return {
          ...base,
          articleId,
          session: snapshot.session,
          loading: isPendingSession(snapshot.session),
        };
      });

      if (isPendingSession(snapshot.session)) {
        connectStream(articleId, token);
      } else {
        closeStream();
      }

      return snapshot;
    },
    [api, closeStream, connectStream, isCurrentRequest],
  );

  const lastArticleIdRef = useRef<string | null>(input.articleId);

  useEffect(() => {
    const currentArticleId = input.articleId;
    if (lastArticleIdRef.current === currentArticleId) return;

    lastArticleIdRef.current = currentArticleId;
    requestTokenRef.current += 1;
    closeStream();
  }, [closeStream, input.articleId]);

  useEffect(() => {
    if (!input.articleId) return;
    if (!isPendingSession(session)) return;
    if (eventSourceRef.current) return;

    const token = requestTokenRef.current;
    connectStream(input.articleId, token);
  }, [connectStream, input.articleId, session]);

  useEffect(() => {
    return () => {
      closeStream();
    };
  }, [closeStream]);

  const requestSummary = useCallback(
    async (options?: { force?: boolean }) => {
      const articleId = input.articleId;
      if (!articleId) return;

      const token = requestTokenRef.current + 1;
      requestTokenRef.current = token;
      const force = Boolean(options?.force);

      closeStream();
      setLocalState((current) => {
        const baseSession =
          current.articleId === articleId ? current.session : initialSessionRef.current;

        return {
          articleId,
          loading: true,
          missingApiKey: false,
          waitingFulltext: false,
          session: baseSession,
        };
      });

      try {
        const enqueueResult = force
          ? await api.enqueueArticleAiSummary(articleId, { force: true })
          : await api.enqueueArticleAiSummary(articleId);
        if (!isCurrentRequest(articleId, token)) return;

        if (enqueueResult.reason === 'missing_api_key') {
          setLocalState((current) =>
            current.articleId === articleId
              ? { ...current, loading: false, missingApiKey: true }
              : current,
          );
          return;
        }

        if (enqueueResult.reason === 'fulltext_pending') {
          setLocalState((current) =>
            current.articleId === articleId
              ? { ...current, loading: false, waitingFulltext: true }
              : current,
          );
          return;
        }

        if (enqueueResult.reason === 'already_summarized') {
          setLocalState((current) =>
            current.articleId === articleId ? { ...current, loading: false } : current,
          );
          closeStream();
          return;
        }

        if (enqueueResult.enqueued || enqueueResult.reason === 'already_enqueued') {
          await loadSnapshot(articleId, token);
          return;
        }

        setLocalState((current) =>
          current.articleId === articleId ? { ...current, loading: false } : current,
        );
      } catch (err) {
        console.error(err);
        if (!isCurrentRequest(articleId, token)) return;
        setLocalState((current) =>
          current.articleId === articleId ? { ...current, loading: false } : current,
        );
      }
    },
    [api, closeStream, input.articleId, isCurrentRequest, loadSnapshot],
  );

  const clearTransientState = useCallback(() => {
    const articleId = input.articleId;
    if (!articleId) return;

    setLocalState((current) =>
      current.articleId === articleId
        ? { ...current, missingApiKey: false, waitingFulltext: false }
        : current,
    );
  }, [input.articleId]);

  return {
    loading,
    missingApiKey,
    waitingFulltext,
    session,
    requestSummary,
    clearTransientState,
  };
}
