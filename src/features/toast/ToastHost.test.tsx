import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToastHost } from './ToastHost';
import { toast } from './toast';
import { toastStore } from './toastStore';

describe('ToastHost', () => {
  it('renders viewport and shows toast messages', async () => {
    toastStore.getState().reset();

    render(<ToastHost />);

    expect(screen.getByTestId('notification-viewport')).toBeInTheDocument();

    await act(async () => {
      toast.success('已保存');
    });

    expect(await screen.findByText('已保存')).toBeInTheDocument();
  });
});

