export function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('chrome-extension://')
  );
}

export function normalizeUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    const host = parsed.hostname.replace(/^www\./, '');
    let path = parsed.pathname;
    if (path.endsWith('/') && path.length > 1) path = path.slice(0, -1);
    return (host + path + parsed.search).toLowerCase();
  } catch {
    return urlString.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
  }
}

export function ensureProtocol(url) {
  if (!url) return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (['http:', 'https:'].includes(parsed.protocol)) {
      return parsed.href;
    }
    return null;
  } catch {
    try {
      const parsed = new URL(`https://${trimmed}`);
      return parsed.href;
    } catch {
      return null;
    }
  }
}

export function createLinkItem(url, title = 'Saved Link', isGeneric = true) {
  const validUrl = ensureProtocol(url);
  if (!validUrl) return null;

  return {
    id: crypto.randomUUID(),
    url: validUrl,
    title: title || validUrl,
    isGeneric
  };
}