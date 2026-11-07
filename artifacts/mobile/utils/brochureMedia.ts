import * as FileSystem from 'expo-file-system/legacy';
import { getStoredMediaUrl } from '@workspace/api-client-react';
import type { Property } from '@/types';
import { getStoredMediaObjectPath } from '@/utils/listingPhoto';
import { getCachedOfflineMediaUri } from '@/utils/offlineMedia';

let temporaryAssetSequence = 0;

function imageMimeType(uri: string, contentType?: string): string {
  const responseType = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  if (responseType?.startsWith('image/')) return responseType;

  const extension = uri.split(/[?#]/, 1)[0].split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  return 'image/jpeg';
}

async function imageDataUri(uri: string, userId?: string): Promise<string> {
  const source = uri.trim();
  if (source.startsWith('data:image/')) return source;

  let localUri = source.startsWith('file://') || source.startsWith('content://')
    ? source
    : undefined;
  if (!localUri && userId) {
    localUri = await getCachedOfflineMediaUri(source, userId).catch(() => undefined);
  }

  if (localUri) {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64) throw new Error('The image file is empty.');
    return `data:${imageMimeType(source)};base64,${base64}`;
  }

  const objectPath = getStoredMediaObjectPath(source);
  const downloadUrl = objectPath
    ? (await getStoredMediaUrl({ objectPath })).url
    : source;
  if (!/^https?:\/\//i.test(downloadUrl)) {
    throw new Error('The image does not have a downloadable address.');
  }

  const cacheDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!cacheDirectory) throw new Error('Device storage is unavailable.');
  const temporaryUri = `${cacheDirectory}quickprop-brochure-${Date.now()}-${temporaryAssetSequence += 1}`;

  try {
    const downloaded = await FileSystem.downloadAsync(downloadUrl, temporaryUri);
    if (downloaded.status < 200 || downloaded.status >= 300) {
      throw new Error(`The image request returned ${downloaded.status}.`);
    }
    const info = await FileSystem.getInfoAsync(downloaded.uri);
    if (!info.exists || info.size === 0) throw new Error('The downloaded image is empty.');
    const base64 = await FileSystem.readAsStringAsync(downloaded.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64) throw new Error('The downloaded image could not be read.');
    const contentType = downloaded.headers['Content-Type'] ?? downloaded.headers['content-type'];
    return `data:${imageMimeType(downloadUrl, contentType)};base64,${base64}`;
  } finally {
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
  }
}

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }));

  return results;
}

export async function prepareBrochureMedia(
  properties: Property[],
  logoUri: string | null | undefined,
  userId?: string,
): Promise<{ properties: Property[]; logoUrl?: string }> {
  const mediaUris = new Map<string, 'listing photo' | 'agency logo'>();
  for (const property of properties) {
    for (const uri of (property.photos ?? []).slice(0, 4)) {
      const trimmed = uri?.trim();
      if (trimmed) mediaUris.set(trimmed, 'listing photo');
    }
  }
  const trimmedLogo = logoUri?.trim();
  if (trimmedLogo) mediaUris.set(trimmedLogo, 'agency logo');

  const resolvedEntries = await mapWithLimit(
    [...mediaUris.entries()],
    4,
    async ([uri, kind]) => {
      try {
        return [uri, await imageDataUri(uri, userId)] as const;
      } catch {
        throw new Error(
          kind === 'agency logo'
            ? 'Could not prepare the agency logo. Check your connection and retry.'
            : 'Could not prepare a listing photo for the brochure. Check your connection and retry.',
        );
      }
    },
  );
  const resolved = new Map(resolvedEntries);

  return {
    properties: properties.map((property) => ({
      ...property,
      photos: (property.photos ?? []).map((uri, index) => {
        const trimmed = uri?.trim();
        return index < 4 && trimmed ? resolved.get(trimmed) ?? uri : uri;
      }),
    })),
    logoUrl: trimmedLogo ? resolved.get(trimmedLogo) : undefined,
  };
}
