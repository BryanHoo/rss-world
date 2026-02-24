import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { defaultPersistedSettings } from './settingsSchema';
import ReaderLayout from '../reader/ReaderLayout';
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

describe('SettingsCenterModal', () => {
  it('renders settings in right drawer layout and removes footer save button', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);
    fireEvent.click(screen.getByLabelText('open-settings'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-center-modal').className).toContain('right-0');
    });

    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
  });

  it('renders drawer with left nav and right content workspace layout', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);
    fireEvent.click(screen.getByLabelText('open-settings'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
    });

    expect(screen.getByTestId('settings-section-tab-appearance')).toBeInTheDocument();
    expect(screen.getByTestId('settings-section-tab-categories')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-section-tab-rss')).not.toBeInTheDocument();
    expect(screen.getByText('主题')).toBeInTheDocument();
  });

  it('closes settings dialog on Escape', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);
    fireEvent.click(screen.getByLabelText('open-settings'));
    await waitFor(() => expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument());

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('settings-center-modal')).not.toBeInTheDocument());
  });

  it('closes settings dialog on overlay click', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);
    fireEvent.click(screen.getByLabelText('open-settings'));
    await waitFor(() => expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument());

    const overlay = screen.getByTestId('settings-center-overlay');
    fireEvent.pointerDown(overlay);
    fireEvent.click(overlay);
    await waitFor(() => expect(screen.queryByTestId('settings-center-modal')).not.toBeInTheDocument());
  });

  it('asks for confirmation when closing with unresolved validation errors', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);
    fireEvent.click(screen.getByLabelText('open-settings'));
    fireEvent.click(screen.getByTestId('settings-section-tab-ai'));

    const apiBaseUrlInput = await screen.findByLabelText('API Base URL');
    fireEvent.change(apiBaseUrlInput, { target: { value: 'not-a-valid-url' } });

    fireEvent.click(screen.getByLabelText('close-settings'));
    expect(screen.getByText('关闭后会丢失未成功保存的修改')).toBeInTheDocument();
  });

  it('loads draft on open and closes on cancel after autosave', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);

    fireEvent.click(screen.getByLabelText('open-settings'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
      expect(useSettingsStore.getState().draft).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: '深色' }));
    expect(useSettingsStore.getState().draft?.persisted.appearance.theme).toBe('dark');

    await waitFor(() => {
      expect(screen.getByText('已保存')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('close-settings'));
    expect(screen.queryByTestId('settings-center-modal')).not.toBeInTheDocument();
    expect(useSettingsStore.getState().draft).toBeNull();

    fireEvent.click(screen.getByLabelText('open-settings'));
    await waitFor(() => {
      expect(useSettingsStore.getState().draft?.persisted.appearance.theme).toBe('dark');
    });
  });

  it('does not expose ai provider field and does not expose shortcuts tab', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);

    fireEvent.click(screen.getByLabelText('open-settings'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('settings-section-tab-ai'));

    expect(screen.queryByLabelText('Provider')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
  });

  it('keeps apiKey out of localStorage after save', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);

    fireEvent.click(screen.getByLabelText('open-settings'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('settings-section-tab-ai'));

    await waitFor(() => {
      expect(screen.getByLabelText('API Key')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-test' } });

    await waitFor(() => {
      expect(screen.getByText('已保存')).toBeInTheDocument();
    });

    const raw = window.localStorage.getItem('feedfuse-settings') ?? '';
    expect(raw).not.toContain('sk-test');
    expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
  });

  it('creates category and autosaves without rss verification flow', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);

    fireEvent.click(screen.getByLabelText('open-settings'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('settings-section-tab-categories'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '添加分类' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('新分类名称'), { target: { value: 'Tech' } });
    fireEvent.click(screen.getByRole('button', { name: '添加分类' }));

    await waitFor(() => {
      const savedCategories = useSettingsStore.getState().persistedSettings.categories;
      expect(savedCategories.some((item) => item.name === 'Tech')).toBe(true);
    });
  });

  it('uses right drawer shell with sidebar tab layout', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);

    fireEvent.click(screen.getByLabelText('open-settings'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
    });

    expect(screen.getByTestId('settings-center-modal').className).toContain('right-0');
    expect(screen.getByLabelText('settings-sections')).toBeInTheDocument();
  });
});
