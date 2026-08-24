import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator,
  Pressable, Alert, Share, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
// expo-print and expo-sharing are loaded dynamically to prevent a native-module
// crash on Android at startup if the module is not yet linked in the build.
type PrintModule = typeof import('expo-print');
type SharingModule = typeof import('expo-sharing');
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Property } from '@/types';
import { singlePropertyBrochureHtml, catalogueBrochureHtml } from '@/utils/brochureHtml';
import { propertyShareLinks } from '@/utils/shareLinks';

type CatalogMode = 'my' | 'company';

// ─── Single-property brochure ────────────────────────────────────────────────

interface PropertyBrochureSheetProps {
  visible: boolean;
  onClose: () => void;
  property: Property;
}

export function PropertyBrochureSheet({ visible, onClose, property }: PropertyBrochureSheetProps) {
  const colors = useColors();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const buildTextSummary = () => {
    const price = property.price >= 1_000_000
      ? `${property.currency} ${(property.price / 1_000_000).toFixed(2)}M`
      : `${property.currency} ${property.price.toLocaleString()}`;
    const priceStr = property.type === 'rent' ? `${price}/mo` : price;
    const lines = [
      `🏠 *${property.type.charAt(0).toUpperCase() + property.type.slice(1)} — ${property.suburb}*`,
      property.showAddress && property.address ? `📍 ${property.address}, ${property.suburb}` : `📍 ${property.suburb}`,
      '',
      `💰 *${priceStr}*${property.negotiable ? ' _(Negotiable)_' : ''}`,
      '',
    ];
    const stats = [
      property.bedrooms !== undefined && `🛏 ${property.bedrooms} bed`,
      property.bathrooms !== undefined && `🚿 ${property.bathrooms} bath`,
      property.garages && property.garages > 0 && `🚗 ${property.garages} garage`,
    ].filter(Boolean);
    if (stats.length) lines.push(stats.join('  |  '));
    const sizes = [
      property.landSize && property.landSize > 0 && `Land: ${property.landSize.toLocaleString()}m²`,
      property.floorArea && property.floorArea > 0 && `Floor: ${property.floorArea.toLocaleString()}m²`,
    ].filter(Boolean);
    if (sizes.length) lines.push(`📐 ${sizes.join('  |  ')}`);
    if (property.features.length) { lines.push(''); lines.push(`✅ *Features:* ${property.features.join(', ')}`); }
    if (property.description) { lines.push(''); lines.push(`📝 ${property.description.slice(0, 200)}${property.description.length > 200 ? '…' : ''}`); }
    const links = propertyShareLinks(property);
    lines.push(''); lines.push(`📋 Ref: *${property.referenceNumber}*`);
    lines.push(`Open in QuickProp Agent: ${links.appUrl}`);
    lines.push(`View online: ${links.webUrl}`);
    return lines.join('\n');
  };

  const handleShareAsText = () => {
    onClose();
    const message = buildTextSummary();
    Alert.alert('Share Listing', 'How would you like to share?', [
      {
        text: 'WhatsApp',
        onPress: () => Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`).catch(() =>
          Alert.alert('WhatsApp not found', 'Use "Share…" instead.')),
      },
       {
         text: 'Share…',
         onPress: () => Share.share({ message }).catch((error: unknown) =>
           Alert.alert('Could not share listing', error instanceof Error ? error.message : 'Please try again.')),
       },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handlePrint = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLoading(true);
    try {
      const Print: PrintModule = await import('expo-print');
      const html = singlePropertyBrochureHtml(property, user);
      await Print.printAsync({ html });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not generate brochure. Please try again.';
      if (!message.toLowerCase().includes('cancel')) {
        Alert.alert('Brochure unavailable', message);
      }
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLoading(true);
    try {
      const Print: PrintModule = await import('expo-print');
      const Sharing: SharingModule = await import('expo-sharing');
      const html = singlePropertyBrochureHtml(property, user);
      const { uri } = await Print.printToFileAsync({ html });
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('PDF sharing is not available on this device.');
      }
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Property Brochure' });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not generate PDF. Please try again.';
      if (!message.toLowerCase().includes('cancel')) {
        Alert.alert('PDF unavailable', message);
      }
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="document-text-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.foreground }]}>Property Brochure</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
              {property.address}, {property.suburb}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.muted }]}>
            <Ionicons name="close" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={[styles.refBadge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.refText, { color: colors.mutedForeground }]}>{property.referenceNumber}</Text>
        </View>

        <View style={styles.actions}>
          <ActionCard
            icon="print-outline"
            label="Print / Save PDF"
            description="Opens print dialog — save as PDF or send to printer"
            onPress={handlePrint}
            primary
            loading={loading}
            colors={colors}
          />
          <ActionCard
            icon="share-outline"
            label="Share PDF File"
            description="Generates a PDF file and opens the share sheet"
            onPress={handleShare}
            loading={loading}
            colors={colors}
          />
        </View>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Generating brochure…</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Catalogue brochure ──────────────────────────────────────────────────────

interface CatalogueBrochureSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function CatalogueBrochureSheet({ visible, onClose }: CatalogueBrochureSheetProps) {
  const colors = useColors();
  const { user } = useAuth();
  const { properties } = useData();
  const [mode, setMode] = useState<CatalogMode>('my');
  const [loading, setLoading] = useState(false);

  const myProps = properties.filter(p => p.agentId === user?.id && p.status === 'published');
  const companyProps = properties.filter(p => p.status === 'published');
  const activeProps = mode === 'my' ? myProps : companyProps;

  const generate = async (action: 'print' | 'share') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLoading(true);
    try {
      const Print: PrintModule = await import('expo-print');
      const html = catalogueBrochureHtml(activeProps, user, mode);
      if (action === 'print') {
        await Print.printAsync({ html });
      } else {
        const Sharing: SharingModule = await import('expo-sharing');
        const { uri } = await Print.printToFileAsync({ html });
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error('PDF sharing is not available on this device.');
        }
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Property Catalogue' });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not generate catalogue. Please try again.';
      if (!message.toLowerCase().includes('cancel')) {
        Alert.alert('Catalogue unavailable', message);
      }
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="albums-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.foreground }]}>Brochure Catalogue</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Choose which listings to include
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.muted }]}>
            <Ionicons name="close" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Mode selector */}
        <View style={styles.modeRow}>
          <ModeCard
            icon="person-outline"
            label="My Listings"
            description={`${myProps.length} published`}
            active={mode === 'my'}
            onPress={() => setMode('my')}
            colors={colors}
          />
          <ModeCard
            icon="business-outline"
            label="Company"
            description={`${companyProps.length} published`}
            active={mode === 'company'}
            onPress={() => setMode('company')}
            colors={colors}
          />
        </View>

        <View style={styles.actions}>
          <ActionCard
            icon="print-outline"
            label="Print / Save PDF"
            description="Opens print dialog — save as PDF or send to printer"
            onPress={() => generate('print')}
            primary
            loading={loading}
            colors={colors}
          />
          <ActionCard
            icon="share-outline"
            label="Share PDF File"
            description="Generates a PDF and opens the share sheet"
            onPress={() => generate('share')}
            loading={loading}
            colors={colors}
          />
        </View>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Generating catalogue…</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ModeCard({
  icon, label, description, active, onPress, colors,
}: {
  icon: any; label: string; description: string; active: boolean; onPress: () => void; colors: any;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.modeCard,
        { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '0D' : colors.muted },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={22} color={active ? colors.primary : colors.mutedForeground} />
      <Text style={[styles.modeLabel, { color: active ? colors.primary : colors.foreground }]}>{label}</Text>
      <Text style={[styles.modeDesc, { color: colors.mutedForeground }]}>{description}</Text>
    </TouchableOpacity>
  );
}

function ActionCard({
  icon, label, description, onPress, primary, loading, colors,
}: {
  icon: any; label: string; description: string; onPress: () => void; primary?: boolean; loading?: boolean; colors: any;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionCard,
        {
          borderColor: primary ? colors.primary : colors.border,
          backgroundColor: primary ? colors.primary : colors.muted,
        },
      ]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.75}
    >
      <Ionicons name={icon} size={20} color={primary ? '#fff' : colors.foreground} />
      <View style={styles.actionText}>
        <Text style={[styles.actionLabel, { color: primary ? '#fff' : colors.foreground }]}>{label}</Text>
        <Text style={[styles.actionDesc, { color: primary ? 'rgba(255,255,255,0.75)' : colors.mutedForeground }]}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={primary ? 'rgba(255,255,255,0.6)' : colors.mutedForeground} />
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 36, paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  refBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 16 },
  refText: { fontSize: 12, fontWeight: '600', fontFamily: 'monospace' },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  modeCard: {
    flex: 1, borderWidth: 1.5, borderRadius: 14, padding: 14,
    alignItems: 'center', gap: 4,
  },
  modeLabel: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  modeDesc: { fontSize: 12 },
  actions: { gap: 10 },
  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 14, padding: 14,
  },
  actionText: { flex: 1 },
  actionLabel: { fontSize: 14, fontWeight: '600' },
  actionDesc: { fontSize: 12, marginTop: 2 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 14 },
  loadingText: { fontSize: 13 },
});