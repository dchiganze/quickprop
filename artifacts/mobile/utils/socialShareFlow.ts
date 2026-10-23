export function isShareCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('cancel') || message.includes('dismiss') || message.includes('user did not share');
}

/** LinkedIn's public composer does not require an installed share extension. */
export async function openLinkedInPreviewShare(
  previewUrl: string,
  actions: {
    validatePreview: (url: string) => Promise<void>;
    beforeOpen?: () => Promise<void>;
    openUrl: (url: string) => Promise<unknown>;
  },
): Promise<void> {
  await actions.validatePreview(previewUrl);
  await actions.beforeOpen?.();
  await actions.openUrl(
    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(previewUrl)}`,
  );
}

/** Wait for the real iOS Modal.onDismiss event, not a guessed animation delay. */
export async function waitForShareModalDismissal(
  dismiss: (didDismiss: () => void) => void,
  timeoutMs = 4_000,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(
        'The sharing window could not close. Please open Share and try again.',
      )), timeoutMs);
      dismiss(resolve);
    });
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function prepareShareImage<T>(
  prepare: () => Promise<T>,
  timeoutMs = 15_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(prepare),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(
          'Preparing the property image took too long. Check your connection and try again.',
        )), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// Targeted iOS social handoffs can remain pending or open an App Store page.
// Use the image-only system chooser there; the caller copies the caption.
export async function runNativeSocialShare(
  platform: string,
  openChooser: () => Promise<unknown>,
  openTargeted: () => Promise<unknown>,
): Promise<void> {
  if (platform === 'ios') {
    await openChooser();
    return;
  }
  try {
    await openTargeted();
  } catch (error) {
    if (isShareCancellation(error)) return;
    await openChooser();
  }
}
