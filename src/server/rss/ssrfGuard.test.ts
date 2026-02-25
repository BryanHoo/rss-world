import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:dns/promises', () => {
  const lookup = vi.fn();
  return {
    lookup,
    default: { lookup },
  };
});

import { lookup } from 'node:dns/promises';
import { isSafeExternalUrl } from './ssrfGuard';

describe('ssrfGuard', () => {
  const lookupMock = vi.mocked(lookup);

  beforeEach(() => {
    lookupMock.mockReset();
  });

  it('rejects localhost ip', async () => {
    await expect(isSafeExternalUrl('http://127.0.0.1/feed')).resolves.toBe(false);
  });

  it('rejects localhost hostname', async () => {
    await expect(isSafeExternalUrl('http://localhost/feed')).resolves.toBe(false);
  });

  it('rejects non-http protocols', async () => {
    await expect(isSafeExternalUrl('ftp://example.com/feed')).resolves.toBe(false);
  });

  it('rejects urls with credentials', async () => {
    await expect(isSafeExternalUrl('https://user:pass@example.com/feed')).resolves.toBe(false);
  });

  it('rejects domains resolving to loopback', async () => {
    lookupMock.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    await expect(isSafeExternalUrl('https://internal.test/feed')).resolves.toBe(false);
  });

  it('accepts domains resolving to public ip', async () => {
    lookupMock.mockResolvedValue([{ address: '1.1.1.1', family: 4 }]);
    await expect(isSafeExternalUrl('https://public.test/feed')).resolves.toBe(true);
  });

  it('rejects domains with any unsafe ip', async () => {
    lookupMock.mockResolvedValue([
      { address: '1.1.1.1', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);
    await expect(isSafeExternalUrl('https://mixed.test/feed')).resolves.toBe(false);
  });
});
