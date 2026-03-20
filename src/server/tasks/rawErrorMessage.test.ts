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

  it('serializes structured provider payloads from error.error', () => {
    const err = new Error('OpenAI request failed');
    (
      err as Error & {
        error?: unknown;
      }
    ).error = {
      message: 'Invalid API key',
      type: 'invalid_request_error',
      code: 'invalid_api_key',
    };

    expect(toRawErrorMessage(err)).toBe(
      '{"message":"Invalid API key","type":"invalid_request_error","code":"invalid_api_key"}',
    );
  });

  it('serializes structured provider payloads from nested response data', () => {
    const err = new Error('Provider API error');
    (
      err as Error & {
        cause?: unknown;
      }
    ).cause = {
      response: {
        data: {
          error: {
            detail: 'quota exhausted',
            request_id: 'req_123',
          },
        },
      },
    };

    expect(toRawErrorMessage(err)).toBe('{"detail":"quota exhausted","request_id":"req_123"}');
  });

  it('redacts secret values inside serialized provider payloads', () => {
    const err = new Error('Provider API error');
    (
      err as Error & {
        error?: unknown;
      }
    ).error = {
      message: 'bad key',
      api_key: 'abc123',
      access_token: 'short-token',
    };

    expect(toRawErrorMessage(err)).toBe(
      '{"message":"bad key","api_key":"[REDACTED]","access_token":"[REDACTED]"}',
    );
  });
});
