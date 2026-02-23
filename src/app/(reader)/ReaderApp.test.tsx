import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ReaderApp from './ReaderApp';

describe('ReaderApp', () => {
  it('renders current reader chrome', () => {
    render(<ReaderApp />);
    expect(screen.getByAltText('FeedFuse')).toBeInTheDocument();
    expect(screen.getByText('文章')).toBeInTheDocument();
    expect(screen.getByLabelText('open-settings')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('open-settings'));
    expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
  });
});
