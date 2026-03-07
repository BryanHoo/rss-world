import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ArticleOutlineRail from './ArticleOutlineRail';

const headings = [
  { id: 'article-outline-overview', level: 2 as const, text: 'Overview', topRatio: 0.1 },
  { id: 'article-outline-details', level: 3 as const, text: 'Details', topRatio: 0.6 },
];

describe('ArticleOutlineRail', () => {
  it('does not render when headings are empty', () => {
    const { container } = render(
      <ArticleOutlineRail
        headings={[]}
        activeHeadingId={null}
        onSelect={vi.fn()}
        width={200}
        maxHeight={320}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders a persistent navigation panel by default', () => {
    render(
      <ArticleOutlineRail
        headings={headings}
        activeHeadingId="article-outline-overview"
        onSelect={vi.fn()}
        width={200}
        maxHeight={320}
      />,
    );

    expect(screen.getByRole('navigation', { name: '文章目录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
  });

  it('calls onSelect when a heading is clicked', () => {
    const onSelect = vi.fn();

    render(
      <ArticleOutlineRail
        headings={headings}
        activeHeadingId="article-outline-overview"
        onSelect={onSelect}
        width={180}
        maxHeight={280}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(onSelect).toHaveBeenCalledWith('article-outline-details');
  });

  it('keeps the active item lightly highlighted and truncates labels', () => {
    render(
      <ArticleOutlineRail
        headings={headings}
        activeHeadingId="article-outline-details"
        onSelect={vi.fn()}
        width={168}
        maxHeight={240}
      />,
    );

    expect(screen.getByRole('button', { name: 'Overview' })).toHaveClass('truncate');
    expect(screen.getByRole('button', { name: 'Details' })).toHaveClass('bg-primary/8');
  });
});
