import { describe, expect, it } from 'vitest';
import { parseFeed } from './parseFeed';
import { sanitizeContent } from './sanitizeContent';
import fs from 'node:fs/promises';
import path from 'node:path';

async function readFixture(name: string) {
  return fs.readFile(
    path.join(process.cwd(), 'src/server/rss/__fixtures__', name),
    'utf8',
  );
}

describe('rss parsing', () => {
  it('parses RSS feed title and items', async () => {
    const xml = await readFixture('rss.xml');
    const fetchedAt = new Date('2026-02-25T12:00:00Z');

    const feed = await parseFeed(xml, fetchedAt);

    expect(feed.title).toBe('Example RSS');
    expect(feed.items[0].title).toBe('Item 1');
    expect(feed.items[0].link).toBe('https://example.com/item1');
    expect(feed.items[0].publishedAt.toISOString()).toBe('2026-02-25T00:00:00.000Z');
    expect(feed.items[1].publishedAt.toISOString()).toBe(fetchedAt.toISOString());
  });

  it('parses Atom feed title and items', async () => {
    const xml = await readFixture('atom.xml');
    const fetchedAt = new Date('2026-02-25T12:00:00Z');

    const feed = await parseFeed(xml, fetchedAt);

    expect(feed.title).toBe('Example Atom');
    expect(feed.items[0].title).toBe('Atom Item 1');
    expect(feed.items[0].link).toBe('https://example.com/atom1');
    expect(feed.items[0].publishedAt.toISOString()).toBe('2026-02-25T00:00:00.000Z');
  });

  it('sanitizes scripts and event handlers', () => {
    const cleaned = sanitizeContent(
      '<p>Hi</p><script>alert(1)</script><img src="https://example.com/a.png" onerror="alert(1)" />',
    );
    expect(cleaned).toContain('<p>Hi</p>');
    expect(cleaned).toContain('<img');
    expect(cleaned).toContain('src="https://example.com/a.png"');
    expect(cleaned).not.toContain('<script');
    expect(cleaned).not.toContain('onerror');
  });
});
