const LOCALHOST_INPUT_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function localhostDockerFallback(input: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }

  if (!LOCALHOST_INPUT_HOSTS.has(parsed.hostname.toLowerCase())) {
    return null;
  }

  const fallback = new URL(parsed.toString());
  fallback.hostname = 'host.docker.internal';
  return fallback.toString();
}

export function getFetchUrlCandidates(input: string): string[] {
  const fallback = localhostDockerFallback(input);
  if (!fallback || fallback === input) return [input];
  return [input, fallback];
}

