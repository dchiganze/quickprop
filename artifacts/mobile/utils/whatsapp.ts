import { Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Property } from '@/types';
import { getPrimaryListingPhoto } from '@/utils/listingPhoto';
import { propertyShareLinks } from '@/utils/shareLinks';

/**
 * Share a prefilled text message to WhatsApp.
 *
 * WhatsApp's direct iOS URL handler can discard a message body in standalone
 * builds even when it works in Expo Go. On iOS, the system share sheet hands
 * WhatsApp the complete plain-text payload instead. The recipient then picks
 * WhatsApp from the share sheet.
 */
export async function openWhatsAppMessage(message: string): Promise<void> {
  const encodedMessage = encodeURIComponent(message);

  if (Platform.OS === 'web') {
    await Linking.openURL(`https://api.whatsapp.com/send?text=${encodedMessage}`);
    return;
  }

  if (Platform.OS === 'ios') {
    await Share.share({ message });
    return;
  }

  try {
    const canOpenWhatsApp = await Linking.canOpenURL('whatsapp://send');
    if (canOpenWhatsApp) {
      await Linking.openURL(`whatsapp://send?text=${encodedMessage}`);
      return;
    }
  } catch {
    // Fall through to the native share sheet when WhatsApp is unavailable.
  }

  await Share.share({ message });
}

function formatPrice(property: Property): string {
  const value = property.price >= 1_000_000
    ? `${property.currency} ${(property.price / 1_000_000).toFixed(1)}M`
    : `${property.currency} ${property.price.toLocaleString()}`;
  return property.type === 'rent' ? `${value}/month` : value;
}

export function buildWhatsAppStatusCaption(property: Property): string {
  const homeLabel = property.bedrooms
    ? `${property.bedrooms}-bed ${property.type === 'rent' ? 'rental' : 'home'}`
    : property.type === 'rent' ? 'Rental property' : 'Property for sale';
  const description = property.description?.replace(/\s+/g, ' ').trim();
  const shortDescription = description
    ? description.slice(0, 160) + (description.length > 160 ? '…' : '')
    : '';
  const links = propertyShareLinks(property);

  return [
    `🏠 ${homeLabel} in ${property.suburb}`,
    `💰 ${formatPrice(property)}${property.negotiable ? ' · Negotiable' : ''}`,
    shortDescription,
    `View details: ${links.webUrl}`,
  ].filter(Boolean).join('\n');
}

function getShareMimeType(uri: string): string {
  const path = uri.split(/[?#]/)[0].toLowerCase();
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function getShareablePhotoUri(uri: string): Promise<string> {
  if (!/^https?:\/\//i.test(uri)) return uri;

  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) throw new Error('Unable to prepare the listing photo for sharing.');

  const extension = getShareMimeType(uri) === 'image/png' ? 'png' : getShareMimeType(uri) === 'image/webp' ? 'webp' : 'jpg';
  const destination = `${cacheDirectory}quickprop-status-${Date.now()}.${extension}`;
  const download = await FileSystem.downloadAsync(uri, destination);

  if (download.status < 200 || download.status >= 300) {
    throw new Error('Unable to download the listing photo for sharing.');
  }

  return download.uri;
}

export type WhatsAppPhotoShareDestination = 'status' | 'chat';

export async function shareListingPhotoWithCaption(
  property: Property,
  destination: WhatsAppPhotoShareDestination = 'status',
): Promise<{ caption: string; sharedPhoto: boolean }> {
  const caption = buildWhatsAppStatusCaption(property);
  await Clipboard.setStringAsync(caption);

  if (Platform.OS === 'web') {
    await Share.share({ message: caption });
    return { caption, sharedPhoto: false };
  }

  const photoUri = getPrimaryListingPhoto(property);
  if (!photoUri) {
    throw new Error('Add a main listing photo before sharing it to WhatsApp Status.');
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  const localPhotoUri = await getShareablePhotoUri(photoUri);
  await Sharing.shareAsync(localPhotoUri, {
    dialogTitle: destination === 'status'
      ? 'Share property photo to WhatsApp Status'
      : 'Share property photo to WhatsApp chat',
    mimeType: getShareMimeType(localPhotoUri),
    UTI: getShareMimeType(localPhotoUri) === 'image/png' ? 'public.png' : 'public.jpeg',
  });

  return { caption, sharedPhoto: true };
}

export function shareListingPhotoToWhatsAppStatus(property: Property) {
  return shareListingPhotoWithCaption(property, 'status');
}