import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { DownloadResumable } from 'expo-file-system/legacy';
import { getStoredMediaUrl } from '@workspace/api-client-react';
import { getStoredMediaObjectPath } from '@/utils/listingPhoto';

const OFFLINE_MEDIA_DIR = 'quickprop-offline-media';
const PINNED_LISTING_MEDIA_DIR = 'quickprop-downloaded-listings';
const LISTING_DRAFTS_DIR = 'quickprop-listing-drafts';
const LOW_STORAGE_BYTES = 128 * 1024 * 1024;
const STORAGE_TARGET_BYTES = 256 * 1024 * 1024;
const inFlightDownloads = new Map<string, Promise<string>>();
const activeDownloadTasks = new Map<string, {
  userId: string;
  downloadId?: string;
  task: DownloadResumable;
}>();

export interface OfflineMediaDownloadOptions {
  durable?: boolean;
  downloadId?: string;
  onProgress?: (fraction: number) => void;
  isCancelled?: () => boolean;
}

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

function offlineMediaUri(uri: string, userId: string, durable = false): string | null {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return null;
  const stableUri = getStoredMediaObjectPath(uri) ?? uri;
  const extension = fileExtension(stableUri, 'media');
  const root = durable ? PINNED_LISTING_MEDIA_DIR : OFFLINE_MEDIA_DIR;
  return `${FileSystem.documentDirectory}${root}/${safeSegment(userId)}/${hash(stableUri)}.${extension}`;
}

async function ensureDirectory(uri: string): Promise<void> {
  const directory = uri.slice(0, uri.lastIndexOf('/') + 1);
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => undefined);
}

async function makeCacheSpace(userId: string, protectedUri?: string): Promise<boolean> {
  const free = await FileSystem.getFreeDiskStorageAsync().catch(() => Number.POSITIVE_INFINITY);
  if (free >= LOW_STORAGE_BYTES) return true;

  const directory = `${FileSystem.documentDirectory}${OFFLINE_MEDIA_DIR}/${safeSegment(userId)}/`;
  const names = await FileSystem.readDirectoryAsync(directory).catch(() => []);
  const files = await Promise.all(names.map(async name => {
    const uri = `${directory}${name}`;
    const info = await FileSystem.getInfoAsync(uri).catch(() => null);
    return info?.exists && !info.isDirectory
      ? { uri, size: info.size, modified: info.modificationTime }
      : null;
  }));
  const activeDownloadFiles = new Set(
    [...inFlightDownloads.keys()].flatMap(uri => [uri, `${uri}.part`]),
  );
  const oldestFirst = files
    .filter((file): file is NonNullable<typeof file> =>
      file !== null && file.uri !== protectedUri && !activeDownloadFiles.has(file.uri))
    .sort((left, right) => left.modified - right.modified);

  let availableBytes = free;
  for (const file of oldestFirst) {
    if (availableBytes >= STORAGE_TARGET_BYTES) break;
    try {
      await FileSystem.deleteAsync(file.uri, { idempotent: true });
      availableBytes += file.size;
    } catch {
      // Keep the cache entry if the OS refused to remove it.
    }
  }
  return availableBytes >= LOW_STORAGE_BYTES;
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
  return cached?.exists && cached.size > 0 ? cachedUri : undefined;
}

export async function cancelOfflineMediaDownload(downloadId: string): Promise<void> {
  const tasks = [...activeDownloadTasks.values()]
    .filter((entry) => entry.downloadId === downloadId)
    .map((entry) => entry.task);
  await Promise.all(tasks.map((task) => task.cancelAsync().catch(() => undefined)));
}

export async function removePinnedOfflineMedia(uri: string, userId: string): Promise<void> {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return;
  const userDirectory = `${FileSystem.documentDirectory}${PINNED_LISTING_MEDIA_DIR}/${safeSegment(userId)}/`;
  if (!uri.startsWith(userDirectory)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function cacheMediaForOffline(
  uri: string,
  userId: string,
  options: OfflineMediaDownloadOptions = {},
): Promise<string> {
  if (Platform.OS === 'web') throw new Error('Offline media downloads are available in the installed app.');
  const destination = offlineMediaUri(uri, userId, options.durable);
  if (!destination) throw new Error('Device storage is unavailable.');
  if (options.isCancelled?.()) throw new Error('The listing download was cancelled.');

  if (uri.startsWith('file://') && !options.durable) {
    const local = await FileSystem.getInfoAsync(uri);
    if (!local.exists) throw new Error('A listing file is no longer available on this device.');
    return uri;
  }
  if (uri.startsWith('file://') && options.durable) {
    const pinnedDirectory = `${FileSystem.documentDirectory}${PINNED_LISTING_MEDIA_DIR}/${safeSegment(userId)}/`;
    if (uri.startsWith(pinnedDirectory)) {
      const local = await FileSystem.getInfoAsync(uri).catch(() => null);
      if (local?.exists && local.size > 0) return uri;
    }
  }

  const existing = await FileSystem.getInfoAsync(destination).catch(() => null);
  if (existing?.exists && existing.size > 0) return destination;
  if (existing?.exists) {
    await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
  }

  const ongoing = inFlightDownloads.get(destination);
  if (ongoing) return ongoing;

  const download = (async () => {
    await ensureDirectory(destination);
    if (!(await makeCacheSpace(userId))) {
      throw new Error('There is not enough free device storage to save this listing offline.');
    }

    if (uri.startsWith('file://')) {
      const source = await FileSystem.getInfoAsync(uri).catch(() => null);
      if (!source?.exists || source.isDirectory) {
        throw new Error('A listing file is no longer available on this device.');
      }
      const free = await FileSystem.getFreeDiskStorageAsync().catch(() => Number.POSITIVE_INFINITY);
      if (free - source.size < LOW_STORAGE_BYTES) {
        throw new Error('There is not enough free device storage to save this listing offline.');
      }
      if (options.isCancelled?.()) throw new Error('The listing download was cancelled.');
      await FileSystem.copyAsync({ from: uri, to: destination });
      const copied = await FileSystem.getInfoAsync(destination).catch(() => null);
      if (!copied?.exists || copied.size <= 0) {
        await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
        throw new Error('A listing photo could not be saved on this device.');
      }
      return destination;
    }

    const objectPath = getStoredMediaObjectPath(uri);
    const downloadUrl = objectPath
      ? (await getStoredMediaUrl({ objectPath })).url
      : uri;
    if (!/^https?:\/\//i.test(downloadUrl)) {
      throw new Error('This listing photo cannot be cached.');
    }
    if (options.isCancelled?.()) throw new Error('The listing download was cancelled.');

    const temporaryUri = `${destination}.part`;
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
    const task = FileSystem.createDownloadResumable(
      downloadUrl,
      temporaryUri,
      {},
      (progress) => {
        if (progress.totalBytesExpectedToWrite > 0) {
          options.onProgress?.(
            Math.min(1, progress.totalBytesWritten / progress.totalBytesExpectedToWrite),
          );
        }
      },
    );
    activeDownloadTasks.set(destination, { userId, downloadId: options.downloadId, task });
    try {
      if (options.isCancelled?.()) {
        await task.cancelAsync();
        throw new Error('The listing download was cancelled.');
      }
      const result = await task.downloadAsync();
      if (!result) throw new Error('The listing download was cancelled.');
      if (result.status < 200 || result.status >= 300) {
        throw new Error('A listing photo could not be downloaded.');
      }
      const downloaded = await FileSystem.getInfoAsync(temporaryUri);
      if (!downloaded.exists || downloaded.size <= 0) {
        throw new Error('The listing photo download was incomplete.');
      }
      await FileSystem.moveAsync({ from: temporaryUri, to: destination });
      await makeCacheSpace(userId, destination);
      return destination;
    } catch (error) {
      await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
      await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
      throw error instanceof Error
        ? error
        : new Error('A listing photo could not be downloaded. Check your connection and try again.');
    } finally {
      activeDownloadTasks.delete(destination);
    }
  })();

  inFlightDownloads.set(destination, download);
  try {
    return await download;
  } finally {
    inFlightDownloads.delete(destination);
  }
}

export async function clearCachedOfflineMediaForUser(userId: string | null | undefined): Promise<void> {
  if (!userId || Platform.OS === 'web' || !FileSystem.documentDirectory) return;
  const directories = [
    `${FileSystem.documentDirectory}${OFFLINE_MEDIA_DIR}/${safeSegment(userId)}/`,
    `${FileSystem.documentDirectory}${PINNED_LISTING_MEDIA_DIR}/${safeSegment(userId)}/`,
  ];
  const tasks = [...activeDownloadTasks.entries()]
    .filter(([, entry]) => entry.userId === userId)
    .map(([, entry]) => entry.task.cancelAsync().catch(() => undefined));
  await Promise.all(tasks);
  const activeDownloads = [...inFlightDownloads.entries()]
    .filter(([destination]) => directories.some((directory) => destination.startsWith(directory)))
    .map(([, download]) => download.catch(() => undefined));
  await Promise.all(activeDownloads);
  await Promise.all(directories.map((directory) =>
    FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => undefined)));
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
