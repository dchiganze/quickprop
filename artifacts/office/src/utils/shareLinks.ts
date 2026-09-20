export const QUICKPROP_PUBLIC_ORIGIN = 'https://www.quickprop.melios.co.zw';
export const QUICKPROP_SHARE_PREVIEW_VERSION = '8';

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

export function getFacebookShareUrl(previewUrl: string, caption: string): string {
  // Use Facebook's public sharer endpoint. The app-dialog endpoint requires
  // an app ID and an exact redirect configuration, and an invalid/stale
  // configuration sends users to Facebook's "Page Isn't Available" screen.
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(previewUrl)}&quote=${encodeURIComponent(caption)}`;
}

export async function ensurePublicSharePreview(previewUrl: string): Promise<void> {
  const response = await fetch(previewUrl, {
    cache: 'no-store',
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error('This listing is not published on the live QuickProp site. Publish it before sharing.');
  }
}