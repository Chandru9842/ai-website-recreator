/**
 * URL normalization and asset resolution helpers
 */

export function normalizeUrl(inputUrl: string): string {
  let url = inputUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  const parsed = new URL(url);
  return parsed.href;
}

export function resolveAssetUrl(rawUrl: string, baseUrl: string): string {
  if (!rawUrl || rawUrl.trim() === '') return '';
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('data:')) return trimmed; // keep data URI if small
  try {
    const resolved = new URL(trimmed, baseUrl);
    return resolved.href;
  } catch {
    return trimmed;
  }
}

export function isValidHttpUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
