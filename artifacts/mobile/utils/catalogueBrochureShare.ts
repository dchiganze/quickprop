import { Platform } from 'react-native';
import { BROCHURE_PRINT_OPTIONS, getBrochurePrintHtml } from '@/utils/brochureHtml';
import { shareCataloguePdfWithCaption } from '@/utils/whatsapp';

type BeforeShare = () => Promise<void>;

export async function shareCatalogueBrochureHtml(
  html: string,
  agentName?: string,
  beforeShare?: BeforeShare,
): Promise<void> {
  const Print = await import('expo-print');
  const printHtml = getBrochurePrintHtml(html, Platform.OS);
  const { uri } = await Print.printToFileAsync({
    html: printHtml,
    ...BROCHURE_PRINT_OPTIONS,
  });

  await beforeShare?.();
  await shareCataloguePdfWithCaption(uri, agentName);
}
