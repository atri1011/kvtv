const QUARK_SHARE_HOSTS = new Set(['pan.quark.cn']);

export const QUARK_SHARE_SOURCE_ID = 'quark-share';

export interface QuarkShareReference {
  shareId: string;
  dirId: string;
  normalizedUrl: string;
}

function toUrlCandidate(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

export function parseQuarkShareUrl(input: string): QuarkShareReference | null {
  const url = toUrlCandidate(input);
  if (!url || !QUARK_SHARE_HOSTS.has(url.hostname)) {
    return null;
  }

  const shareIdMatch = url.pathname.match(/^\/s\/([0-9a-z]+)$/i);
  if (!shareIdMatch) {
    return null;
  }

  const dirIdMatch = url.hash.match(/\/list\/share\/([0-9a-f]{32})/i);
  const shareId = shareIdMatch[1];
  const dirId = dirIdMatch?.[1] ?? '0';
  const normalizedUrl = buildQuarkShareUrl(shareId, dirId);

  return {
    shareId,
    dirId,
    normalizedUrl,
  };
}

export function buildQuarkShareUrl(shareId: string, dirId: string = '0'): string {
  return dirId === '0'
    ? `https://pan.quark.cn/s/${shareId}`
    : `https://pan.quark.cn/s/${shareId}#/list/share/${dirId}`;
}

export function buildQuarkPlayerHref(input: string, isPremium = false): string | null {
  const parsed = parseQuarkShareUrl(input);
  if (!parsed) {
    return null;
  }

  const params = new URLSearchParams({
    id: parsed.normalizedUrl,
    source: QUARK_SHARE_SOURCE_ID,
  });

  if (isPremium) {
    params.set('premium', '1');
  }

  return `/player?${params.toString()}`;
}
