export function deriveFeedIconUrl(siteUrl: string | null | undefined): string | null {
  if (!siteUrl) return null;

  try {
    const { origin } = new URL(siteUrl);
    return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(origin)}`;
  } catch {
    return null;
  }
}
