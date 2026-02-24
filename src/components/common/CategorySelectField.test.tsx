import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CategorySelectField from './CategorySelectField';

describe('CategorySelectField', () => {
  it('supports selecting existing category, creating new category, and clearing', () => {
    const onChange = vi.fn();

    render(
      <CategorySelectField
        id="rss-category"
        label="分类"
        value={null}
        options={['科技', '设计']}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText('分类'), { target: { value: '科技' } });
    expect(onChange).toHaveBeenCalledWith('科技');

    fireEvent.change(screen.getByLabelText('分类'), { target: { value: '__create__' } });
    fireEvent.change(screen.getByLabelText('新分类'), { target: { value: '安全' } });
    fireEvent.click(screen.getByRole('button', { name: '确认新分类' }));
    expect(onChange).toHaveBeenCalledWith('安全');

    fireEvent.change(screen.getByLabelText('分类'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
