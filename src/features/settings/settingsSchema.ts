import type {
  AIPersistedSettings,
  AppearanceSettings,
  Category,
  PersistedSettings,
  RssSettings,
  RssSourceSetting,
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
  model: '',
  apiBaseUrl: '',
};

const defaultRssSettings: RssSettings = {
  sources: [],
};

export const defaultPersistedSettings: PersistedSettings = {
  appearance: defaultAppearanceSettings,
  ai: defaultAISettings,
  categories: [],
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
    model: readString(aiInput.model, defaultAISettings.model),
    apiBaseUrl: readString(aiInput.apiBaseUrl, defaultAISettings.apiBaseUrl),
  };
}

function normalizeRssSource(source: unknown, index: number): RssSourceSetting {
  if (!isRecord(source)) {
    return {
      id: `source-${index}`,
      name: '',
      url: '',
      category: null,
      enabled: true,
    };
  }

  const legacyFolder = typeof source.folder === 'string' ? source.folder : null;
  const category = typeof source.category === 'string' ? source.category : legacyFolder;

  return {
    id: readString(source.id, `source-${index}`),
    name: readString(source.name, ''),
    url: readString(source.url, ''),
    category,
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

function normalizeCategories(input: Record<string, unknown>, rss: RssSettings): Category[] {
  const result: Category[] = [];
  const seen = new Set<string>();

  const pushCategory = (name: string, id?: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    const key = trimmedName.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);

    const trimmedId = id?.trim();
    result.push({
      id: trimmedId ? trimmedId : `cat-${result.length}`,
      name: trimmedName,
    });
  };

  const rawCategories = Array.isArray(input.categories) ? input.categories : [];

  rawCategories.forEach((item) => {
    if (!isRecord(item)) {
      return;
    }

    pushCategory(readString(item.name, ''), readString(item.id, ''));
  });

  rss.sources.forEach((source) => {
    if (!source.category) {
      return;
    }
    pushCategory(source.category);
  });

  return result;
}

export function normalizePersistedSettings(input: unknown): PersistedSettings {
  const recordInput = isRecord(input) ? input : {};
  const normalizedRss = normalizeRssSettings(recordInput);

  return {
    appearance: normalizeAppearanceSettings(recordInput),
    ai: normalizeAISettings(recordInput),
    categories: normalizeCategories(recordInput, normalizedRss),
    rss: normalizedRss,
  };
}
