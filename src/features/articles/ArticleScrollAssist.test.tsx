import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ArticleScrollAssist from './ArticleScrollAssist';

describe('ArticleScrollAssist', () => {
  it('does not render when visible is false', () => {
    const { container } = render(
      <ArticleScrollAssist visible={false} percent={0} onBackToTop={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the rounded percent text and back-to-top button', () => {
    render(<ArticleScrollAssist visible percent={37} onBackToTop={vi.fn()} />);

    expect(screen.getByText('37%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '回到顶部' })).toBeInTheDocument();
  });

  it('clamps invalid percent values to the 0-100 range', () => {
    const { rerender } = render(
      <ArticleScrollAssist visible percent={-12} onBackToTop={vi.fn()} />,
    );

    expect(screen.getByText('0%')).toBeInTheDocument();

    rerender(<ArticleScrollAssist visible percent={160} onBackToTop={vi.fn()} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('calls onBackToTop when the button is clicked', () => {
    const onBackToTop = vi.fn();
    render(<ArticleScrollAssist visible percent={52} onBackToTop={onBackToTop} />);

    fireEvent.click(screen.getByRole('button', { name: '回到顶部' }));

    expect(onBackToTop).toHaveBeenCalledTimes(1);
  });
});
