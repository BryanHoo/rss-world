import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { defaultPersistedSettings } from './settingsSchema';
import ReaderLayout from '../reader/ReaderLayout';
import { useSettingsStore } from '../../store/settingsStore';

vi.mock('../feeds/services/rssValidationService', () => ({
  validateRssUrl: vi.fn(async (url: string) => {
    if (url.includes('success')) {
      return { ok: true, kind: 'rss' as const };
    }

    return { ok: false, errorCode: 'not_feed' as const };
  }),
}));

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
    expect(screen.getByTestId('settings-section-tab-rss')).toBeInTheDocument();
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

  it('blocks autosave until rss row is verified and stores category', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);

    fireEvent.click(screen.getByLabelText('open-settings'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('settings-section-tab-rss'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '添加源' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '添加源' }));
    fireEvent.change(screen.getByLabelText('名称-0'), { target: { value: 'Tech Feed Updated' } });
    fireEvent.change(screen.getByLabelText('URL-0'), { target: { value: 'https://example.com/success.xml' } });
    fireEvent.change(screen.getByLabelText('分类-0'), { target: { value: '__create__' } });
    fireEvent.change(screen.getByLabelText('新分类'), { target: { value: 'Tech' } });
    fireEvent.click(screen.getByRole('button', { name: '确认新分类' }));
    fireEvent.click(screen.getByLabelText('启用-0'));

    await waitFor(() => {
      expect(useSettingsStore.getState().validationErrors['rss.sources.0.url']).toContain('validate');
    });
    expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
    expect(screen.getByText('修复错误以保存')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('验证链接-0'));

    await waitFor(() => {
      const saved = useSettingsStore.getState().persistedSettings.rss.sources;
      expect(saved).toHaveLength(1);
      expect(saved[0].name).toBe('Tech Feed Updated');
      expect(saved[0].url).toBe('https://example.com/success.xml');
      expect(saved[0].category).toBe('Tech');
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
    expect(screen.getByLabelText('settings-sections')).toBeInTheDocument();
  });
});
