import { describe, expect, it } from 'vitest';
import {
  buildArticleOutlineMarkers,
  extractArticleOutline,
  getActiveArticleOutlineHeadingId,
} from './articleOutline';

describe('extractArticleOutline', () => {
  it('extracts only h1 h2 h3 and assigns stable unique ids', () => {
    document.body.innerHTML = `
      <div>
        <h2>Overview</h2>
        <p>Body</p>
        <h4>Ignore me</h4>
        <h2>Overview</h2>
        <h3>Details</h3>
      </div>
    `;

    const root = document.body.firstElementChild as HTMLElement;
    const outline = extractArticleOutline(root);

    expect(outline.map((item) => item.level)).toEqual([2, 2, 3]);
    expect(outline.map((item) => item.text)).toEqual(['Overview', 'Overview', 'Details']);
    expect(outline.map((item) => item.id)).toEqual([
      'article-outline-overview',
      'article-outline-overview-2',
      'article-outline-details',
    ]);
  });
});

describe('buildArticleOutlineMarkers', () => {
  it('maps headings into normalized top ratios', () => {
    document.body.innerHTML = `
      <div>
        <h2>Overview</h2>
        <p>Body</p>
        <h3>Details</h3>
      </div>
    `;

    const root = document.body.firstElementChild as HTMLElement;
    Object.defineProperty(root, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(root, 'clientHeight', { value: 400, configurable: true });

    const items = extractArticleOutline(root);
    Object.defineProperty(items[0]!.element, 'offsetTop', { value: 80, configurable: true });
    Object.defineProperty(items[1]!.element, 'offsetTop', { value: 320, configurable: true });

    const markers = buildArticleOutlineMarkers(items, root);

    expect(markers).toMatchObject([
      { id: 'article-outline-overview', topRatio: 0.1 },
      { id: 'article-outline-details', topRatio: 0.4 },
    ]);
  });
});

describe('getActiveArticleOutlineHeadingId', () => {
  it('returns the last heading that has crossed the active threshold', () => {
    document.body.innerHTML = `
      <div>
        <h2>Overview</h2>
        <p>Body</p>
        <h3>Details</h3>
        <p>More</p>
        <h3>Summary</h3>
      </div>
    `;

    const root = document.body.firstElementChild as HTMLElement;
    const items = extractArticleOutline(root);

    Object.defineProperty(items[0]!.element, 'offsetTop', { value: 0, configurable: true });
    Object.defineProperty(items[1]!.element, 'offsetTop', { value: 240, configurable: true });
    Object.defineProperty(items[2]!.element, 'offsetTop', { value: 520, configurable: true });

    expect(getActiveArticleOutlineHeadingId(items, 0)).toBe('article-outline-overview');
    expect(getActiveArticleOutlineHeadingId(items, 260)).toBe('article-outline-details');
    expect(getActiveArticleOutlineHeadingId(items, 560)).toBe('article-outline-summary');
  });
});
