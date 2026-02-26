import { describe, expect, it } from 'vitest';
import {
  JOB_AI_SUMMARIZE,
  JOB_ARTICLE_FULLTEXT_FETCH,
  JOB_FEED_FETCH,
  JOB_REFRESH_ALL,
} from './jobs';

describe('queue jobs', () => {
  it('exports stable job names', () => {
    expect(JOB_FEED_FETCH).toBe('feed.fetch');
    expect(JOB_REFRESH_ALL).toBe('feed.refresh_all');
    expect(JOB_AI_SUMMARIZE).toBe('ai.summarize_article');
    expect(JOB_ARTICLE_FULLTEXT_FETCH).toBe('article.fetch_fulltext');
  });
});
