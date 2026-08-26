import { Linking } from 'react-native';

/**
 * Open WhatsApp with a prefilled text message.
 *
 * The native scheme is preferred so the user lands directly in WhatsApp.
 * api.whatsapp.com is a more reliable fallback than wa.me on devices where
 * the native scheme cannot be opened or does not preserve the text payload.
 */
export async function openWhatsAppMessage(message: string): Promise<void> {
  const encodedMessage = encodeURIComponent(message);

  try {
    await Linking.openURL(`whatsapp://send?text=${encodedMessage}`);
  } catch {
    await Linking.openURL(`https://api.whatsapp.com/send?text=${encodedMessage}`);
  }
}