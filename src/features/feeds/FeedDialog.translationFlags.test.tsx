import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../notifications/NotificationProvider';
import FeedDialog from './FeedDialog';

function renderFeedDialog(input?: {
  onSubmit?: (payload: unknown) => Promise<void>;
}) {
  const onSubmit =
    input?.onSubmit ??
    (async () => {
      return;
    });

  render(
    <NotificationProvider>
      <FeedDialog
        mode="edit"
        open
        onOpenChange={() => {}}
        categories={[
          { id: 'cat-tech', name: '科技' },
          { id: 'cat-uncategorized', name: '未分类' },
        ]}
        initialValues={{
          title: 'Feed Title',
          url: 'https://example.com/feed.xml',
          siteUrl: 'https://example.com',
          categoryId: 'cat-tech',
          fullTextOnOpenEnabled: false,
          aiSummaryOnOpenEnabled: false,
          aiSummaryOnFetchEnabled: false,
          bodyTranslateOnFetchEnabled: false,
          bodyTranslateOnOpenEnabled: false,
          titleTranslateEnabled: false,
          bodyTranslateEnabled: false,
        }}
        onSubmit={onSubmit}
      />
    </NotificationProvider>,
  );
}

describe('FeedDialog translation flags', () => {
  it('renders and submits ai summary/translation trigger options on fetch and on open', async () => {
    const onSubmit = vi.fn(async () => undefined);
    renderFeedDialog({ onSubmit });

    expect(screen.getByRole('combobox', { name: '获取文章后自动获取摘要' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '打开文章自动获取摘要' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '获取文章后自动翻译正文' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '打开文章自动翻译正文' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox', { name: '获取文章后自动获取摘要' }));
    fireEvent.click(screen.getByRole('option', { name: '开启' }));

    fireEvent.click(screen.getByRole('combobox', { name: '打开文章自动获取摘要' }));
    fireEvent.click(screen.getByRole('option', { name: '开启' }));

    fireEvent.click(screen.getByRole('combobox', { name: '获取文章后自动翻译正文' }));
    fireEvent.click(screen.getByRole('option', { name: '开启' }));

    fireEvent.click(screen.getByRole('combobox', { name: '打开文章自动翻译正文' }));
    fireEvent.click(screen.getByRole('option', { name: '开启' }));

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          aiSummaryOnFetchEnabled: true,
          aiSummaryOnOpenEnabled: true,
          bodyTranslateOnFetchEnabled: true,
          bodyTranslateOnOpenEnabled: true,
        }),
      );
    });
  });
});
