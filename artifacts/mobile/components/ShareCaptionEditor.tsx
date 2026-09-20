import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface ShareCaptionEditorProps {
  visible: boolean;
  destination: 'facebook' | 'linkedin';
  caption: string;
  onChangeCaption: (caption: string) => void;
  onCancel: () => void;
  onShare: () => void;
}

export function ShareCaptionEditor({
  visible,
  destination,
  caption,
  onChangeCaption,
  onCancel,
  onShare,
}: ShareCaptionEditorProps) {
  const colors = useColors();
  const platformLabel = destination === 'facebook' ? 'Facebook' : 'LinkedIn';
  const platformColor = destination === 'facebook' ? '#1877F2' : '#0A66C2';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.dismissArea} onPress={onCancel} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.platformIcon, { backgroundColor: platformColor }]}>
                <Ionicons
                  name={destination === 'facebook' ? 'logo-facebook' : 'logo-linkedin'}
                  size={18}
                  color="#FFF"
                />
              </View>
              <View style={styles.headerCopy}>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  Prepare {platformLabel} post
                </Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  QuickProp generated this from your listing
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.closeButton, { backgroundColor: colors.muted }]}
              accessibilityLabel="Close caption editor"
            >
              <Ionicons name="close" size={19} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            Review or tailor the caption before sharing. QuickProp will include the listing preview and property link.
          </Text>
          <TextInput
            value={caption}
            onChangeText={onChangeCaption}
            multiline
            textAlignVertical="top"
            placeholder="Write a caption for this listing"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              {
                color: colors.foreground,
                backgroundColor: colors.muted,
                borderColor: colors.border,
              },
            ]}
            accessibilityLabel={`${platformLabel} post caption`}
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={onCancel}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: platformColor }]}
              onPress={onShare}
              disabled={!caption.trim()}
            >
              <Ionicons name="paper-plane-outline" size={17} color="#FFF" />
              <Text style={styles.primaryButtonText}>Share to {platformLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  dismissArea: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.16,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  titleRow: { flexDirection: 'row', flex: 1, gap: 12 },
  platformIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 12, marginTop: 4 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helper: { fontSize: 12, lineHeight: 18, marginTop: 16, marginBottom: 10 },
  input: {
    minHeight: 210,
    maxHeight: 320,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '800' },
  primaryButton: {
    flex: 1.5,
    minHeight: 48,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
});