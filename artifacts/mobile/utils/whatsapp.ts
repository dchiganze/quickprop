import { Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Property } from '@/types';
import { shareProperty } from '@workspace/api-client-react';
import { propertyShareLinks } from '@/utils/shareLinks';
import {
  buildPropertyShareMessage,
  buildPropertySocialShareMessage,
} from '@/utils/shareContent';

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
  captureCard: () => Promise<string>,
): Promise<{ caption: string; sharedPhoto: boolean }> {
  const caption = buildPropertyShareMessage(property);
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

export async function shareCatalogueToWhatsApp(
  caption: string,
  captureCard: () => Promise<string>,
): Promise<{ caption: string; sharedPhoto: boolean }> {
  await Clipboard.setStringAsync(caption);

  if (Platform.OS === 'web') {
    await openWhatsAppMessage(caption);
    return { caption, sharedPhoto: false };
  }

  const cardUri = await captureCard();
  try {
    const { default: NativeShare } = await import('react-native-share');
    await NativeShare.open({
      url: cardUri,
      type: 'image/jpeg',
      message: caption,
       title: 'QuickProp Property Brochure',
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
       dialogTitle: 'Share brochure to WhatsApp',
      mimeType: 'image/jpeg',
      UTI: 'public.jpeg',
    });
  }

  return { caption, sharedPhoto: true };
}

export type PropertySocialDestination = 'facebook' | 'instagram' | 'linkedin' | 'tiktok';

type BrowserFileShareData = {
  files: File[];
  text: string;
  title: string;
};

type BrowserFileShareNavigator = Navigator & {
  share?: (data: BrowserFileShareData) => Promise<void>;
  canShare?: (data: Pick<BrowserFileShareData, 'files'>) => boolean;
};

async function shareWebSocialPost(
  property: Property,
  destination: 'facebook' | 'linkedin',
  captureCard: () => Promise<string>,
  caption: string,
): Promise<void> {
  const cardUri = await captureCard();

  // Desktop browsers and older mobile browsers cannot attach a local image to
  // Facebook's or LinkedIn's URL composer. Leave the generated collage and
  // copied caption ready so the user can add the image if the composer
  // requires it. Do not call navigator.share here: on Windows that opens the
  // system share panel instead of the selected social network.
  const downloadLink = document.createElement('a');
  downloadLink.href = cardUri;
  downloadLink.download = `${property.referenceNumber || 'quickprop-property'}.jpg`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();

  const shareUrl = destination === 'facebook'
    ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(propertyShareLinks(property).previewUrl)}`
    : `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(propertyShareLinks(property).previewUrl)}`;
  await Linking.openURL(shareUrl);
}

export async function shareCatalogueToSocial(
  caption: string,
  captureCard: () => Promise<string>,
  dialogTitle = 'Share property brochure',
  fallbackUrl?: string | null,
  directDestination?: 'facebook' | 'linkedin',
): Promise<void> {
  await Clipboard.setStringAsync(caption).catch(() => {});

  if (Platform.OS === 'web') {
    const cardUri = await captureCard();

    // Facebook and LinkedIn buttons should open their own composer directly,
    // not the Windows/browser share panel. The generic "More" action below
    // still uses the file-capable Web Share API when it is available.
    if (!directDestination) {
      const browserNavigator = navigator as BrowserFileShareNavigator;
      try {
        const response = await fetch(cardUri);
        if (!response.ok) throw new Error('Unable to prepare the brochure image.');
        const blob = await response.blob();
        const file = new File([blob], 'quickprop-brochure.jpg', { type: 'image/jpeg' });

        if (
          typeof browserNavigator.share === 'function'
          && typeof browserNavigator.canShare === 'function'
          && browserNavigator.canShare({ files: [file] })
        ) {
          await browserNavigator.share({
            files: [file],
            text: caption,
            title: dialogTitle,
          });
          return;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        if (message.includes('cancel') || message.includes('dismiss')) return;
      }
    }

    const downloadLink = document.createElement('a');
    downloadLink.href = cardUri;
    downloadLink.download = 'quickprop-brochure.jpg';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    if (fallbackUrl) await Linking.openURL(fallbackUrl);
    return;
  }

  const cardUri = await captureCard();
  if (directDestination) {
    await shareNativeSocialPost(directDestination, cardUri, caption, dialogTitle);
    return;
  }

  try {
    const { default: NativeShare } = await import('react-native-share');
    await NativeShare.open({
      url: cardUri,
      type: 'image/jpeg',
      message: caption,
      title: dialogTitle,
      failOnCancel: false,
      useInternalStorage: true,
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

async function shareNativeSocialPost(
  destination: 'facebook' | 'linkedin',
  cardUri: string,
  caption: string,
  title: string,
): Promise<void> {
  const { default: NativeShare } = await import('react-native-share');
  const social = (destination === 'facebook'
    ? NativeShare.Social.FACEBOOK
    : NativeShare.Social.LINKEDIN) as Exclude<
      import('react-native-share').Social,
      import('react-native-share').Social.FacebookStories | import('react-native-share').Social.InstagramStories
    >;

  await NativeShare.shareSingle({
    social,
    url: cardUri,
    type: 'image/jpeg',
    message: caption,
    title,
    useInternalStorage: true,
  });
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

  const isSocialPost = destination === 'facebook' || destination === 'linkedin';
  const caption = isSocialPost
    ? buildPropertySocialShareMessage(property)
    : buildPropertyShareMessage(property);
  await Clipboard.setStringAsync(caption).catch(() => {});

  if (Platform.OS === 'web') {
    if (destination === 'facebook' || destination === 'linkedin') {
      await shareWebSocialPost(property, destination, captureCard, caption);
      return;
    }
    await Share.share({ message: caption });
    return;
  }

  if (destination === 'facebook' || destination === 'linkedin') {
    const cardUri = await captureCard();
    await shareNativeSocialPost(
      destination,
      cardUri,
      caption,
      `Share property to ${destination.charAt(0).toUpperCase() + destination.slice(1)}`,
    );
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
    // A direct Stories handoff requires a Meta app ID in the standalone build.
    // Keep the action useful until that configuration is supplied by opening
    // the system chooser with the image only.
    await sharePropertyGeneric(property, captureCard, 'Share property to Facebook Story', false);
    return;
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
  captionOverride?: string,
): Promise<void> {
  const caption = captionOverride ?? buildPropertyShareMessage(property);
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