import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import ReaderLayout from '../reader/ReaderLayout';
import { useAppStore } from '../../store/appStore';

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

vi.mock('./services/rssValidationService', () => ({
  validateRssUrl: vi.fn(async (url: string) => {
    if (url.includes('success')) {
      return { ok: true, kind: 'rss' as const };
    }
    return { ok: false, errorCode: 'not_feed' as const };
  }),
}));

describe('AddFeedDialog', () => {
  let nextFeedId = 1;

  beforeEach(() => {
    nextFeedId = 1;
    useAppStore.setState({
      feeds: [],
      categories: [
        { id: 'cat-tech', name: '科技', expanded: true },
        { id: 'cat-design', name: '设计', expanded: true },
        { id: 'cat-uncategorized', name: '未分类', expanded: true },
      ],
      articles: [],
      selectedView: 'all',
      selectedArticleId: null,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';

        if (url.includes('/api/feeds') && method === 'POST') {
          const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
          const id = `feed-${nextFeedId++}`;
          return jsonResponse({
            ok: true,
            data: {
              id,
              title: String(body.title ?? ''),
              url: String(body.url ?? ''),
              siteUrl: null,
              iconUrl: null,
              enabled: true,
              categoryId: body.categoryId ?? null,
              fetchIntervalMinutes: 30,
              unreadCount: 0,
            },
          });
        }

        if (url.includes('/api/feeds/') && url.endsWith('/refresh') && method === 'POST') {
          return jsonResponse({ ok: true, data: { enqueued: true, jobId: 'job-1' } });
        }

        throw new Error(`Unexpected fetch: ${method} ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
    const urlInput = screen.getByPlaceholderText('https://example.com/feed.xml');
    fireEvent.change(urlInput, {
      target: { value: 'https://example.com/success.xml' },
    });
    fireEvent.blur(urlInput);

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
    const urlInput = screen.getByPlaceholderText('https://example.com/feed.xml');
    fireEvent.change(urlInput, {
      target: { value: 'https://example.com/success.xml' },
    });

    const submitButton = screen.getByRole('button', { name: '添加' });
    expect(submitButton).toBeDisabled();

    fireEvent.blur(urlInput);
    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });

    fireEvent.change(urlInput, {
      target: { value: 'https://example.com/changed.xml' },
    });
    expect(submitButton).toBeDisabled();
  });

  it('submits selected categoryId from category dropdown', async () => {
    render(<ReaderLayout />);
    fireEvent.click(screen.getByLabelText('add-feed'));

    fireEvent.change(screen.getByPlaceholderText('例如：The Verge'), { target: { value: 'Category Id Feed' } });
    const urlInput = screen.getByPlaceholderText('https://example.com/feed.xml');
    fireEvent.change(urlInput, {
      target: { value: 'https://example.com/success.xml' },
    });

    const techOption = screen.getByRole('option', { name: '科技' });
    expect(techOption).toHaveValue('cat-tech');

    fireEvent.change(screen.getByLabelText('分类'), { target: { value: 'cat-design' } });
    fireEvent.blur(urlInput);

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
