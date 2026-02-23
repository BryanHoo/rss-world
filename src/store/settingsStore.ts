import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { normalizePersistedSettings, defaultPersistedSettings } from '../features/settings/settingsSchema';
import { validateSettingsDraft } from '../features/settings/validateSettingsDraft';
import type { PersistedSettings, UserSettings } from '../types';

interface SessionSettings {
  ai: {
    apiKey: string;
  };
}

export interface SettingsDraft {
  persisted: PersistedSettings;
  session: SessionSettings;
}

interface SettingsState {
  persistedSettings: PersistedSettings;
  sessionSettings: SessionSettings;
  draft: SettingsDraft | null;
  validationErrors: Record<string, string>;
  loadDraft: () => void;
  updateDraft: (updater: (draft: SettingsDraft) => void) => void;
  saveDraft: () => { ok: boolean };
  discardDraft: () => void;

  // Compatibility layer for legacy consumers during migration.
  settings: UserSettings;
  updateSettings: (partial: Partial<UserSettings>) => void;
}

const defaultSessionSettings: SessionSettings = {
  ai: {
    apiKey: '',
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function cloneDeep<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function createDraft(persistedSettings: PersistedSettings, sessionSettings: SessionSettings): SettingsDraft {
  return {
    persisted: cloneDeep(persistedSettings),
    session: cloneDeep(sessionSettings),
  };
}

function extractNormalizeInput(input: unknown): unknown {
  if (!isRecord(input)) {
    return input;
  }

  if (isRecord(input.persistedSettings)) {
    return input.persistedSettings;
  }

  if (isRecord(input.settings)) {
    return input.settings;
  }

  return input;
}

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      persistedSettings: cloneDeep(defaultPersistedSettings),
      sessionSettings: cloneDeep(defaultSessionSettings),
      draft: null,
      validationErrors: {},
      settings: cloneDeep(defaultPersistedSettings.appearance),
      loadDraft: () =>
        set((state) => ({
          draft: createDraft(state.persistedSettings, state.sessionSettings),
          validationErrors: {},
        })),
      updateDraft: (updater) =>
        set((state) => {
          const baseDraft = state.draft ?? createDraft(state.persistedSettings, state.sessionSettings);
          const nextDraft = cloneDeep(baseDraft);
          updater(nextDraft);

          return { draft: nextDraft };
        }),
      saveDraft: () => {
        const state = get();
        if (!state.draft) {
          return { ok: true };
        }

        const validation = validateSettingsDraft(state.draft);
        if (!validation.valid) {
          set({ validationErrors: validation.errors });
          return { ok: false };
        }

        const nextPersistedSettings = cloneDeep(state.draft.persisted);
        const nextSessionSettings: SessionSettings = {
          ai: {
            apiKey: state.draft.session.ai.apiKey,
          },
        };

        set({
          persistedSettings: nextPersistedSettings,
          sessionSettings: nextSessionSettings,
          draft: null,
          validationErrors: {},
          settings: nextPersistedSettings.appearance,
        });

        return { ok: true };
      },
      discardDraft: () =>
        set({
          draft: null,
          validationErrors: {},
        }),
      updateSettings: (partial) =>
        set((state) => ({
          persistedSettings: {
            ...state.persistedSettings,
            appearance: { ...state.persistedSettings.appearance, ...partial },
          },
          settings: { ...state.settings, ...partial },
        })),
    }),
    {
      name: 'feedfuse-settings',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return noopStorage;
        }

        return window.localStorage;
      }),
      partialize: (state) => ({ persistedSettings: state.persistedSettings }),
      version: 2,
      migrate: (persistedState) => ({
        persistedSettings: normalizePersistedSettings(extractNormalizeInput(persistedState)),
      }),
      merge: (persistedState, currentState) => {
        const persistedInput = extractNormalizeInput(persistedState);
        const normalized = normalizePersistedSettings(persistedInput);
        const merged = {
          ...currentState,
          ...(isRecord(persistedState) ? persistedState : {}),
          persistedSettings: normalized,
          settings: normalized.appearance,
        };

        return merged as SettingsState;
      },
    }
  )
);
