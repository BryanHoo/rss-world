import { describe, expect, it } from 'vitest';
import { extractImmersiveSegments, hashSourceHtml } from './immersiveTranslationSession';

describe('immersiveTranslationSession', () => {
  it('extracts only p/h1-h6/li/blockquote segments in source order', () => {
    const segments = extractImmersiveSegments(
      '<article><h1>T</h1><p>A</p><td>X</td><li>B</li></article>',
    );
    expect(segments.map((s) => s.tagName)).toEqual(['h1', 'p', 'li']);
  });

  it('hashSourceHtml returns stable sha256 hash', () => {
    const hash = hashSourceHtml('<article><p>A</p></article>');
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashSourceHtml('<article><p>A</p></article>'));
  });
});
