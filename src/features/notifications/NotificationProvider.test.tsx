import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from './NotificationProvider';
import { useNotify } from './useNotify';

function Probe() {
  const notify = useNotify();

  return (
    <div>
      <button type="button" onClick={() => notify.success('保存成功')}>
        success
      </button>
      <button type="button" onClick={() => notify.info('信息提示')}>
        info
      </button>
      <button type="button" onClick={() => notify.error('操作失败')}>
        error
      </button>
      <button type="button" onClick={() => notify.success('保存成功2')}>
        success-2
      </button>
    </div>
  );
}

describe('NotificationProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('dedupes same message within 1.5s and auto-dismisses by type TTL', async () => {
    vi.useFakeTimers();

    render(
      <NotificationProvider>
        <Probe />
      </NotificationProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'success' }));
    fireEvent.click(screen.getByRole('button', { name: 'success' }));

    expect(screen.getAllByText('保存成功')).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800);
    });

    expect(screen.queryByText('保存成功')).not.toBeInTheDocument();
  });

  it('keeps max 3 notifications and prioritizes error retention', () => {
    render(
      <NotificationProvider>
        <Probe />
      </NotificationProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'success' }));
    fireEvent.click(screen.getByRole('button', { name: 'info' }));
    fireEvent.click(screen.getByRole('button', { name: 'error' }));
    fireEvent.click(screen.getByRole('button', { name: 'success-2' }));

    expect(screen.queryByText('保存成功')).not.toBeInTheDocument();
    expect(screen.getByText('信息提示')).toBeInTheDocument();
    expect(screen.getByText('操作失败')).toBeInTheDocument();
    expect(screen.getByText('保存成功2')).toBeInTheDocument();
  });
});
