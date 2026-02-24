import { fireEvent, render, screen } from '@testing-library/react';
import ReaderLayout from './ReaderLayout';

describe('ReaderLayout', () => {
  it('keeps the existing 3-column reader interactions', () => {
    render(<ReaderLayout />);
    expect(screen.getByLabelText('add-feed')).toBeInTheDocument();
    expect(screen.getByLabelText('open-settings')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('open-settings'));
    expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
  });

  it('groups feeds by category with uncategorized fallback', () => {
    render(<ReaderLayout />);
    expect(screen.getByText('科技')).toBeInTheDocument();
    expect(screen.getByText('未分类')).toBeInTheDocument();
  });
});
