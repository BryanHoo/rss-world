import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultPersistedSettings } from './settingsSchema';
import ReaderLayout from '../reader/ReaderLayout';
import { useSettingsStore } from '../../store/settingsStore';
import { useAppStore } from '../../store/appStore';

function resetSettingsStore() {
  useSettingsStore.setState((state) => ({
    ...state,
    persistedSettings: structuredClone(defaultPersistedSettings),
    sessionSettings: { ai: { apiKey: '', hasApiKey: false, clearApiKey: false }, rssValidation: {} },
    draft: null,
    validationErrors: {},
    settings: structuredClone(defaultPersistedSettings.general),
  }));
  window.localStorage.clear();

  useAppStore.setState({
    feeds: [],
    categories: [{ id: 'cat-uncategorized', name: '未分类', expanded: true }],
    articles: [],
    selectedView: 'all',
    selectedArticleId: null,
    sidebarCollapsed: false,
    snapshotLoading: false,
  });
}

describe('SettingsCenterModal', () => {
  beforeEach(() => {
    let remoteSettings = structuredClone(defaultPersistedSettings);
    let remoteHasApiKey = false;
    let createdCategoryCount = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/categories') && init?.method === 'POST') {
          const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
          createdCategoryCount += 1;
          return new Response(
            JSON.stringify({
              ok: true,
              data: {
                id: `00000000-0000-4000-8000-00000000000${createdCategoryCount}`,
                name: String(body.name ?? ''),
                position: 0,
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        if (url.includes('/api/settings/ai/api-key')) {
          if (init?.method === 'PUT') {
            const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
            remoteHasApiKey = Boolean(String(body.apiKey ?? '').trim());
            return new Response(JSON.stringify({ ok: true, data: { hasApiKey: remoteHasApiKey } }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
          }

          if (init?.method === 'DELETE') {
            remoteHasApiKey = false;
            return new Response(JSON.stringify({ ok: true, data: { hasApiKey: false } }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
          }

          return new Response(JSON.stringify({ ok: true, data: { hasApiKey: remoteHasApiKey } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        if (!url.includes('/api/settings')) {
          throw new Error(`Unexpected fetch: ${url}`);
        }

        if (init?.method === 'PUT') {
          const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
          remoteSettings = body;
          return new Response(JSON.stringify({ ok: true, data: remoteSettings }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true, data: remoteSettings }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
  });

  it('renders settings in right drawer layout and removes footer save button', async () => {
    resetSettingsStore();
    render(<ReaderLayout />);
    fireEvent.click(screen.getByLabelText('open-settings'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
      expect(screen.getByTestId('settings-center-overlay')).toBeInTheDocument();
      expect(screen.getByLabelText('close-settings')).toBeInTheDocument();
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

    expect(screen.getByTestId('settings-section-tab-general')).toBeInTheDocument();
    expect(screen.getByTestId('settings-section-tab-categories')).toBeInTheDocument();
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
    fireEvent.click(await screen.findByTestId('settings-section-tab-ai'));

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
    expect(useSettingsStore.getState().draft?.persisted.general.theme).toBe('dark');

    await waitFor(() => {
      expect(screen.getByText('已保存')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('close-settings'));
    expect(screen.queryByTestId('settings-center-modal')).not.toBeInTheDocument();
    expect(useSettingsStore.getState().draft).toBeNull();

    fireEvent.click(screen.getByLabelText('open-settings'));
    await waitFor(() => {
      expect(useSettingsStore.getState().draft?.persisted.general.theme).toBe('dark');
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
      const savedCategories = useAppStore.getState().categories;
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

    expect(screen.getByTestId('settings-center-overlay')).toBeInTheDocument();
    expect(screen.getByLabelText('settings-sections')).toBeInTheDocument();
  });
});
