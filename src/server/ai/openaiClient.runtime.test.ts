import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('openaiClient runtime compatibility', () => {
  it('can be imported by tsx runtime (worker context)', () => {
    const tsxCli = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');
    const target = pathToFileURL(
      path.resolve(process.cwd(), 'src/server/ai/openaiClient.ts'),
    ).href;

    const result = spawnSync(
      process.execPath,
      [tsxCli, '-e', `import ${JSON.stringify(target)};`],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(0);
  });
});
