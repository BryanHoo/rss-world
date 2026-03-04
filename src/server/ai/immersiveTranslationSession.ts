import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { extractNormalizedVisibleText } from './bilingualHtmlTranslator';

export const immersiveSelectors = [
  'p',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
] as const;

export interface ImmersiveSegment {
  segmentIndex: number;
  tagName: string;
  text: string;
  domPath: string;
}

function getTagSiblingIndex(element: Element): number {
  let index = 0;
  let prev = element.previousElementSibling;
  while (prev) {
    if (prev.tagName === element.tagName) {
      index += 1;
    }
    prev = prev.previousElementSibling;
  }
  return index;
}

function buildDomPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.tagName.toLowerCase() !== 'html') {
    const tag = current.tagName.toLowerCase();
    parts.push(`${tag}[${getTagSiblingIndex(current)}]`);
    current = current.parentElement;
  }

  return parts.reverse().join('>');
}

export function extractImmersiveSegments(html: string): ImmersiveSegment[] {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const selector = immersiveSelectors.join(',');
  const elements = Array.from(document.querySelectorAll(selector));
  const segments: ImmersiveSegment[] = [];

  for (const element of elements) {
    const text = extractNormalizedVisibleText(element);
    if (!text) continue;

    segments.push({
      segmentIndex: segments.length,
      tagName: element.tagName.toLowerCase(),
      text,
      domPath: buildDomPath(element),
    });
  }

  dom.window.close();
  return segments;
}

export function hashSourceHtml(html: string): string {
  return createHash('sha256').update(html, 'utf8').digest('hex');
}
