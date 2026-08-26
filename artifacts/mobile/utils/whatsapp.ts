import { Linking, Platform, Share } from 'react-native';

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