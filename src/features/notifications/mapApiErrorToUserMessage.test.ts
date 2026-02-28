import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/apiClient';
import { mapApiErrorToUserMessage } from './mapApiErrorToUserMessage';

describe('mapApiErrorToUserMessage', () => {
  it('maps ApiError conflict to friendly message', () => {
    const err = new ApiError('conflict', 'conflict');
    expect(mapApiErrorToUserMessage(err, 'rename-category')).toContain('已存在');
  });

  it('falls back to generic message for unknown error', () => {
    expect(mapApiErrorToUserMessage(new Error('boom'), 'save')).toBe('操作失败，请稍后重试。');
  });
});
