'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import NotificationViewport from './NotificationViewport';
import type { NotificationItem, NotificationType } from './types';

const TTL_BY_TYPE: Record<NotificationType, number> = {
  success: 1800,
  info: 2500,
  error: 4500,
};

const DEDUPE_WINDOW_MS = 1500;
const MAX_STACK = 3;

interface NotificationContextValue {
  notifications: NotificationItem[];
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function generateNotificationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createTrimmedStack(input: NotificationItem[]): { next: NotificationItem[]; removedIds: string[] } {
  if (input.length <= MAX_STACK) {
    return { next: input, removedIds: [] };
  }

  const next = [...input];
  const removedIds: string[] = [];

  while (next.length > MAX_STACK) {
    const removableIndex = next.findIndex((item) => item.type !== 'error');
    const targetIndex = removableIndex >= 0 ? removableIndex : 0;
    const [removed] = next.splice(targetIndex, 1);
    if (removed) {
      removedIds.push(removed.id);
    }
  }

  return { next, removedIds };
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const timeoutByIdRef = useRef<Map<string, number>>(new Map());
  const dedupeByKeyRef = useRef<Map<string, number>>(new Map());

  const clearDismissTimer = useCallback((id: string) => {
    const timeoutId = timeoutByIdRef.current.get(id);
    if (typeof timeoutId === 'number') {
      window.clearTimeout(timeoutId);
      timeoutByIdRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearDismissTimer(id);
      setNotifications((prev) => prev.filter((item) => item.id !== id));
    },
    [clearDismissTimer],
  );

  const push = useCallback(
    (type: NotificationType, rawMessage: string) => {
      const message = rawMessage.trim();
      if (!message) return;

      const now = Date.now();
      const dedupeKey = `${type}:${message}`;
      const lastSeenAt = dedupeByKeyRef.current.get(dedupeKey);
      if (typeof lastSeenAt === 'number' && now - lastSeenAt <= DEDUPE_WINDOW_MS) {
        return;
      }
      dedupeByKeyRef.current.set(dedupeKey, now);

      const id = generateNotificationId();
      const item: NotificationItem = { id, type, message, createdAt: now };

      setNotifications((prev) => {
        const { next, removedIds } = createTrimmedStack([...prev, item]);
        removedIds.forEach(clearDismissTimer);
        return next;
      });

      const timeoutId = window.setTimeout(() => {
        dismiss(id);
      }, TTL_BY_TYPE[type]);
      timeoutByIdRef.current.set(id, timeoutId);
    },
    [clearDismissTimer, dismiss],
  );

  useEffect(() => {
    const timeoutById = timeoutByIdRef.current;
    return () => {
      timeoutById.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeoutById.clear();
    };
  }, []);

  const contextValue = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
      dismiss,
    }),
    [dismiss, notifications, push],
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationViewport />
    </NotificationContext.Provider>
  );
}

export function useNotificationContext(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotify must be used within NotificationProvider');
  }

  return context;
}
