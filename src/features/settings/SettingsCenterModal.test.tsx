import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { defaultPersistedSettings } from './settingsSchema';
import ReaderLayout from '../reader/ReaderLayout';
import { useSettingsStore } from '../../store/settingsStore';

function resetSettingsStore() {
  useSettingsStore.setState((state) => ({
    ...state,
    persistedSettings: structuredClone(defaultPersistedSettings),
    sessionSettings: { ai: { apiKey: '' } },
    draft: null,
    validationErrors: {},
    settings: structuredClone(defaultPersistedSettings.appearance),
  }));
  window.localStorage.clear();
}

describe('SettingsCenterModal', () => {
  it('loads draft on open and discards draft on cancel', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);

    fireEvent.click(screen.getByLabelText('open-settings'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
      expect(useSettingsStore.getState().draft).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: '深色' }));
    expect(useSettingsStore.getState().draft?.persisted.appearance.theme).toBe('dark');

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByTestId('settings-center-modal')).not.toBeInTheDocument();
    expect(useSettingsStore.getState().draft).toBeNull();

    fireEvent.click(screen.getByLabelText('open-settings'));
    await waitFor(() => {
      expect(useSettingsStore.getState().draft?.persisted.appearance.theme).toBe('auto');
    });
  });
});
