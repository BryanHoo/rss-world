import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

describe('externalHttpClient (test harness)', () => {
  let closeServer: (() => Promise<void>) | null = null;
  let baseUrl = '';

  beforeEach(async () => {
    const server = createServer((req, res) => {
      res.statusCode = 200;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end('ok');
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    closeServer = async () => {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    };
  });

  afterEach(async () => {
    await closeServer?.();
  });

  it('boots local server and can import externalHttpClient', async () => {
    expect(baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    // 暂时仅验证模块可被 import（不关心导出内容）
    await import('./externalHttpClient');
  });
});
