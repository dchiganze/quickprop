import { useCallback, useEffect, useMemo, useState } from 'react';

const QUICKPROP_PUBLIC_ORIGIN = 'https://www.quickprop.melios.co.zw';
const META_APP_ID = import.meta.env.VITE_META_APP_ID ?? import.meta.env.VITE_FACEBOOK_APP_ID;
const META_SDK_VERSION = 'v25.0';

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
    fbAsyncInit?: () => void;
  }
}

let facebookSdkPromise: Promise<boolean> | null = null;

function getShareRequest(): { href: string; quote: string } | null {
  const params = new URLSearchParams(window.location.search);
  const href = params.get('href');
  const quote = params.get('quote') ?? '';
  if (!href) return null;

  try {
    const previewUrl = new URL(href);
    if (
      previewUrl.origin !== QUICKPROP_PUBLIC_ORIGIN ||
      !previewUrl.pathname.startsWith('/api/share/')
    ) {
      return null;
    }
    return { href: previewUrl.toString(), quote };
  } catch {
    return null;
  }
}

function initializeFacebookSdk(): boolean {
  if (!window.FB || !META_APP_ID) return false;
  try {
    window.FB.init({
      appId: META_APP_ID,
      xfbml: false,
      version: META_SDK_VERSION,
    });
  } catch {
    // The SDK may already have been initialized by another page script.
  }
  return true;
}

function loadFacebookSdk(): Promise<boolean> {
  if (facebookSdkPromise) return facebookSdkPromise;

  facebookSdkPromise = new Promise<boolean>((resolve) => {
    if (initializeFacebookSdk()) {
      resolve(true);
      return;
    }

    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ready && initializeFacebookSdk());
    };

    window.fbAsyncInit = () => finish(true);
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-quickprop-facebook-sdk="true"]',
    );
    const script = existingScript ?? document.createElement('script');
    script.addEventListener('error', () => finish(false), { once: true });
    if (!existingScript) {
      script.async = true;
      script.defer = true;
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.dataset.quickpropFacebookSdk = 'true';
      document.head.appendChild(script);
    }
  });

  return facebookSdkPromise;
}

function getFallbackUrl(href: string, quote: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(href)}&quote=${encodeURIComponent(quote)}`;
}

export default function FacebookShareLauncher() {
  const request = useMemo(() => getShareRequest(), []);
  const fallbackUrl = request ? getFallbackUrl(request.href, request.quote) : null;
  const [status, setStatus] = useState<'loading' | 'opened' | 'fallback' | 'error'>(
    request ? 'loading' : 'error',
  );
  const [message, setMessage] = useState(
    request
      ? 'Loading Facebook’s share composer…'
      : 'This share link is missing a valid QuickProp preview URL.',
  );

  const openShare = useCallback(async () => {
    if (!request) return;
    if (!META_APP_ID) {
      setStatus('fallback');
      setMessage('Facebook’s SDK is not configured on this public site. Use the standard share button below.');
      return;
    }

    const ready = await loadFacebookSdk();
    if (!ready || !window.FB) {
      setStatus('fallback');
      setMessage('Facebook’s SDK could not be loaded. Use the standard share button below.');
      return;
    }

    window.FB.ui(
      {
        method: 'share',
        display: 'popup',
        href: request.href,
        quote: request.quote,
      },
      (response) => {
        if (response?.error_message) {
          setStatus('fallback');
          setMessage(response.error_message);
        } else {
          setStatus('opened');
          setMessage('Facebook’s composer was opened. The caption was supplied through the SDK.');
        }
      },
    );
    setStatus('opened');
    setMessage('Facebook’s composer is opening with the caption supplied through the SDK.');
  }, [request]);

  useEffect(() => {
    document.title = 'Share on Facebook | QuickProp';
    if (request) void openShare();
  }, [openShare, request]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          QuickProp
        </p>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Share on Facebook
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">
          {message}
        </p>

        {request?.quote ? (
          <div className="mt-6 rounded-2xl border border-border bg-muted/50 p-4 text-left">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Caption ready
            </p>
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{request.quote}</p>
          </div>
        ) : null}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {request && META_APP_ID ? (
            <button
              type="button"
              onClick={() => void openShare()}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Try Facebook again
            </button>
          ) : null}
          {fallbackUrl ? (
            <a
              href={fallbackUrl}
              className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Use standard Facebook share
            </a>
          ) : null}
        </div>
      </section>
    </main>
  );
}