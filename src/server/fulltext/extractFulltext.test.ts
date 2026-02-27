import { describe, expect, it } from 'vitest';
import { extractFulltext } from './extractFulltext';

describe('extractFulltext', () => {
  it('extracts main content via Readability', () => {
    const html = `
      <html><head><title>T</title></head>
      <body>
        <header>nav</header>
        <main>
          <article><h1>Hello</h1><p>World</p></article>
        </main>
      </body></html>
    `;
    const result = extractFulltext({ html, url: 'https://example.com/a' });
    expect(result?.contentHtml).toContain('World');
  });
});

