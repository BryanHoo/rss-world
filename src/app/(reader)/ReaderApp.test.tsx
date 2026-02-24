import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ReaderApp from './ReaderApp';
import { useAppStore } from '../../store/appStore';

describe('ReaderApp', () => {
  it('renders current reader chrome', () => {
    render(<ReaderApp />);
    expect(screen.getByAltText('FeedFuse')).toBeInTheDocument();
    expect(screen.getByText('文章')).toBeInTheDocument();
    expect(screen.getByLabelText('open-settings')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('open-settings'));
    expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
  });

  it('does not register reader keyboard shortcut handlers', () => {
    render(<ReaderApp />);
    expect(useAppStore.getState().selectedArticleId).toBeNull();

    fireEvent.keyDown(window, { key: 'j' });

    expect(useAppStore.getState().selectedArticleId).toBeNull();
  });
});
