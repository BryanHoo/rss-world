import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export function extractFulltext(input: {
  html: string;
  url: string;
}): { contentHtml: string; title: string | null } | null {
  const dom = new JSDOM(input.html, { url: input.url });
  const reader = new Readability(dom.window.document);
  const parsed = reader.parse();
  dom.window.close();

  if (!parsed?.content) return null;
  return {
    contentHtml: parsed.content,
    title: typeof parsed.title === 'string' ? parsed.title : null,
  };
}

