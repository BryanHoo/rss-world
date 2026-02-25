import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('/api/health', () => {
  it('returns ok', async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.ok).toBe(true);
  });
});

