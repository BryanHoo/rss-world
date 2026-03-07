import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('runtime dependencies', () => {
  it('keeps jsdom in dependencies for server translation routes', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.jsdom).toBeTruthy();
  });
});
