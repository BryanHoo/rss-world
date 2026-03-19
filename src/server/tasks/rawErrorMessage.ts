const MAX_RAW_ERROR_LENGTH = 800;
const REDACTED = '[REDACTED]';

function extractErrorText(err: unknown): string | null {
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    if (typeof err.message === 'string' && err.message.trim()) return err.message;
    if (typeof err.name === 'string' && err.name.trim()) return err.name;
    return null;
  }
  return null;
}

function redactSecrets(input: string): string {
  return input
    .replace(/Authorization:\s*Bearer\s+[^\s,;]+/gi, `Authorization: Bearer ${REDACTED}`)
    .replace(/Bearer\s+[^\s,;]+/gi, `Bearer ${REDACTED}`)
    .replace(/(api_key=)[^&\s]+/gi, `$1${REDACTED}`)
    .replace(/\b[A-Za-z0-9_\-.]{24,}\b/g, REDACTED);
}

export function toRawErrorMessage(err: unknown): string | null {
  const extracted = extractErrorText(err);
  if (!extracted) return null;

  const redacted = redactSecrets(extracted);
  const compact = redacted.replace(/\s+/g, ' ').trim();
  if (!compact) return null;

  return compact.slice(0, MAX_RAW_ERROR_LENGTH);
}
