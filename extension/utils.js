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
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function createLinkItem(url, title = 'Saved Link', isGeneric = true) {
  return {
    id: crypto.randomUUID(),
    url: ensureProtocol(url),
    title: title || url,
    isGeneric
  };
}