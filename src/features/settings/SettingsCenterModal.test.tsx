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
  it('renders settings in right drawer layout and removes footer save button', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);
    fireEvent.click(screen.getByLabelText('open-settings'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-center-modal').className).toContain('right-0');
    });

    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
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

  it('shows default ai provider as openai-compatible and blocks autosave on duplicate shortcut', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);

    fireEvent.click(screen.getByLabelText('open-settings'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'AI' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Provider')).toHaveValue('openai-compatible');
    });

    fireEvent.click(screen.getByRole('tab', { name: '快捷键' }));
    await waitFor(() => {
      expect(screen.getByLabelText('上一条')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('上一条'), { target: { value: 'j' } });

    await waitFor(() => {
      expect(useSettingsStore.getState().validationErrors['shortcuts.bindings']).toBeTruthy();
    });
    expect(screen.getByText('Fix errors to save')).toBeInTheDocument();
    expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
  });

  it('keeps apiKey out of localStorage after save', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);

    fireEvent.click(screen.getByLabelText('open-settings'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'AI' }));
    await waitFor(() => {
      expect(screen.getByLabelText('API Key')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-test' } });

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument();
    });

    const raw = window.localStorage.getItem('feedfuse-settings') ?? '';
    expect(raw).not.toContain('sk-test');
    expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
  });

  it('supports rss source add edit delete toggle in draft and saves valid rows only', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);

    fireEvent.click(screen.getByLabelText('open-settings'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'RSS 源' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '新增 RSS 源' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '新增 RSS 源' }));
    fireEvent.change(screen.getByLabelText('名称-0'), { target: { value: 'Tech Feed' } });
    fireEvent.change(screen.getByLabelText('URL-0'), { target: { value: 'ftp://bad' } });
    fireEvent.change(screen.getByLabelText('分组-0'), { target: { value: 'Tech' } });
    fireEvent.click(screen.getByLabelText('启用-0'));

    await waitFor(() => {
      expect(useSettingsStore.getState().validationErrors['rss.sources.0.url']).toBeTruthy();
    });
    expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
    expect(screen.getByText('Fix errors to save')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('URL-0'), { target: { value: 'https://example.com/feed.xml' } });
    fireEvent.change(screen.getByLabelText('名称-0'), { target: { value: 'Tech Feed Updated' } });

    fireEvent.click(screen.getByRole('button', { name: '新增 RSS 源' }));
    fireEvent.click(screen.getByRole('button', { name: '删除-1' }));

    await waitFor(() => {
      const saved = useSettingsStore.getState().persistedSettings.rss.sources;
      expect(saved).toHaveLength(1);
      expect(saved[0].name).toBe('Tech Feed Updated');
      expect(saved[0].url).toBe('https://example.com/feed.xml');
      expect(saved[0].folder).toBe('Tech');
      expect(saved[0].enabled).toBe(false);
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
    expect(screen.getByRole('tablist').className).toContain('flex-col');
  });
});
