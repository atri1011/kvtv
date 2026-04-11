export const QUARK_PROXY_COOKIE_NAME = 'kvideo_quark_cookie';

export function syncQuarkProxyCookie(value: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (!value.trim()) {
    document.cookie = `${QUARK_PROXY_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
    return;
  }

  document.cookie = `${QUARK_PROXY_COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
}
