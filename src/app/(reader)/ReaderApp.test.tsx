import React from 'react';
import { render, screen } from '@testing-library/react';
import ReaderApp from './ReaderApp';

describe('ReaderApp', () => {
  it('renders current reader chrome', () => {
    render(<ReaderApp />);
    expect(screen.getByText('rss-world')).toBeInTheDocument();
    expect(screen.getByText('文章')).toBeInTheDocument();
    expect(screen.getByLabelText('open-settings')).toBeInTheDocument();
  });
});
