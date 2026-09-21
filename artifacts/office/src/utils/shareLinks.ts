export const QUICKPROP_PUBLIC_ORIGIN = 'https://www.quickprop.melios.co.zw';
export const QUICKPROP_SHARE_PREVIEW_VERSION = '8';
export const QUICKPROP_FACEBOOK_SHARE_LAUNCHER_PATH = '/share/facebook';

function isDevelopmentHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.replit.dev')
  );
}

export function isQuickPropPreview(currentOrigin?: string): boolean {
  const origin = currentOrigin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  try {
    return isDevelopmentHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function getQuickPropPublicOrigin(currentOrigin?: string): string {
  const origin = currentOrigin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  try {
    const url = new URL(origin);
    return isDevelopmentHost(url.hostname) ? url.origin : QUICKPROP_PUBLIC_ORIGIN;
  } catch {
    return QUICKPROP_PUBLIC_ORIGIN;
  }
}

export function getFacebookShareLauncherUrl(previewUrl: string, caption: string): string {
  const params = new URLSearchParams({
    href: previewUrl,
    quote: caption,
  });
  return `${QUICKPROP_PUBLIC_ORIGIN}${QUICKPROP_FACEBOOK_SHARE_LAUNCHER_PATH}?${params.toString()}`;
}

export async function ensurePublicSharePreview(previewUrl: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(previewUrl, {
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    throw new Error('This listing is not published on the live QuickProp site. Publish it before sharing.');
  }
  // The public preview intentionally redirects normal browsers to the
  // marketplace page. Browsers expose that cross-origin redirect as an
  // opaque response, even though the preview itself is reachable by Meta.
  if (response.type === 'opaqueredirect') return;
  if (!response.ok) {
    throw new Error('This listing is not published on the live QuickProp site. Publish it before sharing.');
  }
}