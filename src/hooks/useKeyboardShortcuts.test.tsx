import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAppStore } from '../store/appStore';
import { useSettingsStore } from '../store/settingsStore';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

function Harness() {
  useKeyboardShortcuts();
  return null;
}

describe('useKeyboardShortcuts', () => {
  it('uses configured key binding for nextArticle', () => {
    const [first, second] = useAppStore.getState().articles;
    useAppStore.setState((state) => ({
      ...state,
      selectedArticleId: first.id,
    }));

    useSettingsStore.setState((state) => ({
      ...state,
      persistedSettings: {
        ...state.persistedSettings,
        shortcuts: {
          ...state.persistedSettings.shortcuts,
          enabled: true,
          bindings: {
            ...state.persistedSettings.shortcuts.bindings,
            nextArticle: 'n',
          },
        },
      },
    }));

    render(<Harness />);
    fireEvent.keyDown(window, { key: 'n' });

    expect(useAppStore.getState().selectedArticleId).toBe(second.id);
  });

  it('ignores keydown when shortcuts.enabled is false', () => {
    const [first, second] = useAppStore.getState().articles;
    useAppStore.setState((state) => ({
      ...state,
      selectedArticleId: first.id,
    }));

    useSettingsStore.setState((state) => ({
      ...state,
      persistedSettings: {
        ...state.persistedSettings,
        shortcuts: {
          ...state.persistedSettings.shortcuts,
          enabled: false,
        },
      },
    }));

    render(<Harness />);
    fireEvent.keyDown(window, { key: 'j' });

    expect(useAppStore.getState().selectedArticleId).toBe(first.id);
    expect(useAppStore.getState().selectedArticleId).not.toBe(second.id);
  });
});
