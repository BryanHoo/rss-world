import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { ArticleOutlineMarker } from './articleOutline';

interface ArticleOutlineRailProps {
  headings: ArticleOutlineMarker[];
  activeHeadingId: string | null;
  onSelect: (headingId: string) => void;
  width: number;
  maxHeight: number;
}

export default function ArticleOutlineRail({
  headings,
  activeHeadingId,
  onSelect,
  width,
  maxHeight,
}: ArticleOutlineRailProps) {
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeButtonRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [activeHeadingId]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="文章目录"
      data-testid="article-outline-panel"
      className="rounded-xl border border-border/50 bg-background/70 p-2 shadow-sm backdrop-blur-sm transition-colors hover:bg-background/85"
      style={{ width, maxHeight }}
    >
      <div className="overflow-y-auto" style={{ maxHeight: Math.max(maxHeight - 16, 0) }}>
        {headings.map((heading) => (
          <button
            key={heading.id}
            ref={activeHeadingId === heading.id ? activeButtonRef : null}
            type="button"
            className={cn(
              'block w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors',
              heading.level === 3 && 'pl-5',
              heading.level === 2 && 'pl-3',
              activeHeadingId === heading.id && 'bg-primary/8 text-foreground',
            )}
            onClick={() => onSelect(heading.id)}
          >
            {heading.text}
          </button>
        ))}
      </div>
    </nav>
  );
}
