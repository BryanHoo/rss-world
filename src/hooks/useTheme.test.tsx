import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSettingsStore } from '../store/settingsStore';
import { useTheme } from './useTheme';

function Harness() {
  useTheme();
  return null;
}

describe('useTheme', () => {
  it('applies dark class from persisted general theme', () => {
    useSettingsStore.setState((state) => ({
      ...state,
      persistedSettings: {
        ...state.persistedSettings,
        general: {
          ...state.persistedSettings.general,
          theme: 'dark',
        },
      },
    }));

    render(<Harness />);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
