import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseEventPayload(event: Event): Record<string, unknown> {
  if (!(event instanceof MessageEvent)) return {};
  if (typeof event.data !== 'string') return {};

  try {
    const parsed: unknown = JSON.parse(event.data);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

