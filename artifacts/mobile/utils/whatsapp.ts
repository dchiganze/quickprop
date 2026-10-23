import { Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Property } from '@/types';
import { shareProperty } from '@workspace/api-client-react';
import { prepareShareImage, runNativeSocialShare, runPropertyFlyerShare } from '@/utils/socialShareFlow';
import {
  buildPropertyShareMessage,
  buildPropertyFlyerCaption,
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
  options: { agentId?: string; beforeNativeShare?: () => Promise<void> } = {},
): Promise<{ caption: string; sharedPhoto: boolean }> {
  const caption = buildPropertyFlyerCaption(options.agentId ?? property.agentId);
  await Clipboard.setStringAsync(caption);
  const cardUri = await prepareShareImage(captureCard);

  if (Platform.OS === 'web') {
    await shareFlyerInBrowser(cardUri, 'QuickProp property flyer', caption);
    return { caption, sharedPhoto: true };
  }

  await options.beforeNativeShare?.();
  await recordPropertyShare(property);

  if (Platform.OS === 'ios') {
    // Available in Expo Go. Some WhatsApp versions still require pasting the
    // caption, so keep the same text on the clipboard as a fallback.
    await Share.share({ url: cardUri, message: caption });
    return { caption, sharedPhoto: true };
  }

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

  const cardUri = await prepareShareImage(captureCard);
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
  text?: string;
  title: string;
};

type BrowserFileShareNavigator = Navigator & {
  share?: (data: BrowserFileShareData) => Promise<void>;
  canShare?: (data: Pick<BrowserFileShareData, 'files'>) => boolean;
};

async function shareFlyerInBrowser(uri: string, title: string, caption = ''): Promise<void> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Unable to prepare the flyer image.');
  const file = new File([await response.blob()], 'quickprop-property-flyer.jpg', { type: 'image/jpeg' });
  const browser = navigator as BrowserFileShareNavigator;
  if (browser.share && browser.canShare?.({ files: [file] })) {
    await browser.share({ files: [file], title, ...(caption ? { text: caption } : {}) });
    return;
  }
  // A social composer URL cannot attach a local JPEG. Download the flyer
  // rather than silently substituting a link-only post on desktop browsers.
  const download = document.createElement('a');
  download.href = uri;
  download.download = 'quickprop-property-flyer.jpg';
  document.body.appendChild(download);
  download.click();
  download.remove();
  if (caption) await Linking.openURL(`https://api.whatsapp.com/send?text=${encodeURIComponent(caption)}`);
}

export async function shareCatalogueToSocial(
  caption: string,
  captureCard: () => Promise<string>,
  dialogTitle = 'Share property brochure',
  fallbackUrl?: string | null,
  directDestination?: 'facebook' | 'instagram' | 'linkedin',
): Promise<void> {
  await Clipboard.setStringAsync(caption).catch(() => {});

  if (Platform.OS === 'web') {
    if (directDestination && fallbackUrl) {
      await Linking.openURL(fallbackUrl);
      return;
    }

    const cardUri = await prepareShareImage(captureCard);

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

  const cardUri = await prepareShareImage(captureCard);
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
  destination: 'facebook' | 'instagram' | 'linkedin' | 'tiktok',
  cardUri: string,
  caption: string,
  title: string,
): Promise<void> {
  if (destination === 'tiktok') {
    if (!await Sharing.isAvailableAsync()) throw new Error('Image sharing is unavailable on this device.');
    await Sharing.shareAsync(cardUri, { dialogTitle: title, mimeType: 'image/jpeg', UTI: 'public.jpeg' });
    return;
  }
  await runNativeSocialShare(
    Platform.OS,
    async () => {
      if (!await Sharing.isAvailableAsync()) {
        throw new Error('Image sharing is unavailable on this device.');
      }
      await Sharing.shareAsync(cardUri, {
        dialogTitle: title,
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
      });
    },
    async () => {
      const { default: NativeShare } = await import('react-native-share');
      const social = ({
        facebook: NativeShare.Social.FACEBOOK,
        instagram: NativeShare.Social.INSTAGRAM,
        linkedin: NativeShare.Social.LINKEDIN,
      }[destination]) as Exclude<
          import('react-native-share').Social,
          import('react-native-share').Social.FacebookStories | import('react-native-share').Social.InstagramStories
        >;
      await NativeShare.shareSingle({
        social,
        url: cardUri,
        type: 'image/jpeg',
        ...(caption ? { message: caption } : {}),
        title,
        useInternalStorage: true,
      });
    },
  );
}

export async function sharePropertyToSocial(
  property: Property,
  destination: PropertySocialDestination,
  captureCard: () => Promise<string>,
  beforeNativeShare?: () => Promise<void>,
): Promise<void> {
  const title = `Share flyer to ${destination.charAt(0).toUpperCase() + destination.slice(1)}`;
  await runPropertyFlyerShare({
    platform: Platform.OS,
    capture: captureCard,
    beforeNativeShare,
    shareWeb: uri => shareFlyerInBrowser(uri, title),
    shareNative: uri => shareNativeSocialPost(destination, uri, '', title),
  });
}

export async function sharePropertyToFacebookStory(
  property: Property,
  captureCard: () => Promise<string>,
  beforeNativeShare?: () => Promise<void>,
): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Facebook Stories sharing is available in the mobile app only.');
  }

  const metaAppId = process.env.EXPO_PUBLIC_META_APP_ID ?? process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  if (!metaAppId) {
    // A direct Stories handoff requires a Meta app ID in the standalone build.
    // Keep the action useful until that configuration is supplied by opening
    // the system chooser with the image only.
    await sharePropertyToSocial(property, 'facebook', captureCard, beforeNativeShare);
    return;
  }

  const cardUri = await prepareShareImage(captureCard);
  await beforeNativeShare?.();
  try {
    const { default: NativeShare, Social } = await import('react-native-share');
    await NativeShare.shareSingle({
      social: Social.FacebookStories,
      appId: metaAppId,
      backgroundImage: cardUri,
      useInternalStorage: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('cancel') || message.includes('dismiss')) return;
    if (!await Sharing.isAvailableAsync()) throw error;
    await Sharing.shareAsync(cardUri, { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
  }
}

export async function sharePropertyToInstagramStory(
  property: Property,
  captureCard: () => Promise<string>,
  beforeNativeShare?: () => Promise<void>,
): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Instagram Stories sharing is available in the mobile app only.');
  }

  const metaAppId = process.env.EXPO_PUBLIC_META_APP_ID ?? process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  if (!metaAppId) {
    await sharePropertyToSocial(property, 'instagram', captureCard, beforeNativeShare);
    return;
  }

  const cardUri = await prepareShareImage(captureCard);
  await beforeNativeShare?.();
  try {
    const { default: NativeShare, Social } = await import('react-native-share');
    await NativeShare.shareSingle({
      social: Social.InstagramStories,
      appId: metaAppId,
      backgroundImage: cardUri,
      useInternalStorage: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('cancel') || message.includes('dismiss')) return;
    if (!await Sharing.isAvailableAsync()) throw error;
    await Sharing.shareAsync(cardUri, { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
  }
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

  const cardUri = await prepareShareImage(captureCard);

  if (Platform.OS === 'ios' && !includeCaption) {
    if (!await Sharing.isAvailableAsync()) throw new Error('Image sharing is unavailable on this device.');
    await Sharing.shareAsync(cardUri, { dialogTitle, mimeType: 'image/jpeg', UTI: 'public.jpeg' });
    return;
  }

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