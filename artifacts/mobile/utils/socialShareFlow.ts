export function isShareCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('cancel') || message.includes('dismiss') || message.includes('user did not share');
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
