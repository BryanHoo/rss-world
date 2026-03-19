import { describe, expect, it } from 'vitest';

import { toRawErrorMessage } from './rawErrorMessage';

describe('rawErrorMessage', () => {
  it('redacts bearer tokens', () => {
    const raw = toRawErrorMessage('Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456');

    expect(raw).toBe('Authorization: Bearer [REDACTED]');
  });

  it('extracts error messages and normalizes whitespace', () => {
    const raw = toRawErrorMessage(new Error('Bearer token-123   api_key=test-key\nnext line'));

    expect(raw).toBe('Bearer [REDACTED] api_key=[REDACTED] next line');
  });

  it('redacts long secret-like tokens', () => {
    const raw = toRawErrorMessage('provider secret abcdefghijklmnopqrstuvwxyz123456');

    expect(raw).toBe('provider secret [REDACTED]');
  });

  it('limits raw message length to 800 chars', () => {
    const raw = toRawErrorMessage(`Error: ${'a'.repeat(1200)}`);

    expect(raw).not.toBeNull();
    expect(raw!.length).toBeLessThanOrEqual(800);
  });

  it('returns null for blank values', () => {
    expect(toRawErrorMessage('   \n\t  ')).toBeNull();
  });

  it('returns null when the error text cannot be extracted', () => {
    expect(toRawErrorMessage({ message: 'ignored' })).toBeNull();
  });
});
