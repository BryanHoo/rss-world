import { render, screen } from '@testing-library/react';
import ReaderLayout from './ReaderLayout';

describe('ReaderLayout', () => {
  it('keeps the existing 3-column reader interactions', () => {
    render(<ReaderLayout />);
    expect(screen.getByLabelText('add-feed')).toBeInTheDocument();
    expect(screen.getByLabelText('open-settings')).toBeInTheDocument();
  });
});
