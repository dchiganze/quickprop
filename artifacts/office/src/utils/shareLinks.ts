export const QUICKPROP_PUBLIC_ORIGIN = 'https://www.quickprop.melios.co.zw';
export const QUICKPROP_SHARE_PREVIEW_VERSION = '8';
const META_APP_ID = import.meta.env.VITE_META_APP_ID ?? import.meta.env.VITE_FACEBOOK_APP_ID;
const META_SDK_VERSION = 'v25.0';
export const FACEBOOK_SDK_SHARE_ENABLED = import.meta.env.VITE_ENABLE_FACEBOOK_SDK_SHARE === 'true';

type FacebookShareResponse = {
  error_message?: string;
};

type FacebookSdk = {
  init: (config: { appId: string; xfbml: boolean; version: string }) => void;
  ui: (
    params: { method: 'share'; href: string; quote?: string; display?: 'popup' },
    callback?: (response?: FacebookShareResponse) => void,
  ) => void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
  }
}

let facebookSdkInitialized = false;
let facebookSdkPromise: Promise<boolean> | null = null;

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

function initializeFacebookSdk(): boolean {
  if (typeof window === 'undefined' || !window.FB || !META_APP_ID) return false;
  if (!facebookSdkInitialized) {
    try {
      window.FB.init({
        appId: META_APP_ID,
        xfbml: false,
        version: META_SDK_VERSION,
      });
    } catch {
      // Another script may already have initialized the shared Facebook SDK.
    }
    facebookSdkInitialized = true;
  }
  return true;
}

export function preloadFacebookSdk(): void {
  if (typeof window === 'undefined' || !META_APP_ID || facebookSdkPromise) return;

  facebookSdkPromise = new Promise<boolean>((resolve) => {
    if (initializeFacebookSdk()) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-quickprop-facebook-sdk="true"]',
    );
    const script = existingScript ?? document.createElement('script');
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ready && initializeFacebookSdk());
    };

    script.addEventListener('load', () => finish(true), { once: true });
    script.addEventListener('error', () => finish(false), { once: true });

    if (!existingScript) {
      script.async = true;
      script.defer = true;
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.dataset.quickpropFacebookSdk = 'true';
      document.head.appendChild(script);
    }
  });
}

export async function openFacebookSdkShare(previewUrl: string, caption: string): Promise<boolean> {
  if (!META_APP_ID) return false;
  preloadFacebookSdk();
  const ready = await facebookSdkPromise;
  if (!ready || !window.FB) return false;

  window.FB.ui(
    {
      method: 'share',
      display: 'popup',
      href: previewUrl,
      quote: caption,
    },
    (response) => {
      if (response?.error_message) {
        console.warn('Facebook SDK Share Dialog error:', response.error_message);
      }
    },
  );
  await navigator.clipboard?.writeText(caption).catch(() => {});
  return true;
}

export function getFacebookShareUrl(previewUrl: string, caption: string): string {
  // The public sharer does not require the Meta app's App Domains allowlist.
  // Keep the caption in the URL for clients that support quote, and copy it
  // separately because Facebook may ignore it on this endpoint.
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(previewUrl)}&quote=${encodeURIComponent(caption)}`;
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