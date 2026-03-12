import { fireEvent, render, screen } from '@testing-library/react';
import { Sparkles } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import ReaderToolbarIconButton from './ReaderToolbarIconButton';

describe('ReaderToolbarIconButton', () => {
  it('shows a Chinese tooltip and keeps aria-label semantics', async () => {
    const onClick = vi.fn();

    render(
      <ReaderToolbarIconButton
        icon={Sparkles}
        label="生成摘要"
        onClick={onClick}
      />,
    );

    const button = screen.getByRole('button', { name: '生成摘要' });
    expect(button).not.toHaveAttribute('title');

    fireEvent.mouseEnter(button);
    expect(await screen.findByText('生成摘要')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps tooltip available even when the button is disabled', async () => {
    render(
      <ReaderToolbarIconButton
        icon={Sparkles}
        label="生成摘要"
        disabled
      />,
    );

    const button = screen.getByRole('button', { name: '生成摘要' });
    expect(button).toBeDisabled();

    fireEvent.mouseEnter(button.parentElement as HTMLElement);
    expect(await screen.findByText('生成摘要')).toBeInTheDocument();
  });

  it('renders pressed state with reader active styling', () => {
    render(
      <ReaderToolbarIconButton
        icon={Sparkles}
        label="仅显示未读文章"
        pressed
      />,
    );

    expect(screen.getByRole('button', { name: '仅显示未读文章' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
