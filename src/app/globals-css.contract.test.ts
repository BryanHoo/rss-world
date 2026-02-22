import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('globals.css contract', () => {
  it('uses tailwind v4 import and class-based dark variant', () => {
    const css = readFileSync('src/app/globals.css', 'utf-8');
    expect(css).toContain('@import "tailwindcss";');
    expect(css).toContain('@custom-variant dark (&:where(.dark, .dark *));');
  });
});
