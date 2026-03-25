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

type DeferredOperationTerminal = NonNullable<DeferredOperationRecord['terminal']>;
type ImmediateOperationTerminal = 'success' | 'error';

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

function getImmediateToastDedupeKey(
  terminal: ImmediateOperationTerminal,
  actionKey: UserOperationActionKey,
): string {
  return `user-operation:${terminal}:${actionKey}`;
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

  function setDeferredOperationTerminal(
    input: DeferredOperationInput & { err?: unknown },
    terminal: DeferredOperationTerminal,
  ): void {
    const key = getDeferredRegistryKey(input);
    const record = getOrCreateRecord(key);
    if (record.terminal) {
      return;
    }

    // 同一 deferred 操作只能写入一次终态，避免轮询或 SSE 重复回调造成双弹。
    record.started = true;
    record.terminal = terminal;
    const notify = terminal === 'success' ? toast.success : toast.error;
    const message =
      terminal === 'success'
        ? renderUserOperationSuccess(input.actionKey, input.context)
        : renderUserOperationFailure(input.actionKey, input.err, input.context);
    notify(message, { dedupeKey: getToastDedupeKey('finished', input) });
  }

  function resolveDeferredOperation(input: DeferredOperationInput): void {
    setDeferredOperationTerminal(input, 'success');
  }

  function failDeferredOperation(input: DeferredOperationInput & { err?: unknown }): void {
    setDeferredOperationTerminal(input, 'error');
  }

  function emitImmediateOperationTerminal(
    input: ImmediateTerminalInput,
    terminal: ImmediateOperationTerminal,
  ): void {
    const notify = terminal === 'success' ? toast.success : toast.error;
    const message =
      terminal === 'success'
        ? renderUserOperationSuccess(input.actionKey, input.context)
        : renderUserOperationFailure(input.actionKey, input.err, input.context);
    notify(message, {
      dedupeKey: getImmediateToastDedupeKey(terminal, input.actionKey),
    });
  }

  async function runImmediateOperation<T>(input: ImmediateOperationInput<T>): Promise<T> {
    try {
      const result = await input.execute();
      emitImmediateOperationTerminal(input, 'success');
      return result;
    } catch (err) {
      emitImmediateOperationTerminal(
        {
          actionKey: input.actionKey,
          context: input.context,
          err,
        },
        'error',
      );
      throw err;
    }
  }

  function runImmediateSuccess(input: ImmediateTerminalInput): void {
    emitImmediateOperationTerminal(input, 'success');
  }

  function runImmediateFailure(input: ImmediateTerminalInput): void {
    emitImmediateOperationTerminal(input, 'error');
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
