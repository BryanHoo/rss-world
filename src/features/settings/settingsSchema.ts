import type {
  AIPersistedSettings,
  AppearanceSettings,
  PersistedSettings,
  RssSettings,
  RssSourceSetting,
  ShortcutBindings,
  ShortcutsSettings,
} from '../../types';

const defaultAppearanceSettings: AppearanceSettings = {
  theme: 'auto',
  fontSize: 'medium',
  fontFamily: 'sans',
  lineHeight: 'normal',
};

const defaultAISettings: AIPersistedSettings = {
  summaryEnabled: false,
  translateEnabled: false,
  autoSummarize: false,
  provider: 'openai-compatible',
  model: '',
  apiBaseUrl: '',
};

const defaultShortcutBindings: ShortcutBindings = {
  nextArticle: 'j',
  prevArticle: 'k',
  toggleStar: 's',
  markRead: 'm',
  openOriginal: 'v',
};

const defaultShortcutsSettings: ShortcutsSettings = {
  enabled: true,
  bindings: defaultShortcutBindings,
};

const defaultRssSettings: RssSettings = {
  sources: [],
};

export const defaultPersistedSettings: PersistedSettings = {
  appearance: defaultAppearanceSettings,
  ai: defaultAISettings,
  shortcuts: defaultShortcutsSettings,
  rss: defaultRssSettings,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeAppearanceSettings(input: Record<string, unknown>): AppearanceSettings {
  const appearanceInput = isRecord(input.appearance) ? input.appearance : input;

  return {
    theme: readEnum(appearanceInput.theme, ['light', 'dark', 'auto'], defaultAppearanceSettings.theme),
    fontSize: readEnum(appearanceInput.fontSize, ['small', 'medium', 'large'], defaultAppearanceSettings.fontSize),
    fontFamily: readEnum(appearanceInput.fontFamily, ['sans', 'serif'], defaultAppearanceSettings.fontFamily),
    lineHeight: readEnum(
      appearanceInput.lineHeight,
      ['compact', 'normal', 'relaxed'],
      defaultAppearanceSettings.lineHeight
    ),
  };
}

function normalizeAISettings(input: Record<string, unknown>): AIPersistedSettings {
  const aiInput = isRecord(input.ai) ? input.ai : {};

  return {
    summaryEnabled: readBoolean(aiInput.summaryEnabled, defaultAISettings.summaryEnabled),
    translateEnabled: readBoolean(aiInput.translateEnabled, defaultAISettings.translateEnabled),
    autoSummarize: readBoolean(aiInput.autoSummarize, defaultAISettings.autoSummarize),
    provider: readString(aiInput.provider, defaultAISettings.provider),
    model: readString(aiInput.model, defaultAISettings.model),
    apiBaseUrl: readString(aiInput.apiBaseUrl, defaultAISettings.apiBaseUrl),
  };
}

function normalizeShortcutBindings(input: Record<string, unknown>): ShortcutBindings {
  const bindings = isRecord(input.bindings) ? input.bindings : {};

  return {
    nextArticle: readString(bindings.nextArticle, defaultShortcutBindings.nextArticle),
    prevArticle: readString(bindings.prevArticle, defaultShortcutBindings.prevArticle),
    toggleStar: readString(bindings.toggleStar, defaultShortcutBindings.toggleStar),
    markRead: readString(bindings.markRead, defaultShortcutBindings.markRead),
    openOriginal: readString(bindings.openOriginal, defaultShortcutBindings.openOriginal),
  };
}

function normalizeShortcutsSettings(input: Record<string, unknown>): ShortcutsSettings {
  const shortcutsInput = isRecord(input.shortcuts) ? input.shortcuts : {};

  return {
    enabled: readBoolean(shortcutsInput.enabled, defaultShortcutsSettings.enabled),
    bindings: normalizeShortcutBindings(shortcutsInput),
  };
}

function normalizeRssSource(source: unknown, index: number): RssSourceSetting {
  if (!isRecord(source)) {
    return {
      id: `source-${index}`,
      name: '',
      url: '',
      folder: null,
      enabled: true,
    };
  }

  return {
    id: readString(source.id, `source-${index}`),
    name: readString(source.name, ''),
    url: readString(source.url, ''),
    folder: typeof source.folder === 'string' ? source.folder : null,
    enabled: readBoolean(source.enabled, true),
  };
}

function normalizeRssSettings(input: Record<string, unknown>): RssSettings {
  const rssInput = isRecord(input.rss) ? input.rss : {};
  const sources = Array.isArray(rssInput.sources)
    ? rssInput.sources.map((source, index) => normalizeRssSource(source, index))
    : [];

  return { sources };
}

export function normalizePersistedSettings(input: unknown): PersistedSettings {
  const recordInput = isRecord(input) ? input : {};

  return {
    appearance: normalizeAppearanceSettings(recordInput),
    ai: normalizeAISettings(recordInput),
    shortcuts: normalizeShortcutsSettings(recordInput),
    rss: normalizeRssSettings(recordInput),
  };
}
