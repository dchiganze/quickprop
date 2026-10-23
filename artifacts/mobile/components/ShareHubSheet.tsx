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
import { catalogueShareLinks, getFacebookShareUrl, propertyShareLinks } from '@/utils/shareLinks';
import { buildCatalogueShareMessage, buildPropertyShareMessage, formatSharePrice } from '@/utils/shareContent';
import {
  PropertySocialDestination,
  shareCatalogueToSocial,
  shareCatalogueToWhatsApp,
  sharePropertyToWhatsApp,
  sharePropertyToSocial,
} from '@/utils/whatsapp';
import { PropertyFlyer, PropertyFlyerHandle } from '@/components/PropertyFlyer';
import { FlyerCustomizer } from '@/components/FlyerCustomizer';
import { useFlyerSettings } from '@/hooks/useFlyerSettings';
import { waitForShareModalDismissal } from '@/utils/socialShareFlow';
import { ShareCatalogueCard, ShareCatalogueCardHandle } from '@/components/ShareCatalogueCard';

type Step = 'hub' | 'property-select' | 'property-share' | 'catalogue-share';
type CatalogMode = 'agent' | 'company';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function formatPrice(p: Property) {
  return formatSharePrice(p);
}

export function ShareHubSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const { properties } = useData();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('hub');
  const [catalogMode, setCatalogMode] = useState<CatalogMode>('agent');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<PropertyFlyerHandle>(null);
  const flyer = useFlyerSettings(selectedProperty ?? undefined, user);
  const [flyerEditorOpen, setFlyerEditorOpen] = useState(false);
  const dismissRef = useRef<(() => void) | null>(null);
  const beforeNativeShare = useCallback(async () => {
    if (Platform.OS !== 'ios') return;
    try {
      await waitForShareModalDismissal(done => {
        dismissRef.current = done;
        onClose();
      });
    } finally {
      dismissRef.current = null;
    }
  }, [onClose]);
  const catalogueCardRef = useRef<ShareCatalogueCardHandle>(null);

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
    if (flyer.loading) return;
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await sharePropertyToWhatsApp(
        p,
        () => shareCardRef.current?.capture()
          ?? Promise.reject(new Error('Unable to prepare the property image.')),
        { agentId: user?.id, beforeNativeShare },
      );
      handleClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      if (!message.toLowerCase().includes('cancel') && !message.toLowerCase().includes('dismiss')) {
        Alert.alert('Could not share listing', 'Unable to prepare the property. Please try again.');
      }
    } finally {
      setSharing(false);
    }
  }, [user?.id, flyer.loading, beforeNativeShare]);

  const sharePropertyNative = useCallback(async (p: Property) => {
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
       await Share.share({
         title: `${p.type === 'sale' ? 'For Sale' : 'To Rent'} — ${p.suburb}`,
         message: buildPropertyShareMessage(p, user?.name),
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

  const sharePropertySocial = useCallback(async (p: Property, destination: PropertySocialDestination) => {
    if (flyer.loading) return;
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await sharePropertyToSocial(
        p,
        destination,
        () => shareCardRef.current?.capture()
          ?? Promise.reject(new Error('Unable to prepare the property flyer.')),
        beforeNativeShare,
      );
      handleClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      if (!message.toLowerCase().includes('cancel') && !message.toLowerCase().includes('dismiss')) {
        Alert.alert('Could not share listing', message || 'Please try another sharing option.');
      }
    } finally {
      setSharing(false);
    }
  }, [user?.id, flyer.loading, beforeNativeShare]);

  // ── Catalogue share actions ────────────────────────────────────────────────
  const activeProps = catalogMode === 'agent' ? myProps : allProps;
  const catalogLinks = catalogueShareLinks(catalogMode === 'agent' ? user?.id : undefined);
  const catalogUrl = catalogLinks.webUrl;

  const shareCatalogWhatsApp = useCallback(async () => {
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const text = buildCatalogueShareMessage(activeProps, catalogMode, user?.name, user?.id);
      await shareCatalogueToWhatsApp(
        text,
        () => catalogueCardRef.current?.capture()
           ?? Promise.reject(new Error('Unable to prepare the brochure image.')),
      );
      handleClose();
    } catch (e: unknown) {
      Alert.alert('Could not share brochure', e instanceof Error ? e.message : 'Please try another sharing option.');
    } finally {
      setSharing(false);
    }
  }, [activeProps, catalogMode, user?.name, catalogLinks.appUrl, catalogUrl]);

  const shareCatalogFacebook = useCallback(async () => {
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const text = buildCatalogueShareMessage(activeProps, catalogMode, user?.name, user?.id);
      await shareCatalogueToSocial(
        text,
        () => catalogueCardRef.current?.capture()
          ?? Promise.reject(new Error('Unable to prepare the brochure image.')),
        'Share brochure to Facebook',
        getFacebookShareUrl(catalogLinks.previewUrl, text),
        'facebook',
      );
      handleClose();
    } catch (e: unknown) {
      Alert.alert('Could not open Facebook', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSharing(false);
    }
  }, [activeProps, catalogMode, user?.name, user?.id, catalogUrl]);

  const shareCatalogInstagram = useCallback(async () => {
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const text = buildCatalogueShareMessage(activeProps, catalogMode, user?.name, user?.id);
      await shareCatalogueToSocial(
        text,
        () => catalogueCardRef.current?.capture()
          ?? Promise.reject(new Error('Unable to prepare the brochure image.')),
        'Share brochure to Instagram',
        null,
        'instagram',
      );
      handleClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      if (!message.toLowerCase().includes('cancel') && !message.toLowerCase().includes('dismiss')) {
        Alert.alert('Could not open Instagram', message || 'Please try again.');
      }
    } finally {
      setSharing(false);
    }
  }, [activeProps, catalogMode, user?.name, user?.id]);

  const shareCatalogLinkedIn = useCallback(async () => {
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const text = buildCatalogueShareMessage(activeProps, catalogMode, user?.name, user?.id);
      await shareCatalogueToSocial(
        text,
        () => catalogueCardRef.current?.capture()
          ?? Promise.reject(new Error('Unable to prepare the brochure image.')),
        'Share brochure to LinkedIn',
        null,
        'linkedin',
      );
      handleClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      if (!message.toLowerCase().includes('cancel') && !message.toLowerCase().includes('dismiss')) {
        Alert.alert('Could not open LinkedIn', message || 'Please try again.');
      }
    } finally {
      setSharing(false);
    }
  }, [activeProps, catalogMode, user?.name, user?.id]);

  const shareCatalogNative = useCallback(async () => {
    setSharing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const text = buildCatalogueShareMessage(activeProps, catalogMode, user?.name, user?.id);
      await shareCatalogueToSocial(
        text,
        () => catalogueCardRef.current?.capture()
          ?? Promise.reject(new Error('Unable to prepare the brochure image.')),
        'Share property brochure',
      );
      handleClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      if (!message.toLowerCase().includes('cancel')) {
         Alert.alert('Could not share brochure', message || 'Please try again.');
      }
    } finally {
      setSharing(false);
    }
  }, [activeProps, catalogMode, user?.name, user?.id, catalogLinks.appUrl, catalogUrl]);

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
          <Text style={[s.hubLabel, { color: colors.foreground }]}>My Brochure</Text>
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
          <Text style={[s.hubLabel, { color: colors.foreground }]}>Company Brochure</Text>
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

        <TouchableOpacity
          disabled={sharing || flyer.loading}
          style={{ paddingVertical: 12 }}
          onPress={async () => {
            try {
              await beforeNativeShare();
              if (Platform.OS !== 'ios') onClose();
              setFlyerEditorOpen(true);
            } catch (error) {
              Alert.alert('Could not open flyer', error instanceof Error ? error.message : 'Please try again.');
            }
          }}
        >
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            {flyer.loading ? 'Loading flyer…' : 'Preview & customise flyer'}
          </Text>
        </TouchableOpacity>
        {!!flyer.error && <Text style={{ color: colors.destructive }}>{flyer.error}</Text>}
        <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>SHARE VIA</Text>

        <TouchableOpacity
          style={[s.shareBtn, { backgroundColor: '#25D366' + '14', borderColor: '#25D366' + '40' }]}
          onPress={() => sharePropertyWhatsApp(p)}
          disabled={sharing}
          activeOpacity={0.75}
        >
          <View style={[s.shareBtnIcon, { backgroundColor: '#25D366' }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FFF" />
          </View>
          <View style={s.shareBtnText}>
             <Text style={[s.shareBtnLabel, { color: colors.foreground }]}>Share to WhatsApp</Text>
              <Text style={[s.shareBtnSub, { color: colors.mutedForeground }]}>Property image + property link</Text>
          </View>
          {sharing ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />}
        </TouchableOpacity>

        <View style={s.socialShareRow}>
          {(['facebook', 'linkedin'] as const).map(destination => (
            <TouchableOpacity
              key={destination}
              style={[s.socialShareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => sharePropertySocial(p, destination)}
              disabled={sharing}
              activeOpacity={0.75}
            >
              <View style={[s.socialShareIcon, { backgroundColor: destination === 'facebook' ? '#1877F2' : '#0A66C2' }]}>
                <Ionicons name={destination === 'facebook' ? 'logo-facebook' : 'logo-linkedin'} size={21} color="#FFF" />
              </View>
              <Text style={[s.socialShareLabel, { color: colors.foreground }]}>
                {destination === 'facebook' ? 'Facebook' : 'LinkedIn'}
              </Text>
              <Text style={[s.socialShareHint, { color: colors.mutedForeground }]}>Flyer only</Text>
            </TouchableOpacity>
          ))}
        </View>

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
          {isAgent ? 'My Brochure' : 'Company Brochure'}
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

        <View style={[s.shareRow, { flexWrap: 'wrap' }]}>
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
            onPress={shareCatalogInstagram}
            disabled={sharing || activeProps.length === 0}
            activeOpacity={0.75}
          >
            <View style={[s.shareSmallIcon, { backgroundColor: '#E1306C' }]}>
              <Ionicons name="logo-instagram" size={22} color="#FFF" />
            </View>
            <Text style={[s.shareSmallLabel, { color: colors.foreground }]}>Instagram</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.shareSmallBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={shareCatalogLinkedIn}
            disabled={sharing || activeProps.length === 0}
            activeOpacity={0.75}
          >
            <View style={[s.shareSmallIcon, { backgroundColor: '#0A66C2' }]}>
              <Ionicons name="logo-linkedin" size={22} color="#FFF" />
            </View>
            <Text style={[s.shareSmallLabel, { color: colors.foreground }]}>LinkedIn</Text>
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
    <>
    {selectedProperty && (
      <FlyerCustomizer
        visible={flyerEditorOpen}
        onClose={() => setFlyerEditorOpen(false)}
        property={selectedProperty}
        settings={flyer.settings}
        onChange={flyer.setSettings}
        onReset={flyer.reset}
        shareUrl={propertyShareLinks(selectedProperty).webUrl}
      />
    )}
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      onDismiss={() => dismissRef.current?.()}
      statusBarTranslucent
    >
      <Pressable style={s.backdrop} onPress={handleClose}>
        <Pressable style={[s.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          {selectedProperty && (
            <View style={s.shareCardHost} pointerEvents="none">
              <PropertyFlyer
                key={selectedProperty.id}
                ref={shareCardRef}
                property={selectedProperty}
                settings={flyer.settings}
                shareUrl={propertyShareLinks(selectedProperty).webUrl}
              />
            </View>
          )}
          <View style={s.catalogueCardHost} pointerEvents="none">
            <ShareCatalogueCard
              ref={catalogueCardRef}
              properties={activeProps}
              mode={catalogMode}
              agentName={user?.name}
              agentId={user?.id}
            />
          </View>
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
    </>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  shareCardHost: { position: 'absolute', left: -1000, top: 0, width: 360, height: 450 },
  shareCollageHost: { position: 'absolute', left: -1000, top: 0, width: 360, height: 360 },
  catalogueCardHost: { position: 'absolute', left: -1000, top: 0, width: 360, height: 450 },
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
  socialShareRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  socialShareBtn: { flex: 1, alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 12, gap: 4 },
  socialShareIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  socialShareLabel: { fontSize: 13, fontWeight: '700' },
  socialShareHint: { fontSize: 10 },

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
