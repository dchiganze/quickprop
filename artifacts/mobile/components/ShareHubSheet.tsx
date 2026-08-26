import React, { useState, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Share, Linking,
  ScrollView, Platform, Pressable, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Property } from '@/types';
import { catalogueShareLinks, propertyShareLinks } from '@/utils/shareLinks';
import { openWhatsAppMessage } from '@/utils/whatsapp';

type Step = 'hub' | 'property-select' | 'property-share' | 'catalogue-share';
type CatalogMode = 'agent' | 'company';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function formatPrice(p: Property) {
  const val =
    p.price >= 1_000_000
      ? `${p.currency} ${(p.price / 1_000_000).toFixed(1)}M`
      : `${p.currency} ${p.price.toLocaleString()}`;
  return p.type === 'rent' ? `${val}/mo` : val;
}

function buildPropertyText(p: Property, agentName?: string) {
  const priceStr = formatPrice(p);
  const lines: string[] = [
    `🏠 *${p.type.charAt(0).toUpperCase() + p.type.slice(1)} — ${p.suburb}*`,
    p.showAddress && p.address ? `📍 ${p.address}, ${p.suburb}` : `📍 ${p.suburb}`,
    '',
    `💰 *${priceStr}*${p.negotiable ? ' _(Negotiable)_' : ''}`,
    '',
  ];
  const stats = [
    p.bedrooms !== undefined && p.bedrooms > 0 && `🛏 ${p.bedrooms} bed`,
    p.bathrooms !== undefined && p.bathrooms > 0 && `🚿 ${p.bathrooms} bath`,
    p.garages && p.garages > 0 && `🚗 ${p.garages} garage`,
  ].filter(Boolean);
  if (stats.length) lines.push(stats.join('  |  '));
  if (p.features.length) {
    lines.push('');
    lines.push(`✅ ${p.features.slice(0, 6).join(', ')}`);
  }
  if (p.description) {
    lines.push('');
    lines.push(p.description.slice(0, 180) + (p.description.length > 180 ? '…' : ''));
  }
  lines.push('');
  lines.push(`📋 Ref: *${p.referenceNumber}*`);
  if (agentName) lines.push(`Agent: ${agentName}`);
  const links = propertyShareLinks(p);
  lines.push(`Open in QuickProp Agent: ${links.appUrl}`);
  lines.push(`View online: ${links.webUrl}`);
  return lines.join('\n');
}

function buildCatalogText(props: Property[], mode: CatalogMode, agentName: string | undefined, appUrl: string, catalogUrl: string) {
  const lines: string[] = [];
  lines.push('QuickProp — Property Catalogue');
  lines.push('Your trusted Harare estate agency');
  if (mode === 'agent' && agentName) lines.push(`Agent: ${agentName}`);
  lines.push('');
  const forSale = props.filter(p => p.type === 'sale');
  const forRent = props.filter(p => p.type === 'rent');
  if (forSale.length > 0) {
    lines.push(`For Sale (${forSale.length} properties):`);
    forSale.slice(0, 8).forEach(p => {
      const beds = p.bedrooms ? `${p.bedrooms}-bed ` : '';
      lines.push(`• ${beds}House in ${p.suburb} — ${formatPrice(p)}`);
      if (p.description.trim()) {
        const description = p.description.replace(/\s+/g, ' ').trim();
        lines.push(`  ${description.slice(0, 90)}${description.length > 90 ? '…' : ''}`);
      }
    });
    lines.push('');
  }
  if (forRent.length > 0) {
    lines.push(`To Rent (${forRent.length} properties):`);
    forRent.slice(0, 5).forEach(p => {
      const beds = p.bedrooms ? `${p.bedrooms}-bed ` : '';
      lines.push(`• ${beds}Property in ${p.suburb} — ${formatPrice(p)}`);
      if (p.description.trim()) {
        const description = p.description.replace(/\s+/g, ' ').trim();
        lines.push(`  ${description.slice(0, 90)}${description.length > 90 ? '…' : ''}`);
      }
    });
    lines.push('');
  }
  lines.push(`Open in QuickProp Agent: ${appUrl}`);
  lines.push(`Browse listings online: ${catalogUrl}`);
  lines.push('Reply to enquire about any property.');
  return lines.join('\n');
}

export function ShareHubSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const { properties } = useData();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('hub');
  const [catalogMode, setCatalogMode] = useState<CatalogMode>('agent');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [sharing, setSharing] = useState(false);

  const myProps = properties.filter(p => p.agentId === user?.id && p.status === 'published');
  const allProps = properties.filter(p => p.status === 'published');

  const handleClose = () => {
    onClose();
    // reset after animation
    setTimeout(() => { setStep('hub'); setSelectedProperty(null); }, 400);
  };

  const goBack = () => {
    if (step === 'property-select') setStep('hub');
    else if (step === 'property-share') setStep('property-select');
    else if (step === 'catalogue-share') setStep('hub');
  };

  // ── Property share actions ─────────────────────────────────────────────────
  const sharePropertyWhatsApp = useCallback(async (p: Property) => {
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const text = buildPropertyText(p, user?.name);
      await openWhatsAppMessage(text);
      handleClose();
    } catch (e: unknown) {
      Alert.alert('Could not share listing', e instanceof Error ? e.message : 'Please try another sharing option.');
    } finally {
      setSharing(false);
    }
  }, [user?.name]);

  const sharePropertyNative = useCallback(async (p: Property) => {
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Share.share({
        title: `${p.type === 'sale' ? 'For Sale' : 'To Rent'} — ${p.suburb}`,
        message: buildPropertyText(p, user?.name),
      });
      handleClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      if (!message.toLowerCase().includes('cancel')) {
        Alert.alert('Could not share listing', message || 'Please try again.');
      }
    } finally {
      setSharing(false);
    }
  }, [user?.name]);

  // ── Catalogue share actions ────────────────────────────────────────────────
  const activeProps = catalogMode === 'agent' ? myProps : allProps;
  const catalogLinks = catalogueShareLinks(catalogMode === 'agent' ? user?.id : undefined);
  const catalogUrl = catalogLinks.webUrl;

  const shareCatalogWhatsApp = useCallback(async () => {
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const text = buildCatalogText(activeProps, catalogMode, user?.name, catalogLinks.appUrl, catalogUrl);
      await openWhatsAppMessage(text);
      handleClose();
    } catch (e: unknown) {
      Alert.alert('Could not share catalogue', e instanceof Error ? e.message : 'Please try another sharing option.');
    } finally {
      setSharing(false);
    }
  }, [activeProps, catalogMode, user?.name, catalogLinks.appUrl, catalogUrl]);

  const shareCatalogFacebook = useCallback(async () => {
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(catalogUrl)}`);
      handleClose();
    } catch (e: unknown) {
      Alert.alert('Could not open Facebook', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSharing(false);
    }
  }, [catalogUrl]);

  const shareCatalogNative = useCallback(async () => {
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const text = buildCatalogText(activeProps, catalogMode, user?.name, catalogLinks.appUrl, catalogUrl);
      await Share.share({ title: 'QuickProp Property Catalogue', message: text });
      handleClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      if (!message.toLowerCase().includes('cancel')) {
        Alert.alert('Could not share catalogue', message || 'Please try again.');
      }
    } finally {
      setSharing(false);
    }
  }, [activeProps, catalogMode, user?.name, catalogLinks.appUrl, catalogUrl]);

  // ── Render steps ─────────────────────────────────────────────────────────
  const renderHub = () => (
    <>
      <Text style={[s.sheetTitle, { color: colors.foreground }]}>Share</Text>
      <Text style={[s.sheetSub, { color: colors.mutedForeground }]}>What would you like to share?</Text>

      <TouchableOpacity
        style={[s.hubCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => { Haptics.selectionAsync(); setStep('property-select'); }}
        activeOpacity={0.75}
      >
        <View style={[s.hubIcon, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name="home-outline" size={26} color={colors.primary} />
        </View>
        <View style={s.hubText}>
          <Text style={[s.hubLabel, { color: colors.foreground }]}>Single Property</Text>
          <Text style={[s.hubDesc, { color: colors.mutedForeground }]}>Share one listing via WhatsApp or any app</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.hubCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => { Haptics.selectionAsync(); setCatalogMode('agent'); setStep('catalogue-share'); }}
        activeOpacity={0.75}
      >
        <View style={[s.hubIcon, { backgroundColor: '#10B981' + '18' }]}>
          <Ionicons name="person-outline" size={26} color="#10B981" />
        </View>
        <View style={s.hubText}>
          <Text style={[s.hubLabel, { color: colors.foreground }]}>My Catalogue</Text>
          <Text style={[s.hubDesc, { color: colors.mutedForeground }]}>{myProps.length} listing{myProps.length !== 1 ? 's' : ''} · your listings only</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.hubCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => { Haptics.selectionAsync(); setCatalogMode('company'); setStep('catalogue-share'); }}
        activeOpacity={0.75}
      >
        <View style={[s.hubIcon, { backgroundColor: '#8B5CF6' + '18' }]}>
          <Ionicons name="business-outline" size={26} color="#8B5CF6" />
        </View>
        <View style={s.hubText}>
          <Text style={[s.hubLabel, { color: colors.foreground }]}>Company Catalogue</Text>
          <Text style={[s.hubDesc, { color: colors.mutedForeground }]}>{allProps.length} listing{allProps.length !== 1 ? 's' : ''} · all agency listings</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
    </>
  );

  const renderPropertySelect = () => (
    <>
      <Text style={[s.sheetTitle, { color: colors.foreground }]}>Choose Property</Text>
      <Text style={[s.sheetSub, { color: colors.mutedForeground }]}>Select a listing to share</Text>
      <ScrollView style={s.propList} showsVerticalScrollIndicator={false}>
        {myProps.length === 0 && (
          <View style={s.emptyWrap}>
            <Ionicons name="home-outline" size={36} color={colors.mutedForeground} />
            <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No published listings yet</Text>
          </View>
        )}
        {myProps.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[s.propRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => { Haptics.selectionAsync(); setSelectedProperty(p); setStep('property-share'); }}
            activeOpacity={0.75}
          >
            <View style={[s.propIconWrap, { backgroundColor: colors.primary + '14' }]}>
              <Ionicons name="home-outline" size={18} color={colors.primary} />
            </View>
            <View style={s.propInfo}>
              <Text style={[s.propTitle, { color: colors.foreground }]} numberOfLines={1}>
                {p.bedrooms ? `${p.bedrooms}-bed · ` : ''}{p.suburb}
              </Text>
              <Text style={[s.propSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                {formatPrice(p)} · {p.referenceNumber}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );

  const renderPropertyShare = () => {
    const p = selectedProperty;
    if (!p) return null;
    return (
      <>
        <Text style={[s.sheetTitle, { color: colors.foreground }]}>Share Listing</Text>
        <View style={[s.propPreviewCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <View style={[s.propPreviewIcon, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="home-outline" size={20} color={colors.primary} />
          </View>
          <View style={s.propPreviewText}>
            <Text style={[s.propPreviewTitle, { color: colors.foreground }]} numberOfLines={1}>
              {p.bedrooms ? `${p.bedrooms}-bed · ` : ''}{p.suburb}
            </Text>
            <Text style={[s.propPreviewPrice, { color: colors.primary }]}>{formatPrice(p)}</Text>
            <Text style={[s.propPreviewRef, { color: colors.mutedForeground }]}>{p.referenceNumber}</Text>
          </View>
        </View>

        <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>SHARE VIA</Text>

        <TouchableOpacity
          style={[s.shareBtn, { backgroundColor: '#25D366' + '14', borderColor: '#25D366' + '40' }]}
          onPress={() => sharePropertyWhatsApp(p)}
          disabled={sharing}
          activeOpacity={0.75}
        >
          <View style={[s.shareBtnIcon, { backgroundColor: '#25D366' }]}>
            <Ionicons name="logo-whatsapp" size={22} color="#FFF" />
          </View>
          <View style={s.shareBtnText}>
            <Text style={[s.shareBtnLabel, { color: colors.foreground }]}>WhatsApp</Text>
            <Text style={[s.shareBtnSub, { color: colors.mutedForeground }]}>Send full details + price</Text>
          </View>
          {sharing ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => sharePropertyNative(p)}
          disabled={sharing}
          activeOpacity={0.75}
        >
          <View style={[s.shareBtnIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="share-outline" size={22} color="#FFF" />
          </View>
          <View style={s.shareBtnText}>
            <Text style={[s.shareBtnLabel, { color: colors.foreground }]}>More options</Text>
            <Text style={[s.shareBtnSub, { color: colors.mutedForeground }]}>SMS, email, copy text…</Text>
          </View>
          {sharing ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />}
        </TouchableOpacity>
      </>
    );
  };

  const renderCatalogueShare = () => {
    const forSale = activeProps.filter(p => p.type === 'sale');
    const forRent = activeProps.filter(p => p.type === 'rent');
    const suburbs = [...new Set(activeProps.map(p => p.suburb))].slice(0, 3);
    const isAgent = catalogMode === 'agent';

    return (
      <>
        <Text style={[s.sheetTitle, { color: colors.foreground }]}>
          {isAgent ? 'My Catalogue' : 'Company Catalogue'}
        </Text>

        {/* Catalogue preview */}
        <View style={[s.catPreview, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <View style={s.catPreviewTop}>
            <View style={s.catPreviewInfo}>
              <Text style={[s.catPreviewTitle, { color: colors.foreground }]}>
                {isAgent ? `${user?.name?.split(' ')[0] ?? 'My'}'s Listings` : 'QuickProp — All Listings'}
              </Text>
              {suburbs.length > 0 && (
                <Text style={[s.catPreviewSub, { color: colors.mutedForeground }]}>
                  {suburbs.join(', ')}{activeProps.length > 3 ? ' & more' : ''}
                </Text>
              )}
            </View>
            <View style={[s.countBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[s.countText, { color: colors.primary }]}>
                {activeProps.length} {activeProps.length === 1 ? 'property' : 'properties'}
              </Text>
            </View>
          </View>
          {activeProps.length > 0 ? (
            <View style={s.catStats}>
              {forSale.length > 0 && (
                <View style={s.catStatRow}>
                  <View style={[s.dot, { backgroundColor: colors.primary }]} />
                  <Text style={[s.catStatText, { color: colors.mutedForeground }]}>{forSale.length} for sale</Text>
                </View>
              )}
              {forRent.length > 0 && (
                <View style={s.catStatRow}>
                  <View style={[s.dot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={[s.catStatText, { color: colors.mutedForeground }]}>{forRent.length} to rent</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No published listings yet</Text>
          )}
          {activeProps.slice(0, 3).map(p => (
            <View key={p.id} style={[s.catPropRow, { borderTopColor: colors.border }]}>
              <Text style={[s.catPropName, { color: colors.foreground }]} numberOfLines={1}>
                {p.bedrooms ? `${p.bedrooms}-bed · ` : ''}{p.suburb}
              </Text>
              <Text style={[s.catPropPrice, { color: colors.primary }]}>{formatPrice(p)}</Text>
            </View>
          ))}
        </View>

        <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>SHARE VIA</Text>

        <View style={s.shareRow}>
          <TouchableOpacity
            style={[s.shareSmallBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={shareCatalogWhatsApp}
            disabled={sharing || activeProps.length === 0}
            activeOpacity={0.75}
          >
            <View style={[s.shareSmallIcon, { backgroundColor: '#25D366' }]}>
              <Ionicons name="logo-whatsapp" size={22} color="#FFF" />
            </View>
            <Text style={[s.shareSmallLabel, { color: colors.foreground }]}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.shareSmallBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={shareCatalogFacebook}
            disabled={sharing || activeProps.length === 0}
            activeOpacity={0.75}
          >
            <View style={[s.shareSmallIcon, { backgroundColor: '#1877F2' }]}>
              <Ionicons name="logo-facebook" size={22} color="#FFF" />
            </View>
            <Text style={[s.shareSmallLabel, { color: colors.foreground }]}>Facebook</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.shareSmallBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={shareCatalogNative}
            disabled={sharing || activeProps.length === 0}
            activeOpacity={0.75}
          >
            <View style={[s.shareSmallIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="share-outline" size={22} color="#FFF" />
            </View>
            <Text style={[s.shareSmallLabel, { color: colors.foreground }]}>More</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Pressable style={s.backdrop} onPress={handleClose}>
        <Pressable style={[s.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          {/* Handle */}
          <View style={[s.handle, { backgroundColor: colors.border }]} />

          {/* Header row */}
          <View style={s.headerRow}>
            {step !== 'hub' ? (
              <TouchableOpacity onPress={goBack} style={[s.navBtn, { backgroundColor: colors.muted }]}>
                <Ionicons name="arrow-back" size={18} color={colors.foreground} />
              </TouchableOpacity>
            ) : (
              <View style={[s.navBtn, { backgroundColor: colors.muted }]}>
                <Ionicons name="share-social" size={18} color={colors.primary} />
              </View>
            )}
            <TouchableOpacity onPress={handleClose} style={[s.navBtn, { backgroundColor: colors.muted }]}>
              <Ionicons name="close" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Step content */}
          {step === 'hub' && renderHub()}
          {step === 'property-select' && renderPropertySelect()}
          {step === 'property-share' && renderPropertyShare()}
          {step === 'catalogue-share' && renderCatalogueShare()}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 44 : 28, paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  navBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginBottom: 4 },
  sheetSub: { fontSize: 14, marginBottom: 20 },

  // Hub cards
  hubCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  hubIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  hubText: { flex: 1 },
  hubLabel: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  hubDesc: { fontSize: 13, lineHeight: 18 },

  // Property list (select step)
  propList: { maxHeight: 320 },
  propRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8,
  },
  propIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  propInfo: { flex: 1 },
  propTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  propSub: { fontSize: 12 },

  // Property share step
  propPreviewCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 20 },
  propPreviewIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  propPreviewText: { flex: 1 },
  propPreviewTitle: { fontSize: 14, fontWeight: '700' },
  propPreviewPrice: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  propPreviewRef: { fontSize: 12, marginTop: 2 },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10,
  },
  shareBtnIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  shareBtnText: { flex: 1 },
  shareBtnLabel: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  shareBtnSub: { fontSize: 12 },

  // Catalogue share step
  catPreview: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 20, gap: 8 },
  catPreviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  catPreviewInfo: { flex: 1, marginRight: 8 },
  catPreviewTitle: { fontSize: 14, fontWeight: '700' },
  catPreviewSub: { fontSize: 12, marginTop: 2 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  countText: { fontSize: 12, fontWeight: '600' },
  catStats: { flexDirection: 'row', gap: 16 },
  catStatRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  catStatText: { fontSize: 12 },
  catPropRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, marginTop: 4 },
  catPropName: { fontSize: 12, flex: 1 },
  catPropPrice: { fontSize: 12, fontWeight: '600', marginLeft: 8 },

  shareRow: { flexDirection: 'row', gap: 12 },
  shareSmallBtn: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, gap: 8 },
  shareSmallIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  shareSmallLabel: { fontSize: 13, fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText: { fontSize: 14 },
});
