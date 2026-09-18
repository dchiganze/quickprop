export const QUICKPROP_PUBLIC_ORIGIN = 'https://www.quickprop.melios.co.zw';
export const QUICKPROP_SHARE_PREVIEW_VERSION = '2';

function isDevelopmentHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.replit.dev')
  );
}

export function getQuickPropPublicOrigin(currentOrigin?: string): string {
  const origin = currentOrigin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  try {
    const url = new URL(origin);
    return isDevelopmentHost(url.hostname) ? QUICKPROP_PUBLIC_ORIGIN : url.origin;
  } catch {
    return QUICKPROP_PUBLIC_ORIGIN;
  }
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