import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getStoredMediaUrl } from '@workspace/api-client-react';
import { getStoredMediaObjectPath } from '@/utils/listingPhoto';

const OFFLINE_MEDIA_DIR = 'quickprop-offline-media';
const LISTING_DRAFTS_DIR = 'quickprop-listing-drafts';

function safeSegment(value: string): string {
  return value.replace(/[^a-z0-9_-]/gi, '_') || 'account';
}

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16);
}

function fileExtension(uri: string, fallback = 'jpg'): string {
  const match = uri.split(/[?#]/, 1)[0].match(/\.([a-z0-9]{2,5})$/i);
  return match?.[1]?.toLowerCase() ?? fallback;
}

function offlineMediaUri(uri: string, userId: string): string | null {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return null;
  const extension = fileExtension(uri, 'media');
  return `${FileSystem.documentDirectory}${OFFLINE_MEDIA_DIR}/${safeSegment(userId)}/${hash(uri)}.${extension}`;
}

async function ensureDirectory(uri: string): Promise<void> {
  const directory = uri.slice(0, uri.lastIndexOf('/') + 1);
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => undefined);
}

export async function getCachedOfflineMediaUri(uri: string, userId: string): Promise<string | undefined> {
  if (Platform.OS === 'web') return undefined;
  if (uri.startsWith('file://')) {
    const local = await FileSystem.getInfoAsync(uri).catch(() => null);
    return local?.exists ? uri : undefined;
  }
  const cachedUri = offlineMediaUri(uri, userId);
  if (!cachedUri) return undefined;
  const cached = await FileSystem.getInfoAsync(cachedUri).catch(() => null);
  return cached?.exists ? cachedUri : undefined;
}

export async function cacheMediaForOffline(uri: string, userId: string): Promise<string> {
  if (Platform.OS === 'web') throw new Error('Offline media downloads are available in the installed app.');
  if (uri.startsWith('file://')) {
    const local = await FileSystem.getInfoAsync(uri);
    if (!local.exists) throw new Error('A listing file is no longer available on this device.');
    return uri;
  }

  const destination = offlineMediaUri(uri, userId);
  if (!destination) throw new Error('Device storage is unavailable.');
  const existing = await FileSystem.getInfoAsync(destination).catch(() => null);
  if (existing?.exists) return destination;
  await ensureDirectory(destination);

  const objectPath = getStoredMediaObjectPath(uri);
  const downloadUrl = objectPath
    ? (await getStoredMediaUrl({ objectPath })).url
    : uri;
  if (!/^https?:\/\//i.test(downloadUrl)) {
    throw new Error('This listing file cannot be saved for offline use.');
  }

  const result = await FileSystem.downloadAsync(downloadUrl, destination);
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
    throw new Error('A listing file could not be downloaded. Check your connection and try again.');
  }
  return destination;
}

export async function removeCachedOfflineMedia(uri: string, userId: string): Promise<void> {
  if (Platform.OS === 'web' || uri.startsWith('file://')) return;
  const cachedUri = offlineMediaUri(uri, userId);
  if (cachedUri) await FileSystem.deleteAsync(cachedUri, { idempotent: true }).catch(() => undefined);
}

/** Copy picker/camera files out of the temporary cache before queueing a listing upload. */
export async function persistListingDraftMedia(uri: string, userId: string): Promise<string> {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory || uri.startsWith('http')) return uri;
  const directory = `${FileSystem.documentDirectory}${LISTING_DRAFTS_DIR}/${safeSegment(userId)}/`;
  if (uri.startsWith(directory)) return uri;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => undefined);
  const extension = fileExtension(uri, 'jpg');
  const destination = `${directory}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}
