import type { PersistedSettings } from '../../types';

export interface SettingsDraft {
  persisted: PersistedSettings;
  session?: {
    ai?: {
      apiKey?: string;
    };
  };
}

export interface ValidateSettingsDraftResult {
  valid: boolean;
  errors: Record<string, string>;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isValidHttpUrl(url: string): boolean {
  if (!isValidUrl(url)) {
    return false;
  }

  const parsed = new URL(url);
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

function validateRss(draft: SettingsDraft, errors: Record<string, string>) {
  const sources = draft.persisted.rss?.sources;
  if (!Array.isArray(sources)) {
    return;
  }

  sources.forEach((source, index) => {
    const nameKey = `rss.sources.${index}.name`;
    const urlKey = `rss.sources.${index}.url`;

    if (!source.name.trim()) {
      errors[nameKey] = 'Name is required.';
    }

    const url = source.url.trim();
    if (!url) {
      errors[urlKey] = 'URL is required.';
      return;
    }

    if (!isValidHttpUrl(url)) {
      errors[urlKey] = 'URL must use http or https.';
    }
  });
}

function validateAi(draft: SettingsDraft, errors: Record<string, string>) {
  const apiBaseUrl = draft.persisted.ai?.apiBaseUrl;
  if (!apiBaseUrl) {
    return;
  }

  if (!isValidUrl(apiBaseUrl)) {
    errors['ai.apiBaseUrl'] = 'API base URL must be a valid URL.';
  }
}

export function validateSettingsDraft(draft: SettingsDraft): ValidateSettingsDraftResult {
  const errors: Record<string, string> = {};

  validateRss(draft, errors);
  validateAi(draft, errors);

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
