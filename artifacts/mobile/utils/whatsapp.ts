import { Linking, Platform, Share } from 'react-native';

/**
 * Open WhatsApp with a prefilled text message.
 *
 * The native scheme is preferred so the user lands directly in WhatsApp.
 * The native share sheet is the fallback because it passes the complete
 * message body to WhatsApp without relying on URL-scheme payload limits.
 */
export async function openWhatsAppMessage(message: string): Promise<void> {
  const encodedMessage = encodeURIComponent(message);

  if (Platform.OS === 'web') {
    await Linking.openURL(`https://api.whatsapp.com/send?text=${encodedMessage}`);
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