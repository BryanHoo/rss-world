import { describe, expect, it } from 'vitest';
import { numericIdSchema } from './idSchemas';

describe('numericIdSchema', () => {
  it('accepts positive integer strings', () => {
    expect(numericIdSchema.parse('1')).toBe('1');
    expect(numericIdSchema.parse('9007199254740993')).toBe('9007199254740993');
  });

  it('rejects non-digit formats', () => {
    expect(() => numericIdSchema.parse('abc')).toThrow();
    expect(() => numericIdSchema.parse('-1')).toThrow();
    expect(() => numericIdSchema.parse('1.2')).toThrow();
    expect(() => numericIdSchema.parse('001')).toThrow();
  });
});
