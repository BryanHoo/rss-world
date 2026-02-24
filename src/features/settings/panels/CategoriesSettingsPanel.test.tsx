import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsDraft } from '../../../store/settingsStore';
import { defaultPersistedSettings } from '../settingsSchema';
import CategoriesSettingsPanel from './CategoriesSettingsPanel';

const { clearCategoryFromFeedsMock } = vi.hoisted(() => ({
  clearCategoryFromFeedsMock: vi.fn(),
}));

vi.mock('../../../store/appStore', () => ({
  useAppStore: (selector: (state: { clearCategoryFromFeeds: (categoryId: string) => void }) => unknown) =>
    selector({
      clearCategoryFromFeeds: clearCategoryFromFeedsMock,
    }),
}));

function createDraft(categories: SettingsDraft['persisted']['categories'] = []): SettingsDraft {
  return {
    persisted: {
      ...structuredClone(defaultPersistedSettings),
      categories: structuredClone(categories),
    },
    session: {
      ai: { apiKey: '' },
      rssValidation: {},
    },
  };
}

function TestHarness({ initialCategories = [] }: { initialCategories?: SettingsDraft['persisted']['categories'] }) {
  const [draft, setDraft] = useState<SettingsDraft>(() => createDraft(initialCategories));

  return (
    <CategoriesSettingsPanel
      draft={draft}
      errors={{}}
      onChange={(updater) => {
        setDraft((prev) => {
          const next = structuredClone(prev);
          updater(next);
          return next;
        });
      }}
    />
  );
}

describe('CategoriesSettingsPanel', () => {
  beforeEach(() => {
    clearCategoryFromFeedsMock.mockClear();
  });

  it('supports category create/rename/delete in settings', () => {
    render(<TestHarness />);

    fireEvent.change(screen.getByLabelText('新分类名称'), { target: { value: 'Tech' } });
    fireEvent.click(screen.getByRole('button', { name: '添加分类' }));
    expect(screen.getByDisplayValue('Tech')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('分类名称-0'), { target: { value: 'Tech News' } });
    expect(screen.getByDisplayValue('Tech News')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('删除分类-0'));
    expect(screen.queryByDisplayValue('Tech News')).not.toBeInTheDocument();
  });

  it('clears feed bindings when deleting a category', () => {
    render(<TestHarness initialCategories={[{ id: 'cat-tech', name: 'Tech' }]} />);

    fireEvent.click(screen.getByLabelText('删除分类-0'));
    expect(clearCategoryFromFeedsMock).toHaveBeenCalledWith('cat-tech');
  });
});
