import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReaderLayout from '../reader/ReaderLayout';

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
      target: { value: 'https://my-feed.example/rss.xml' },
    });

    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '添加 RSS 源' })).not.toBeInTheDocument();
    });
  });
});
