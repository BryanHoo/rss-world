import { describe, expect, it } from 'vitest';
import { ValidationError } from './errors';

describe('errors', () => {
  it('serializes validation fields', () => {
    const err = new ValidationError('bad', { url: 'invalid' });
    expect(err.fields.url).toBe('invalid');
  });
});

