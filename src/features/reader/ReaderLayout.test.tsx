import { fireEvent, render, screen } from '@testing-library/react';
import ReaderLayout from './ReaderLayout';
import { defaultPersistedSettings } from '../settings/settingsSchema';
import { useSettingsStore } from '../../store/settingsStore';

function resetSettingsStore() {
  useSettingsStore.setState((state) => ({
    ...state,
    persistedSettings: structuredClone(defaultPersistedSettings),
    sessionSettings: { ai: { apiKey: '' }, rssValidation: {} },
    draft: null,
    validationErrors: {},
    settings: structuredClone(defaultPersistedSettings.appearance),
  }));
  window.localStorage.clear();
}

describe('ReaderLayout', () => {
  it('keeps the existing 3-column reader interactions', () => {
    resetSettingsStore();
    render(<ReaderLayout />);
    expect(screen.getByLabelText('add-feed')).toBeInTheDocument();
    expect(screen.getByLabelText('open-settings')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('open-settings'));
    expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
  });

  it('groups feeds by category with uncategorized fallback', () => {
    resetSettingsStore();
    render(<ReaderLayout />);
    expect(screen.getByText('科技')).toBeInTheDocument();
    expect(screen.getByText('未分类')).toBeInTheDocument();
  });

  it('hides categories without feeds in sidebar', () => {
    resetSettingsStore();
    useSettingsStore.setState((state) => ({
      ...state,
      persistedSettings: {
        ...state.persistedSettings,
        categories: [...state.persistedSettings.categories, { id: 'cat-empty', name: '空分类' }],
      },
    }));

    render(<ReaderLayout />);
    expect(screen.queryByText('空分类')).not.toBeInTheDocument();
  });
});
