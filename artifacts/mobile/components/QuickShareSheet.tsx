import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Share,
  ScrollView, Platform, Pressable, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Property } from '@/types';
import { catalogueShareLinks, getFacebookShareUrl } from '@/utils/shareLinks';
import { buildCatalogueShareMessage, formatSharePrice } from '@/utils/shareContent';
import { shareCatalogueToSocial, shareCatalogueToWhatsApp } from '@/utils/whatsapp';
import { ShareCatalogueCard, ShareCatalogueCardHandle } from '@/components/ShareCatalogueCard';

type CatalogMode = 'agent' | 'company';

interface QuickShareSheetProps {
  visible: boolean;
  onClose: () => void;
}

function formatPrice(p: Property) {
  return formatSharePrice(p);
}

export function QuickShareSheet({ visible, onClose }: QuickShareSheetProps) {
  const colors = useColors();
  const { properties } = useData();
  const { user } = useAuth();
  const [mode, setMode] = useState<CatalogMode>('agent');
  const [sharing, setSharing] = useState(false);
  const catalogueCardRef = useRef<ShareCatalogueCardHandle>(null);

  const myProps = properties.filter(p => p.agentId === user?.id && p.status === 'published');
  const allProps = properties.filter(p => p.status === 'published');
  const activeProps = mode === 'agent' ? myProps : allProps;

  const forSale = activeProps.filter(p => p.type === 'sale');
  const forRent = activeProps.filter(p => p.type === 'rent');
  const suburbs = [...new Set(activeProps.map(p => p.suburb))].slice(0, 3);

  const catalogLinks = catalogueShareLinks(mode === 'agent' ? user?.id : undefined);
  const catalogUrl = catalogLinks.webUrl;

  const handleWhatsApp = useCallback(async () => {
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
       const text = buildCatalogueShareMessage(activeProps, mode, user?.name, mode === 'agent' ? user?.id : undefined);
       await shareCatalogueToWhatsApp(
         text,
         () => catalogueCardRef.current?.capture()
           ?? Promise.reject(new Error('Unable to prepare the brochure image.')),
       );
      onClose();
    } catch (e: unknown) {
      Alert.alert('Could not share brochure', e instanceof Error ? e.message : 'Please try another sharing option.');
    } finally {
      setSharing(false);
    }
  }, [activeProps, mode, user?.name, catalogLinks.appUrl, catalogUrl, onClose]);

  const handleFacebook = useCallback(async () => {
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const text = buildCatalogueShareMessage(activeProps, mode, user?.name, mode === 'agent' ? user?.id : undefined);
      await shareCatalogueToSocial(
        text,
        () => catalogueCardRef.current?.capture()
          ?? Promise.reject(new Error('Unable to prepare the brochure image.')),
        'Share brochure to Facebook',
        getFacebookShareUrl(catalogLinks.previewUrl, text),
        'facebook',
      );
      onClose();
    } catch (e: unknown) {
      Alert.alert('Could not open Facebook', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSharing(false);
    }
  }, [catalogUrl, onClose]);

  const handleInstagram = useCallback(async () => {
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const text = buildCatalogueShareMessage(activeProps, mode, user?.name, mode === 'agent' ? user?.id : undefined);
      await shareCatalogueToSocial(
        text,
        () => catalogueCardRef.current?.capture()
          ?? Promise.reject(new Error('Unable to prepare the brochure image.')),
        'Share brochure to Instagram',
        null,
        'instagram',
      );
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      if (!message.toLowerCase().includes('cancel')) Alert.alert('Could not share brochure', message || 'Please try again.');
    } finally {
      setSharing(false);
    }
  }, [activeProps, mode, user?.name, catalogLinks.appUrl, catalogUrl, onClose]);

  const handleLinkedIn = useCallback(async () => {
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const text = buildCatalogueShareMessage(activeProps, mode, user?.name, mode === 'agent' ? user?.id : undefined);
      await shareCatalogueToSocial(
        text,
        () => catalogueCardRef.current?.capture()
          ?? Promise.reject(new Error('Unable to prepare the brochure image.')),
        'Share brochure to LinkedIn',
        null,
        'linkedin',
      );
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      if (!message.toLowerCase().includes('cancel')) Alert.alert('Could not share brochure', message || 'Please try again.');
    } finally {
      setSharing(false);
    }
  }, [activeProps, mode, user?.name, onClose]);

  const handleNativeShare = useCallback(async () => {
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const text = buildCatalogueShareMessage(activeProps, mode, user?.name, mode === 'agent' ? user?.id : undefined);
      await shareCatalogueToSocial(
        text,
        () => catalogueCardRef.current?.capture()
          ?? Promise.reject(new Error('Unable to prepare the brochure image.')),
        'Share property brochure',
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      if (!message.toLowerCase().includes('cancel')) Alert.alert('Could not share brochure', message || 'Please try again.');
    } finally {
      setSharing(false);
    }
  }, [activeProps, mode, user?.name, catalogLinks.appUrl, catalogUrl]);

  const selectMode = async (m: CatalogMode) => {
    await Haptics.selectionAsync();
    setMode(m);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          <View style={styles.catalogueCardHost} pointerEvents="none">
            <ShareCatalogueCard
              ref={catalogueCardRef}
              properties={activeProps}
              mode={mode}
              agentName={user?.name}
              agentId={user?.id}
            />
          </View>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="share-social" size={22} color={colors.primary} />
              <Text style={[styles.title, { color: colors.foreground }]}>QuickShare</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.muted }]}>
              <Ionicons name="close" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Mode selector — two prominent cards */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[
                styles.modeCard,
                { borderColor: mode === 'agent' ? colors.primary : colors.border, backgroundColor: mode === 'agent' ? colors.primary + '12' : colors.muted },
              ]}
              onPress={() => selectMode('agent')}
              activeOpacity={0.75}
            >
              <View style={[styles.modeIconWrap, { backgroundColor: mode === 'agent' ? colors.primary : colors.border }]}>
                <Ionicons name="person" size={18} color={mode === 'agent' ? '#fff' : colors.mutedForeground} />
              </View>
              <Text style={[styles.modeLabel, { color: colors.foreground }]}>My Brochure</Text>
              <Text style={[styles.modeSub, { color: colors.mutedForeground }]}>Your listings only</Text>
              {mode === 'agent' && (
                <View style={[styles.modeBadge, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.modeBadgeText, { color: colors.primary }]}>{myProps.length}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeCard,
                { borderColor: mode === 'company' ? colors.primary : colors.border, backgroundColor: mode === 'company' ? colors.primary + '12' : colors.muted },
              ]}
              onPress={() => selectMode('company')}
              activeOpacity={0.75}
            >
              <View style={[styles.modeIconWrap, { backgroundColor: mode === 'company' ? colors.primary : colors.border }]}>
                <Ionicons name="business" size={18} color={mode === 'company' ? '#fff' : colors.mutedForeground} />
              </View>
              <Text style={[styles.modeLabel, { color: colors.foreground }]}>Company</Text>
              <Text style={[styles.modeSub, { color: colors.mutedForeground }]}>All agency listings</Text>
              {mode === 'company' && (
                <View style={[styles.modeBadge, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.modeBadgeText, { color: colors.primary }]}>{allProps.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Catalog Preview */}
          <View style={[styles.preview, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <View style={styles.previewTop}>
              <View style={styles.previewInfo}>
                <Text style={[styles.previewTitle, { color: colors.foreground }]}>
                  {mode === 'agent' ? `${user?.name?.split(' ')[0] ?? 'My'}'s Listings` : 'QuickProp — All Listings'}
                </Text>
                {suburbs.length > 0 && (
                  <Text style={[styles.previewSub, { color: colors.mutedForeground }]}>
                    {suburbs.join(', ')}{activeProps.length > 3 ? ' & more' : ''}
                  </Text>
                )}
              </View>
              <View style={[styles.countBadge, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.countText, { color: colors.primary }]}>
                  {activeProps.length} {activeProps.length === 1 ? 'property' : 'properties'}
                </Text>
              </View>
            </View>

            {activeProps.length > 0 ? (
              <View style={styles.previewStats}>
                {forSale.length > 0 && (
                  <View style={styles.statRow}>
                    <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.statText, { color: colors.mutedForeground }]}>{forSale.length} for sale</Text>
                  </View>
                )}
                {forRent.length > 0 && (
                  <View style={styles.statRow}>
                    <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
                    <Text style={[styles.statText, { color: colors.mutedForeground }]}>{forRent.length} to rent</Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No published listings yet</Text>
            )}

            {activeProps.slice(0, 3).map(p => (
              <View key={p.id} style={[styles.propRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.propName, { color: colors.foreground }]} numberOfLines={1}>
                  {p.bedrooms ? `${p.bedrooms}-bed · ` : ''}{p.suburb}
                </Text>
                <Text style={[styles.propPrice, { color: colors.primary }]}>{formatPrice(p)}</Text>
              </View>
            ))}
          </View>

          {/* Share Buttons */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SHARE VIA</Text>

          <View style={styles.shareRow}>
            {/* WhatsApp */}
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleWhatsApp}
              disabled={activeProps.length === 0 || sharing}
              activeOpacity={0.75}
            >
              <View style={[styles.shareIcon, { backgroundColor: '#25D366' }]}>
                <Ionicons name="logo-whatsapp" size={24} color="#FFF" />
              </View>
              {sharing ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.shareName, { color: colors.foreground }]}>WhatsApp</Text>}
              <Text style={[styles.shareHint, { color: colors.mutedForeground }]}>Send brochure</Text>
            </TouchableOpacity>

            {/* Facebook */}
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleFacebook}
              disabled={activeProps.length === 0 || sharing}
              activeOpacity={0.75}
            >
              <View style={[styles.shareIcon, { backgroundColor: '#1877F2' }]}>
                <Ionicons name="logo-facebook" size={24} color="#FFF" />
              </View>
              {sharing ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.shareName, { color: colors.foreground }]}>Facebook</Text>}
              <Text style={[styles.shareHint, { color: colors.mutedForeground }]}>Share link</Text>
            </TouchableOpacity>

            {/* Instagram */}
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleInstagram}
              disabled={activeProps.length === 0 || sharing}
              activeOpacity={0.75}
            >
              <View style={[styles.shareIcon, { backgroundColor: '#E1306C' }]}>
                <Ionicons name="logo-instagram" size={24} color="#FFF" />
              </View>
              {sharing ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.shareName, { color: colors.foreground }]}>Instagram</Text>}
              <Text style={[styles.shareHint, { color: colors.mutedForeground }]}>Share sheet</Text>
            </TouchableOpacity>

            {/* LinkedIn */}
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleLinkedIn}
              disabled={activeProps.length === 0 || sharing}
              activeOpacity={0.75}
            >
              <View style={[styles.shareIcon, { backgroundColor: '#0A66C2' }]}>
                <Ionicons name="logo-linkedin" size={24} color="#FFF" />
              </View>
              {sharing ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.shareName, { color: colors.foreground }]}>LinkedIn</Text>}
              <Text style={[styles.shareHint, { color: colors.mutedForeground }]}>Open post composer</Text>
            </TouchableOpacity>
          </View>

          {/* More options */}
          <TouchableOpacity
            style={[styles.moreBtn, { borderColor: colors.border }]}
            onPress={handleNativeShare}
            disabled={sharing || activeProps.length === 0}
            activeOpacity={0.75}
          >
            <Ionicons name="ellipsis-horizontal-circle-outline" size={18} color={colors.primary} />
            <Text style={[styles.moreBtnText, { color: colors.primary }]}>More sharing options</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20,
    elevation: 20,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 18, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // Mode cards
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  modeCard: {
    flex: 1, alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 2, gap: 6,
  },
  modeIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modeLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  modeSub: { fontSize: 11, textAlign: 'center' },
  modeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  modeBadgeText: { fontSize: 11, fontWeight: '700' },

  preview: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 20, gap: 8 },
  previewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  previewInfo: { flex: 1, marginRight: 8 },
  previewTitle: { fontSize: 14, fontWeight: '700' },
  previewSub: { fontSize: 12, marginTop: 2 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  countText: { fontSize: 12, fontWeight: '600' },
  previewStats: { flexDirection: 'row', gap: 16, marginTop: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statText: { fontSize: 12 },
  emptyText: { fontSize: 12, fontStyle: 'italic' },
  propRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, marginTop: 4 },
  propName: { fontSize: 12, flex: 1 },
  propPrice: { fontSize: 12, fontWeight: '600', marginLeft: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
  shareRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  shareBtn: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, gap: 6 },
  shareIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  shareName: { fontSize: 13, fontWeight: '600' },
  shareHint: { fontSize: 11 },
  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  moreBtnText: { fontSize: 14, fontWeight: '600' },
  catalogueCardHost: { position: 'absolute', left: -1000, top: 0, width: 360, height: 450 },
});
