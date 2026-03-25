'use client';

import type { ToastOptions } from '../toast/toast';
import { toast as defaultToast } from '../toast/toast';
import {
  type UserOperationActionKey,
  renderUserOperationFailure,
  renderUserOperationStarted,
  renderUserOperationSuccess,
} from '../../lib/userOperationCatalog';

type ToastAdapter = {
  success: (message: string, options?: ToastOptions) => string | void;
  info: (message: string, options?: ToastOptions) => string | void;
  error: (message: string, options?: ToastOptions) => string | void;
};

type DeferredOperationRecord = {
  started: boolean;
  terminal: 'success' | 'error' | null;
};

type DeferredOperationInput = {
  actionKey: UserOperationActionKey;
  trackingKey: string;
  context?: Record<string, unknown>;
};

type ImmediateOperationInput<T> = {
  actionKey: UserOperationActionKey;
  execute: () => Promise<T>;
  context?: Record<string, unknown>;
};

type ImmediateTerminalInput = {
  actionKey: UserOperationActionKey;
  context?: Record<string, unknown>;
  err?: unknown;
};

function getDeferredRegistryKey(input: DeferredOperationInput): string {
  return `${input.actionKey}:${input.trackingKey}`;
}

function getToastDedupeKey(prefix: string, input: DeferredOperationInput): string {
  return `user-operation:${prefix}:${input.actionKey}:${input.trackingKey}`;
}

export function createUserOperationNotifier(input?: { toast?: ToastAdapter }) {
  const toast = input?.toast ?? defaultToast;
  const deferredRegistry = new Map<string, DeferredOperationRecord>();

  function getOrCreateRecord(key: string): DeferredOperationRecord {
    const existing = deferredRegistry.get(key);
    if (existing) {
      return existing;
    }

    const created: DeferredOperationRecord = { started: false, terminal: null };
    deferredRegistry.set(key, created);
    return created;
  }

  function beginDeferredOperation(input: DeferredOperationInput): void {
    const key = getDeferredRegistryKey(input);
    const record = getOrCreateRecord(key);
    if (record.started) {
      return;
    }

    record.started = true;
    toast.info(renderUserOperationStarted(input.actionKey, input.context), {
      dedupeKey: getToastDedupeKey('started', input),
    });
  }

  function resolveDeferredOperation(input: DeferredOperationInput): void {
    const key = getDeferredRegistryKey(input);
    const record = getOrCreateRecord(key);
    if (record.terminal) {
      return;
    }

    // 同一 deferred 操作只能写入一次终态，避免轮询或 SSE 重复回调造成双弹。
    record.started = true;
    record.terminal = 'success';
    toast.success(renderUserOperationSuccess(input.actionKey, input.context), {
      dedupeKey: getToastDedupeKey('finished', input),
    });
  }

  function failDeferredOperation(input: DeferredOperationInput & { err?: unknown }): void {
    const key = getDeferredRegistryKey(input);
    const record = getOrCreateRecord(key);
    if (record.terminal) {
      return;
    }

    // 同一 deferred 操作只能写入一次终态，避免轮询或 SSE 重复回调造成双弹。
    record.started = true;
    record.terminal = 'error';
    toast.error(renderUserOperationFailure(input.actionKey, input.err, input.context), {
      dedupeKey: getToastDedupeKey('finished', input),
    });
  }

  async function runImmediateOperation<T>(input: ImmediateOperationInput<T>): Promise<T> {
    try {
      const result = await input.execute();
      toast.success(renderUserOperationSuccess(input.actionKey, input.context), {
        dedupeKey: `user-operation:success:${input.actionKey}`,
      });
      return result;
    } catch (err) {
      toast.error(renderUserOperationFailure(input.actionKey, err, input.context), {
        dedupeKey: `user-operation:error:${input.actionKey}`,
      });
      throw err;
    }
  }

  function runImmediateSuccess(input: ImmediateTerminalInput): void {
    toast.success(renderUserOperationSuccess(input.actionKey, input.context), {
      dedupeKey: `user-operation:success:${input.actionKey}`,
    });
  }

  function runImmediateFailure(input: ImmediateTerminalInput): void {
    toast.error(renderUserOperationFailure(input.actionKey, input.err, input.context), {
      dedupeKey: `user-operation:error:${input.actionKey}`,
    });
  }

  return {
    beginDeferredOperation,
    resolveDeferredOperation,
    failDeferredOperation,
    runImmediateOperation,
    runImmediateSuccess,
    runImmediateFailure,
  };
}

const defaultUserOperationNotifier = createUserOperationNotifier();

export const beginDeferredOperation =
  defaultUserOperationNotifier.beginDeferredOperation;
export const resolveDeferredOperation =
  defaultUserOperationNotifier.resolveDeferredOperation;
export const failDeferredOperation =
  defaultUserOperationNotifier.failDeferredOperation;
export const runImmediateOperation =
  defaultUserOperationNotifier.runImmediateOperation;
export const runImmediateSuccess =
  defaultUserOperationNotifier.runImmediateSuccess;
export const runImmediateFailure =
  defaultUserOperationNotifier.runImmediateFailure;
