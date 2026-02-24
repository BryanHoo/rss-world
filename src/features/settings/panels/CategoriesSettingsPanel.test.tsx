import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { SettingsDraft } from '../../../store/settingsStore';
import { defaultPersistedSettings } from '../settingsSchema';
import CategoriesSettingsPanel from './CategoriesSettingsPanel';

function createDraft(): SettingsDraft {
  return {
    persisted: structuredClone(defaultPersistedSettings),
    session: {
      ai: { apiKey: '' },
      rssValidation: {},
    },
  };
}

function TestHarness() {
  const [draft, setDraft] = useState<SettingsDraft>(() => createDraft());

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
});
