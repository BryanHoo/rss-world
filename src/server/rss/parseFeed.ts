import 'server-only';
import Parser from 'rss-parser';

export interface ParsedFeedItem {
  title: string;
  link: string | null;
  guid: string | null;
  author: string | null;
  publishedAt: Date;
  contentHtml: string | null;
  summary: string | null;
}

export interface ParsedFeed {
  title: string | null;
  link: string | null;
  items: ParsedFeedItem[];
}

const parser = new Parser();

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function parseFeed(xml: string, fetchedAt: Date): Promise<ParsedFeed> {
  const feed = await parser.parseString(xml);

  const title = typeof feed.title === 'string' ? feed.title : null;
  const link = typeof feed.link === 'string' ? feed.link : null;

  const items: ParsedFeedItem[] = (feed.items ?? []).map((item) => {
    const publishedAt =
      parseDate(item.isoDate) ??
      parseDate(item.pubDate) ??
      fetchedAt;

    const contentHtml =
      typeof item.content === 'string'
        ? item.content
        : typeof item['content:encoded'] === 'string'
          ? item['content:encoded']
          : null;

    const summary =
      typeof item.contentSnippet === 'string'
        ? item.contentSnippet
        : typeof item.summary === 'string'
          ? item.summary
          : null;

    const author =
      typeof item.creator === 'string'
        ? item.creator
        : typeof item.author === 'string'
          ? item.author
          : null;

    return {
      title: typeof item.title === 'string' ? item.title : '',
      link: typeof item.link === 'string' ? item.link : null,
      guid: typeof item.guid === 'string' ? item.guid : null,
      author,
      publishedAt,
      contentHtml,
      summary,
    };
  });

  return { title, link, items };
}

