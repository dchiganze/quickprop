import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Property } from '@/types';
import { useColors } from '@/hooks/useColors';
import {
  PropertySocialDestination,
  sharePropertyGeneric,
  sharePropertyToSocial,
  sharePropertyToWhatsApp,
} from '@/utils/whatsapp';

interface PropertyShareSheetProps {
  visible: boolean;
  property: Property;
  agentId?: string;
  captureCard: () => Promise<string>;
  onClose: () => void;
}

type ShareDestination = 'whatsapp' | 'share' | PropertySocialDestination;

const SHARE_OPTIONS: Array<{
  key: ShareDestination;
  label: string;
  description: string;
  icon: 'logo-whatsapp' | 'logo-facebook' | 'logo-instagram' | 'logo-linkedin' | 'logo-tiktok' | 'share-outline';
  color: string;
}> = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    description: 'Image + catalogue link',
    icon: 'logo-whatsapp',
    color: '#25D366',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    description: 'Share property image',
    icon: 'logo-facebook',
    color: '#1877F2',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    description: 'Post or send image',
    icon: 'logo-instagram',
    color: '#E1306C',
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    description: 'Share property image',
    icon: 'logo-linkedin',
    color: '#0A66C2',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    description: 'Post or send image',
    icon: 'logo-tiktok',
    color: '#111827',
  },
  {
    key: 'share',
    label: 'Share',
    description: 'More apps',
    icon: 'share-outline',
    color: '#1A3C6E',
  },
];

export function PropertyShareSheet({
  visible,
  property,
  agentId,
  captureCard,
  onClose,
}: PropertyShareSheetProps) {
  const colors = useColors();
  const [sharing, setSharing] = useState<ShareDestination | null>(null);

  const handleShare = async (destination: ShareDestination) => {
    if (sharing) return;
    setSharing(destination);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (destination === 'whatsapp') {
        await sharePropertyToWhatsApp(property, agentId ?? property.agentId, captureCard);
      } else if (destination === 'share') {
        await sharePropertyGeneric(property, captureCard);
      } else {
        await sharePropertyToSocial(property, destination, captureCard);
      }
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (!message.includes('cancel') && !message.includes('dismiss')) {
        Alert.alert('Could not share property', 'That app is unavailable right now. Please choose another destination.');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    } finally {
      setSharing(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: colors.foreground }]}>Share property</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                {property.referenceNumber} · {property.suburb}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.muted }]}
              onPress={onClose}
              disabled={!!sharing}
              accessibilityLabel="Close share options"
            >
              <Ionicons name="close" size={19} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SHARE VIA</Text>

          <View style={styles.optionGrid}>
            {SHARE_OPTIONS.map(option => {
              const isSharing = sharing === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.option,
                    { backgroundColor: colors.muted, borderColor: colors.border },
                  ]}
                  onPress={() => handleShare(option.key)}
                  disabled={!!sharing}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel={`Share property to ${option.label}`}
                >
                  <View style={[styles.iconWrap, { backgroundColor: option.color }]}>
                    {isSharing
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <Ionicons name={option.icon} size={24} color="#FFF" />}
                  </View>
                  <Text style={[styles.optionLabel, { color: colors.foreground }]}>{option.label}</Text>
                  <Text style={[styles.optionDescription, { color: colors.mutedForeground }]}>
                    {option.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
            Your property card will be prepared before the app opens.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  headerCopy: { flex: 1, paddingRight: 14 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, marginTop: 4 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 12,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  option: {
    width: '47.5%',
    minHeight: 126,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  optionLabel: { fontSize: 15, fontWeight: '800' },
  optionDescription: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  footerNote: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 18 },
});