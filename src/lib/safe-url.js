/**
 * Returns the URL only if it uses a safe http(s) scheme, otherwise null.
 * Blocks javascript:, data:, vbscript: and other injection vectors before
 * a user-supplied URL is placed in an href.
 */
export function safeExternalUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
    return null;
  } catch {
    return null;
  }
}