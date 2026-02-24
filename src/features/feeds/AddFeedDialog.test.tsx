import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ReaderLayout from '../reader/ReaderLayout';
import { useAppStore } from '../../store/appStore';

vi.mock('./services/rssValidationService', () => ({
  validateRssUrl: vi.fn(async (url: string) => {
    if (url.includes('success')) {
      return { ok: true, kind: 'rss' as const };
    }
    return { ok: false, errorCode: 'not_feed' as const };
  }),
}));

describe('AddFeedDialog', () => {
  it('opens and closes add feed dialog', () => {
    render(<ReaderLayout />);
    fireEvent.click(screen.getByLabelText('add-feed'));
    expect(screen.getByRole('dialog', { name: '添加 RSS 源' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog', { name: '添加 RSS 源' })).not.toBeInTheDocument();
  });

  it('disables submit until title and url are filled', () => {
    render(<ReaderLayout />);
    fireEvent.click(screen.getByLabelText('add-feed'));
    expect(screen.getByRole('button', { name: '添加' })).toBeDisabled();
  });

  it('submits add feed dialog and closes after valid input', async () => {
    render(<ReaderLayout />);
    fireEvent.click(screen.getByLabelText('add-feed'));

    fireEvent.change(screen.getByPlaceholderText('例如：The Verge'), { target: { value: 'My Feed' } });
    fireEvent.change(screen.getByPlaceholderText('https://example.com/feed.xml'), {
      target: { value: 'https://example.com/success.xml' },
    });
    fireEvent.click(screen.getByRole('button', { name: '验证链接' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '添加' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '添加 RSS 源' })).not.toBeInTheDocument();
    });
  });

  it('requires successful validation before save', async () => {
    render(<ReaderLayout />);
    fireEvent.click(screen.getByLabelText('add-feed'));

    fireEvent.change(screen.getByPlaceholderText('例如：The Verge'), { target: { value: 'My Feed' } });
    fireEvent.change(screen.getByPlaceholderText('https://example.com/feed.xml'), {
      target: { value: 'https://example.com/success.xml' },
    });

    const submitButton = screen.getByRole('button', { name: '添加' });
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '验证链接' }));
    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });

    fireEvent.change(screen.getByPlaceholderText('https://example.com/feed.xml'), {
      target: { value: 'https://example.com/changed.xml' },
    });
    expect(submitButton).toBeDisabled();
  });

  it('submits selected categoryId from category dropdown', async () => {
    render(<ReaderLayout />);
    fireEvent.click(screen.getByLabelText('add-feed'));

    fireEvent.change(screen.getByPlaceholderText('例如：The Verge'), { target: { value: 'Category Id Feed' } });
    fireEvent.change(screen.getByPlaceholderText('https://example.com/feed.xml'), {
      target: { value: 'https://example.com/success.xml' },
    });

    const techOption = screen.getByRole('option', { name: '科技' });
    expect(techOption).toHaveValue('cat-tech');

    fireEvent.change(screen.getByLabelText('分类'), { target: { value: 'cat-design' } });
    fireEvent.click(screen.getByRole('button', { name: '验证链接' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '添加' })).toBeEnabled();
    });

    const feedCountBefore = useAppStore.getState().feeds.length;
    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    await waitFor(() => {
      expect(useAppStore.getState().feeds.length).toBe(feedCountBefore + 1);
    });

    const added = useAppStore
      .getState()
      .feeds.find((item) => item.title === 'Category Id Feed' && item.url === 'https://example.com/success.xml');
    expect(added?.categoryId).toBe('cat-design');
  });
});
