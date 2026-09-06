import { Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Property } from '@/types';
import { shareProperty } from '@workspace/api-client-react';
import { catalogueShareLinks, propertyShareLinks } from '@/utils/shareLinks';

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

export function buildWhatsAppCatalogueCaption(catalogueUrl: string): string {
  return `view my whole catalogue here: ${catalogueUrl}`;
}

async function recordPropertyShare(property: Property): Promise<void> {
  const remoteId = Number(property.id);
  if (Platform.OS === 'web' || !Number.isInteger(remoteId) || remoteId <= 0) return;
  try {
    await shareProperty(remoteId, { channel: 'whatsapp' });
  } catch {
    // Analytics must never prevent an agent from sharing the property.
  }
}

export async function sharePropertyToWhatsApp(
  property: Property,
  agentId: string | undefined,
  captureCard: () => Promise<string>,
): Promise<{ caption: string; sharedPhoto: boolean }> {
  const catalogueUrl = catalogueShareLinks(agentId).webUrl;
  const caption = buildWhatsAppCatalogueCaption(catalogueUrl);
  await Clipboard.setStringAsync(caption);

  if (Platform.OS === 'web') {
    await Share.share({ message: caption });
    return { caption, sharedPhoto: false };
  }

  const cardUri = await captureCard();
  await recordPropertyShare(property);

  try {
    const { default: NativeShare } = await import('react-native-share');
    await NativeShare.open({
      url: cardUri,
      type: 'image/jpeg',
      message: caption,
      title: `${property.referenceNumber} — ${property.suburb}`,
      failOnCancel: false,
      useInternalStorage: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('cancel') || message.includes('dismiss')) {
      return { caption, sharedPhoto: true };
    }

    if (!(await Sharing.isAvailableAsync())) throw error;
    await Sharing.shareAsync(cardUri, {
      dialogTitle: 'Share property to WhatsApp',
      mimeType: 'image/jpeg',
      UTI: 'public.jpeg',
    });
  }

  return { caption, sharedPhoto: true };
}

export type PropertySocialDestination = 'facebook' | 'instagram' | 'linkedin' | 'tiktok';

function buildSocialCaption(property: Property): string {
  return buildWhatsAppCatalogueCaption(catalogueShareLinks(property.agentId).webUrl);
}

export async function sharePropertyToSocial(
  property: Property,
  destination: PropertySocialDestination,
  captureCard: () => Promise<string>,
): Promise<void> {
  if (destination === 'tiktok') {
    // TikTok's iOS share extension accepts the image from Photos, but can
    // hide itself when the system payload contains a second text item. The
    // generic share helper already copies the caption for pasting, so send
    // TikTok only the JPEG, matching the Photos app handoff.
    await sharePropertyGeneric(
      property,
      captureCard,
      'Share property via TikTok',
      Platform.OS !== 'ios',
    );
    return;
  }

  const caption = buildSocialCaption(property);
  await Clipboard.setStringAsync(caption).catch(() => {});

  if (Platform.OS === 'web') {
    if (destination === 'facebook') {
      await Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(propertyShareLinks(property).webUrl)}`);
      return;
    }
    if (destination === 'linkedin') {
      await Linking.openURL(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(propertyShareLinks(property).webUrl)}`);
      return;
    }
    await Share.share({ message: caption });
    return;
  }

  // LinkedIn's targeted react-native-share implementation can remain pending
  // when the LinkedIn app is unavailable or rejects an image handoff. Use the
  // system share sheet instead so the agent can select LinkedIn without
  // blocking the share modal indefinitely.
  if (destination === 'linkedin') {
    await sharePropertyGeneric(property, captureCard, 'Share property to LinkedIn');
    return;
  }

  const cardUri = await captureCard();

  try {
    const { default: NativeShare } = await import('react-native-share');
    const social = {
      facebook: NativeShare.Social.FACEBOOK,
      instagram: NativeShare.Social.INSTAGRAM,
      linkedin: NativeShare.Social.LINKEDIN,
    }[destination] as Exclude<
      import('react-native-share').Social,
      import('react-native-share').Social.FacebookStories | import('react-native-share').Social.InstagramStories
    >;

    await NativeShare.shareSingle({
      social,
      url: cardUri,
      type: 'image/jpeg',
      message: caption,
      useInternalStorage: true,
    });
    return;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('cancel') || message.includes('dismiss')) return;
    if (!(await Sharing.isAvailableAsync())) throw error;
  }

  await Sharing.shareAsync(cardUri, {
    dialogTitle: `Share property to ${destination.charAt(0).toUpperCase() + destination.slice(1)}`,
    mimeType: 'image/jpeg',
    UTI: 'public.jpeg',
  });
}

export async function sharePropertyToFacebookStory(
  property: Property,
  captureCard: () => Promise<string>,
): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Facebook Stories sharing is available in the mobile app only.');
  }

  const metaAppId = process.env.EXPO_PUBLIC_META_APP_ID ?? process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  if (!metaAppId) {
    throw new Error('Facebook Stories sharing needs Meta app setup before it can be used.');
  }

  const cardUri = await captureCard();
  const propertyUrl = propertyShareLinks(property).webUrl;
  const { default: NativeShare, Social } = await import('react-native-share');

  await NativeShare.shareSingle({
    social: Social.FacebookStories,
    appId: metaAppId,
    backgroundImage: cardUri,
    linkUrl: propertyUrl,
    attributionURL: propertyUrl,
    useInternalStorage: true,
  });
}

export async function sharePropertyToInstagramStory(
  property: Property,
  captureCard: () => Promise<string>,
): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Instagram Stories sharing is available in the mobile app only.');
  }

  const metaAppId = process.env.EXPO_PUBLIC_META_APP_ID ?? process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  if (!metaAppId) {
    throw new Error('Instagram Stories sharing needs Meta app setup before it can be used.');
  }

  const cardUri = await captureCard();
  const propertyUrl = propertyShareLinks(property).webUrl;
  const { default: NativeShare, Social } = await import('react-native-share');

  await NativeShare.shareSingle({
    social: Social.InstagramStories,
    appId: metaAppId,
    backgroundImage: cardUri,
    linkUrl: propertyUrl,
    attributionURL: propertyUrl,
    useInternalStorage: true,
  });
}

export async function sharePropertyGeneric(
  property: Property,
  captureCard: () => Promise<string>,
  dialogTitle = 'Share property',
  includeCaption = true,
): Promise<void> {
  const caption = buildSocialCaption(property);
  await Clipboard.setStringAsync(caption).catch(() => {});

  if (Platform.OS === 'web') {
    await Share.share({ message: caption });
    return;
  }

  const cardUri = await captureCard();

  try {
    const { default: NativeShare } = await import('react-native-share');
    await NativeShare.open({
      url: cardUri,
      type: 'image/jpeg',
      title: `${property.referenceNumber} — ${property.suburb}`,
      failOnCancel: false,
      useInternalStorage: true,
      ...(includeCaption ? { message: caption } : {}),
    });
    return;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('cancel') || message.includes('dismiss')) return;
    if (!(await Sharing.isAvailableAsync())) throw error;
  }

  await Sharing.shareAsync(cardUri, {
    dialogTitle,
    mimeType: 'image/jpeg',
    UTI: 'public.jpeg',
  });
}