import React, { useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert, Linking, Image, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { PropertyBrochureSheet } from '@/components/BrochureSheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { propertyShareLinks } from '@/utils/shareLinks';
import { getPrimaryListingPhoto } from '@/utils/listingPhoto';
import { ListingImage } from '@/components/ListingImage';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { PropertyFlyer, PropertyFlyerHandle } from '@/components/PropertyFlyer';
import { FlyerCustomizer } from '@/components/FlyerCustomizer';
import { useFlyerSettings } from '@/hooks/useFlyerSettings';
import { PropertyShareSheet } from '@/components/PropertyShareSheet';
import { parsePrivateContactNotes, useData } from '@/contexts/DataContext';
import { Property } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  getGetAgentContactsQueryKey,
  getGetMultiAgentPropertyQueryKey,
  getListRentalApplicationsQueryKey,
  useCreateRentalApplicationInvite,
  useGetAgentContacts,
  useGetMultiAgentProperty,
  useListRentalApplications,
} from '@workspace/api-client-react';
import type { RentalApplicationInvite } from '@workspace/api-client-react';
import * as Clipboard from 'expo-clipboard';
import { addMyAgencyToProperty } from '@/utils/multiAgent';

function VideoPlayerModal({ uri, onClose }: { uri: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, p => { p.loop = false; p.play(); });
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <VideoView
          player={player}
          style={{ flex: 1 }}
          fullscreenOptions={{ enable: true }}
          allowsPictureInPicture
          nativeControls
        />
        <TouchableOpacity
          onPress={onClose}
          style={{ position: 'absolute', top: 56, right: 20, backgroundColor: '#00000099', borderRadius: 22, padding: 10 }}
        >
          <Ionicons name="close" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const STATUS_COLORS: Record<Property['status'], string> = {
  published: '#10B981', draft: '#F59E0B', archived: '#64748B', sold: '#EF4444', rented: '#8B5CF6', pending: '#3B82F6',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[sStyles.section, { borderColor: colors.border }]}>
      <Text style={[sStyles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      {children}
    </View>
  );
}
const sStyles = StyleSheet.create({
  section: { borderTopWidth: 1, paddingTop: 20, marginBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
});

export default function ListingDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { properties, updateProperty, recordPropertySale } = useData();
  const property = properties.find(p => p.id === id);
  const { user, loading: authLoading } = useAuth();
  const remoteAgentId = user?.id && /^\d+$/.test(user.id) ? user.id : null;
  const remotePropertyId = Number(id);
  const { data: multiAgent } = useGetMultiAgentProperty(remotePropertyId, {
    query: {
      enabled: Number.isInteger(remotePropertyId) && remotePropertyId > 0,
      queryKey: getGetMultiAgentPropertyQueryKey(remotePropertyId),
    },
  });
  const contactType = property?.listingType === 'rent' ? 'landlord' : 'seller';
  const {
    data: agentContacts = [],
    isLoading: isContactLoading,
    isError: isContactError,
  } = useGetAgentContacts(
    { type: contactType },
    {
      query: {
        enabled: Boolean(property) && !authLoading && remoteAgentId !== null,
        queryKey: [...getGetAgentContactsQueryKey({ type: contactType }), remoteAgentId ?? 'unauthenticated'],
      },
    },
  );
  const linkedContact = agentContacts.find(contact =>
    contact.properties.some(linkedProperty => linkedProperty.id === remotePropertyId),
  );
  const linkedContactProperty = linkedContact?.properties.find(
    linkedProperty => linkedProperty.id === remotePropertyId,
  );
  const legacyContact = parsePrivateContactNotes(property?.seller.notes);
  const fallbackContactName = property?.seller.name && !/seller details available in quickprop office/i.test(property.seller.name)
    ? property.seller.name
    : '';
  const contactName = linkedContact?.name || fallbackContactName || legacyContact.name;
  const contactPhone = linkedContact?.phone || property?.seller.phone || legacyContact.phone || '';
  const contactEmail = linkedContact?.email || property?.seller.email || legacyContact.email || '';
  const contactNotes = linkedContact?.notes || legacyContact.notes;
  const contactMandateType = linkedContactProperty?.mandateType === 'open' || property?.seller.mandateType === 'open'
    ? 'open'
    : 'sole';
  const contactMandateExpiry = linkedContactProperty?.mandateExpiry || property?.seller.mandateExpiry || '';
  const contactMandateExpiryDisplay = contactMandateExpiry && !Number.isNaN(Date.parse(contactMandateExpiry))
    ? new Date(contactMandateExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : contactMandateExpiry;
  const hasPrivateContactDetails = Boolean(
    contactName || contactPhone || contactEmail || contactNotes || contactMandateExpiry,
  );
  const [brochureOpen, setBrochureOpen] = useState(false);
  const [videoPlayerVisible, setVideoPlayerVisible] = useState(false);
  const [shareOptionsOpen, setShareOptionsOpen] = useState(false);
  const [saleModalVisible, setSaleModalVisible] = useState(false);
  const [salePriceInput, setSalePriceInput] = useState('');
  const [conveyancerNameInput, setConveyancerNameInput] = useState('');
  const [conveyancerEmailInput, setConveyancerEmailInput] = useState('');
  const [conveyancerPhoneInput, setConveyancerPhoneInput] = useState('');
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [saleConfirmation, setSaleConfirmation] = useState<{
    confirmationUrl: string;
    conveyancerName: string;
    conveyancerEmail: string;
    conveyancerPhone: string;
  } | null>(null);
  const [applicationInvite, setApplicationInvite] = useState<RentalApplicationInvite | null>(null);
  const [applicationInviteVisible, setApplicationInviteVisible] = useState(false);
  const [expandedApplicationId, setExpandedApplicationId] = useState<number | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const shareCardRef = useRef<PropertyFlyerHandle>(null);
  const [flyerOpen, setFlyerOpen] = useState(false);
  const flyer = useFlyerSettings(property, user);
  const canManageApplications = property?.listingType === 'rent'
    && property.status === 'published'
    && Number.isInteger(remotePropertyId)
    && remotePropertyId > 0;
  const rentalApplicationsQuery = useListRentalApplications(
    { propertyId: remotePropertyId },
    {
      query: {
        enabled: Boolean(canManageApplications),
        queryKey: getListRentalApplicationsQueryKey({ propertyId: remotePropertyId }),
      },
    },
  );
  const rentalApplications = rentalApplicationsQuery.data ?? [];
  const createRentalInvite = useCreateRentalApplicationInvite();

  const handleAddAgency = async () => {
    if (!multiAgent || !user || !property) return;
    try {
      await addMyAgencyToProperty(multiAgent.propertyId, {
        askingPrice: property.price,
        currency: property.currency,
        mandateType: property.seller.mandateType,
        terms: property.negotiable ? 'Negotiable' : undefined,
        description: property.description,
        contactName: user.name,
        contactPhone: user.phone,
        contactEmail: user.email,
        verificationStatus: 'pending',
      });
      Alert.alert('Agency Added', 'Your agency now has its own offer on this canonical property.');
    } catch (error: any) {
      Alert.alert('Could Not Add Agency', error?.message ?? 'This agency may already be associated with the property.');
    }
  };

  if (!property) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.foreground }}>Property not found.</Text>
      </View>
    );
  }

  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShareOptionsOpen(true);
  };

  const handleCreateApplicationInvite = async () => {
    if (!canManageApplications) return;
    try {
      const invite = await createRentalInvite.mutateAsync({ id: remotePropertyId });
      setApplicationInvite(invite);
      setInviteCopied(false);
      setApplicationInviteVisible(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert(
        'Link not created',
        error?.message ?? 'We could not create an application link. Check your connection and try again.',
      );
    }
  };

  const shareApplicationInvite = async (channel: 'whatsapp' | 'email') => {
    if (!applicationInvite) return;
    const message = `Apply for ${property.title} (${property.referenceNumber}): ${applicationInvite.applicationUrl}`;
    const url = channel === 'whatsapp'
      ? `https://wa.me/?text=${encodeURIComponent(message)}`
      : `mailto:?subject=${encodeURIComponent(`Rental application · ${property.referenceNumber}`)}&body=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        channel === 'whatsapp' ? 'WhatsApp unavailable' : 'Email unavailable',
        'The sharing app could not be opened. Copy the secure link and share it manually.',
      );
    }
  };

  const copyApplicationInvite = async () => {
    if (!applicationInvite) return;
    try {
      await Clipboard.setStringAsync(applicationInvite.applicationUrl);
      setInviteCopied(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Could not copy link', 'Please try again or share it using WhatsApp or email.');
    }
  };

  const handleAddMedia = () => {
    Alert.alert('Add Photo or Video', 'Choose a source', [
      {
        text: 'Take Photo or Video',
        onPress: async () => {
          try {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) { Alert.alert('Permission Required', 'Enable camera access in Settings.'); return; }
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], videoMaxDuration: 60, quality: 0.8 });
            if (!result.canceled && result.assets?.[0]) {
              const asset = result.assets[0];
              if (asset.type === 'video') {
                updateProperty(property.id, { videoUrl: asset.uri });
              } else {
                updateProperty(property.id, { photos: [...property.photos, asset.uri] });
              }
            }
          } catch (e: any) { Alert.alert('Camera Error', e?.message ?? 'Could not open camera.'); }
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) { Alert.alert('Permission Required', 'Enable photo library access in Settings.'); return; }
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, videoMaxDuration: 60, quality: 0.8 });
            if (!result.canceled && result.assets?.length) {
              const newPhotos = result.assets.filter(a => a.type !== 'video').map(a => a.uri);
              const video = result.assets.find(a => a.type === 'video');
              const updates: Record<string, unknown> = {};
              if (newPhotos.length) updates.photos = [...property.photos, ...newPhotos];
              if (video) updates.videoUrl = video.uri;
              if (Object.keys(updates).length) updateProperty(property.id, updates as any);
            }
          } catch (e: any) { Alert.alert('Library Error', e?.message ?? 'Could not open library.'); }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRemovePhoto = (index: number) => {
    Alert.alert('Remove Photo', 'Remove this photo from the listing?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => updateProperty(property.id, { photos: property.photos.filter((_, i) => i !== index) }),
      },
    ]);
  };

  const handleRemoveVideo = () => {
    Alert.alert('Remove Video', 'Remove this video from the listing?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => updateProperty(property.id, { videoUrl: undefined }),
      },
    ]);
  };

  const handlePlayVideo = () => {
    if (!property.videoUrl) return;
    setVideoPlayerVisible(true);
  };

  const handleRemoveListing = () => {
    Alert.alert('Remove Listing', 'Was this property sold?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'No, withdraw it',
        onPress: async () => {
          await updateProperty(property.id, { status: 'archived', availabilityStatus: 'withdrawn' });
          router.back();
        },
      },
      {
        text: 'Yes, it was sold',
        style: 'destructive',
        onPress: async () => {
          setSalePriceInput('');
          setConveyancerNameInput('');
          setConveyancerEmailInput('');
          setConveyancerPhoneInput('');
          setSaleConfirmation(null);
          setSaleModalVisible(true);
        },
      },
    ]);
  };

  const handleConfirmSale = async () => {
    const salePrice = Number(salePriceInput.replace(/,/g, '').trim());
    if (!Number.isFinite(salePrice) || salePrice <= 0) {
      Alert.alert('Sale price required', 'Enter the positive price the property sold for.');
      return;
    }
    if (!conveyancerNameInput.trim()) {
      Alert.alert('Conveyancer name required', 'Enter the conveyancer’s name to request sale confirmation.');
      return;
    }
    if (!conveyancerEmailInput.trim() && !conveyancerPhoneInput.trim()) {
      Alert.alert('Contact details required', 'Enter the conveyancer’s email address or WhatsApp number.');
      return;
    }
    setSaleSubmitting(true);
    try {
      const result = await recordPropertySale(property.id, {
        salePrice,
        soldAt: new Date().toISOString(),
        conveyancerName: conveyancerNameInput.trim(),
        ...(conveyancerEmailInput.trim() ? { conveyancerEmail: conveyancerEmailInput.trim() } : {}),
        ...(conveyancerPhoneInput.trim() ? { conveyancerPhone: conveyancerPhoneInput.trim() } : {}),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaleConfirmation({
        confirmationUrl: result.confirmationUrl,
        conveyancerName: conveyancerNameInput.trim(),
        conveyancerEmail: conveyancerEmailInput.trim(),
        conveyancerPhone: conveyancerPhoneInput.trim(),
      });
    } catch (error) {
      Alert.alert('Could not record sale', error instanceof Error ? error.message : 'Try again when you are online.');
    } finally {
      setSaleSubmitting(false);
    }
  };

  const price = property.price >= 1000000
    ? `${property.currency} ${(property.price / 1000000).toFixed(2)}M`
    : `${property.currency} ${property.price.toLocaleString()}`;
  const priceDisplay = property.type === 'rent' ? `${price}/mo` : price;
  const primaryPhoto = getPrimaryListingPhoto(property);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.shareCardHost} pointerEvents="none">
        <PropertyFlyer
          ref={shareCardRef}
          property={property}
          settings={flyer.settings}
          shareUrl={propertyShareLinks(property).webUrl}
        />
      </View>
      <FlyerCustomizer
        visible={flyerOpen}
        onClose={() => setFlyerOpen(false)}
        property={property}
        settings={flyer.settings}
        onChange={flyer.setSettings}
        onReset={flyer.reset}
        shareUrl={propertyShareLinks(property).webUrl}
      />
      {flyer.error && <Text style={{ color: colors.destructive, padding: 12 }}>{flyer.error}</Text>}
      {videoPlayerVisible && property.videoUrl && (
        <VideoPlayerModal uri={property.videoUrl} onClose={() => setVideoPlayerVisible(false)} />
      )}
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 12), backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.topRef, { color: colors.mutedForeground }]}>{property.referenceNumber}</Text>
        <View style={styles.topActions}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.primary }]} onPress={() => router.push(`/edit-listing/${property.id}`)}>
            <Ionicons name="create-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        {/* Gallery */}
        {property.photos.length > 0 || property.videoUrl || primaryPhoto ? (
          <View style={[styles.gallery, { backgroundColor: colors.card }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryScroll}>
              {property.photos.length === 0 && primaryPhoto && (
                <View style={styles.photoThumb}>
                  <ListingImage uri={primaryPhoto} style={styles.photoImg} resizeMode="cover" />
                </View>
              )}
              {property.photos.map((uri, index) => (
                <View key={index} style={styles.photoThumb}>
                  <ListingImage uri={uri} style={styles.photoImg} resizeMode="cover" />
                  <TouchableOpacity style={styles.photoDelete} onPress={() => handleRemovePhoto(index)}>
                    <Ionicons name="close-circle" size={24} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {property.videoUrl && (
                <View style={styles.photoThumb}>
                  <View style={[styles.photoImg, { backgroundColor: '#0A1628', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="videocam" size={28} color="#FFFFFF88" />
                    <TouchableOpacity onPress={handlePlayVideo} style={styles.videoPlayOverlay}>
                      <Ionicons name="play-circle" size={36} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.photoDelete} onPress={handleRemoveVideo}>
                    <Ionicons name="close-circle" size={24} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={[styles.addPhotoTile, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={handleAddMedia}
              >
                <Ionicons name="add" size={28} color={colors.primary} />
                <Text style={[styles.addPhotoLabel, { color: colors.primary }]}>Add</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[property.status] }]}>
              <Text style={styles.statusText}>{property.status.charAt(0).toUpperCase() + property.status.slice(1)}</Text>
            </View>
            <View style={[styles.photoCountBadge, { backgroundColor: '#00000066' }]}>
              <Ionicons name="images-outline" size={12} color="#FFF" />
                <Text style={styles.photoCountText}>{property.photos.length || (primaryPhoto ? 1 : 0)}{property.videoUrl ? ' · 1 video' : ''}</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.gallery, { backgroundColor: colors.muted }]}
            onPress={handleAddMedia}
            activeOpacity={0.75}
          >
            <Image source={require('../../assets/images/logo.png')} style={styles.fallbackImage} resizeMode="contain" />
            <View style={[styles.fallbackVeil, { backgroundColor: colors.muted + 'D9' }]}>
              <Ionicons name="home-outline" size={38} color={colors.mutedForeground} />
              <Text style={[styles.galleryHint, { color: colors.mutedForeground }]}>Main photo coming soon · tap to add media</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[property.status] }]}>
              <Text style={styles.statusText}>{property.status.charAt(0).toUpperCase() + property.status.slice(1)}</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.body}>
          {/* Price & Address */}
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.primary }]}>{priceDisplay}</Text>
            {property.negotiable && <View style={[styles.negBadge, { backgroundColor: colors.accent + '20' }]}><Text style={[styles.negText, { color: colors.accent }]}>Negotiable</Text></View>}
          </View>
          {property.showAddress && <Text style={[styles.address, { color: colors.foreground }]}>{property.address}</Text>}
          <View style={styles.suburbRow}>
            <Text style={[styles.suburb, { color: colors.mutedForeground }]}>{property.suburb}</Text>
            <View style={[styles.visibilityBadge, {
              backgroundColor: property.showAddress ? colors.accent + '18' : colors.muted,
              borderColor:     property.showAddress ? colors.accent        : colors.border,
            }]}>
              <Ionicons
                name={property.showAddress ? 'eye-outline' : 'eye-off-outline'}
                size={11}
                color={property.showAddress ? colors.accent : colors.mutedForeground}
              />
              <Text style={[styles.visibilityText, { color: property.showAddress ? colors.accent : colors.mutedForeground }]}>
                {property.showAddress ? 'Address public' : 'Address hidden'}
              </Text>
            </View>
          </View>

          {multiAgent && multiAgent.offers.length > 0 && (
            <Section title="MULTI-AGENT PROPERTY">
              <View style={[styles.multiAgentSummary, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.multiAgentTitle, { color: colors.foreground }]}>
                    {multiAgent.agencyCount} agency{multiAgent.agencyCount === 1 ? '' : 'ies'} · lowest {multiAgent.property.currency} {multiAgent.lowestPrice.toLocaleString()}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, marginTop: 4 }}>
                    Independent offers are kept separate on one physical property record.
                  </Text>
                </View>
                <TouchableOpacity style={[styles.agencyButton, { backgroundColor: colors.primary }]} onPress={handleAddAgency}>
                  <Ionicons name="add" size={16} color="#FFF" />
                  <Text style={styles.agencyButtonText}>Add my agency</Text>
                </TouchableOpacity>
              </View>
              {multiAgent.offers.map(offer => (
                <View key={offer.id} style={[styles.offerRow, { borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.offerAgency, { color: colors.foreground }]}>{offer.agencyName}</Text>
                    <Text style={{ color: colors.mutedForeground }}>{offer.agentName} · {offer.verificationStatus}</Text>
                  </View>
                  <Text style={[styles.offerPrice, { color: colors.primary }]}>{offer.currency} {offer.askingPrice.toLocaleString()}</Text>
                </View>
              ))}
            </Section>
          )}

          {/* 500 m privacy map */}
          {property.coordinates && (
            <TouchableOpacity
              style={[styles.mapWrap, styles.mapButton, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                const { lat, lng } = property.coordinates!;
                const url = Platform.OS === 'ios'
                  ? `maps://?ll=${lat},${lng}&z=14`
                  : `geo:${lat},${lng}?z=14`;
                Linking.openURL(url).catch(() =>
                  Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`)
                );
              }}
              activeOpacity={0.75}
            >
              <View style={styles.mapButtonInner}>
                <View style={[styles.mapIconWrap, { backgroundColor: '#10B98120' }]}>
                  <Ionicons name="navigate-circle-outline" size={28} color="#10B981" />
                </View>
                <View style={styles.mapTextWrap}>
                  <Text style={[styles.mapButtonTitle, { color: colors.foreground }]}>View on Map</Text>
                  <Text style={[styles.mapBadgeText, { color: colors.mutedForeground }]}>
                    Approximate area · 500 m radius
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </View>
            </TouchableOpacity>
          )}

          {/* Key stats */}
          {(property.bedrooms !== undefined || property.bathrooms !== undefined || property.garages !== undefined) && (
            <View style={[styles.statsRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              {property.bedrooms !== undefined && (
                <View style={styles.statItem}>
                  <Ionicons name="bed-outline" size={20} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{property.bedrooms}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Beds</Text>
                </View>
              )}
              {property.bathrooms !== undefined && (
                <View style={styles.statItem}>
                  <Ionicons name="water-outline" size={20} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{property.bathrooms}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Baths</Text>
                </View>
              )}
              {property.garages !== undefined && property.garages > 0 && (
                <View style={styles.statItem}>
                  <Ionicons name="car-outline" size={20} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{property.garages}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Garages</Text>
                </View>
              )}
              {property.landSize !== undefined && property.landSize > 0 && (
                <View style={styles.statItem}>
                  <Ionicons name="resize-outline" size={20} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{property.landSize}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>m² Land</Text>
                </View>
              )}
              {property.floorArea !== undefined && property.floorArea > 0 && (
                <View style={styles.statItem}>
                  <Ionicons name="expand-outline" size={20} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{property.floorArea}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>m² Floor</Text>
                </View>
              )}
            </View>
          )}

          {/* Description */}
          {property.description && (
            <Section title="DESCRIPTION">
              <Text style={[styles.description, { color: colors.foreground }]}>{property.description}</Text>
            </Section>
          )}

          {/* Features */}
          {property.features.length > 0 && (
            <Section title="FEATURES">
              <View style={styles.features}>
                {property.features.map(f => (
                  <View key={f} style={[styles.featureChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                    <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* Financial */}
          {(property.levies !== undefined || property.rates !== undefined) && (
            <Section title="FINANCIAL">
              <View style={styles.financialRow}>
                {property.rates !== undefined && property.rates > 0 && (
                  <View style={[styles.financialItem, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[styles.financialLabel, { color: colors.mutedForeground }]}>Rates</Text>
                    <Text style={[styles.financialValue, { color: colors.foreground }]}>{property.currency} {property.rates}/mo</Text>
                  </View>
                )}
                {property.levies !== undefined && property.levies > 0 && (
                  <View style={[styles.financialItem, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[styles.financialLabel, { color: colors.mutedForeground }]}>Levies</Text>
                    <Text style={[styles.financialValue, { color: colors.foreground }]}>{property.currency} {property.levies}/mo</Text>
                  </View>
                )}
              </View>
            </Section>
          )}

          {canManageApplications && (
            <Section title="RENTAL APPLICATIONS">
              <View style={[styles.applicationPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.applicationIntro}>
                  <View style={[styles.applicationIcon, { backgroundColor: colors.accent + '18' }]}>
                    <Ionicons name="shield-checkmark-outline" size={21} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.applicationHeading, { color: colors.foreground }]}>A private application link</Text>
                    <Text style={[styles.applicationSubcopy, { color: colors.mutedForeground }]}>
                      Share a secure form with renters. Applicant details stay inside your agent account.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.createInviteButton, { backgroundColor: colors.primary, opacity: createRentalInvite.isPending ? 0.72 : 1 }]}
                  onPress={handleCreateApplicationInvite}
                  disabled={createRentalInvite.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Create a secure rental application link"
                  testID="create-rental-application-invite"
                >
                  {createRentalInvite.isPending
                    ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                    : <Ionicons name="link-outline" size={18} color={colors.primaryForeground} />}
                  <Text style={[styles.createInviteText, { color: colors.primaryForeground }]}>
                    {createRentalInvite.isPending ? 'Creating secure link…' : 'Create application link'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.applicationsHeadingRow}>
                <View>
                  <Text style={[styles.applicationsTitle, { color: colors.foreground }]}>Submitted</Text>
                  <Text style={[styles.applicationsCaption, { color: colors.mutedForeground }]}>
                    {rentalApplicationsQuery.isLoading
                      ? 'Checking for applications'
                      : `${rentalApplications.length} ${rentalApplications.length === 1 ? 'application' : 'applications'}`}
                  </Text>
                </View>
                <View style={[styles.applicationCount, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.applicationCountText, { color: colors.primary }]}>
                    {rentalApplicationsQuery.isLoading ? '—' : rentalApplications.length}
                  </Text>
                </View>
              </View>

              {rentalApplicationsQuery.isLoading ? (
                <View style={[styles.applicationLoadingCard, { backgroundColor: colors.muted, borderColor: colors.border }]} accessibilityLabel="Loading applications">
                  <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '46%' }]} />
                  <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '72%' }]} />
                </View>
              ) : rentalApplicationsQuery.isError ? (
                <View style={[styles.applicationEmptyCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Ionicons name="cloud-offline-outline" size={22} color={colors.mutedForeground} />
                  <Text style={[styles.applicationEmptyTitle, { color: colors.foreground }]}>Applications could not load</Text>
                  <Text style={[styles.applicationEmptyCopy, { color: colors.mutedForeground }]}>
                    Your listing is unchanged. Check your connection and try again.
                  </Text>
                  <TouchableOpacity
                    style={[styles.retryApplicationsButton, { borderColor: colors.border }]}
                    onPress={() => rentalApplicationsQuery.refetch()}
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading applications"
                  >
                    <Text style={[styles.retryApplicationsText, { color: colors.primary }]}>Try again</Text>
                  </TouchableOpacity>
                </View>
              ) : rentalApplications.length === 0 ? (
                <View style={[styles.applicationEmptyCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <View style={[styles.emptyApplicationIcon, { backgroundColor: colors.secondary }]}>
                    <Ionicons name="document-text-outline" size={21} color={colors.primary} />
                  </View>
                  <Text style={[styles.applicationEmptyTitle, { color: colors.foreground }]}>No applications yet</Text>
                  <Text style={[styles.applicationEmptyCopy, { color: colors.mutedForeground }]}>
                    Create a link above and send it to interested renters. New submissions will appear here.
                  </Text>
                </View>
              ) : (
                <View style={styles.applicationList}>
                  {rentalApplications.map(application => {
                    const expanded = expandedApplicationId === application.id;
                    const submittedDate = new Date(application.submittedAt);
                    const submittedLabel = Number.isNaN(submittedDate.getTime())
                      ? 'Date unavailable'
                      : submittedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const moveInDate = new Date(application.moveInDate);
                    const moveInLabel = Number.isNaN(moveInDate.getTime())
                      ? application.moveInDate
                      : moveInDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    return (
                      <View key={application.id} style={[styles.applicationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.applicantRow}>
                          <View style={[styles.applicantInitial, { backgroundColor: colors.secondary }]}>
                            <Text style={[styles.applicantInitialText, { color: colors.primary }]}>
                              {application.applicantName.trim().charAt(0).toUpperCase() || 'A'}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.applicantName, { color: colors.foreground }]} numberOfLines={1}>
                              {application.applicantName}
                            </Text>
                            <Text style={[styles.applicationDate, { color: colors.mutedForeground }]}>Submitted {submittedLabel}</Text>
                          </View>
                          <View style={[styles.submittedBadge, { backgroundColor: colors.accent + '18' }]}>
                            <Text style={[styles.submittedBadgeText, { color: colors.accent }]}>New</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={[styles.viewApplicantButton, { borderTopColor: colors.border }]}
                          onPress={() => setExpandedApplicationId(expanded ? null : application.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`${expanded ? 'Hide' : 'View'} private details for ${application.applicantName}`}
                          accessibilityState={{ expanded }}
                        >
                          <Ionicons name={expanded ? 'lock-open-outline' : 'lock-closed-outline'} size={14} color={colors.primary} />
                          <Text style={[styles.viewApplicantText, { color: colors.primary }]}>
                            {expanded ? 'Hide private details' : 'View private details'}
                          </Text>
                          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={colors.mutedForeground} />
                        </TouchableOpacity>
                        {expanded && (
                          <View style={[styles.privateApplicantDetails, { borderTopColor: colors.border }]}>
                            <View style={styles.privateDataRow}>
                              <Text style={[styles.privateDataLabel, { color: colors.mutedForeground }]}>Email</Text>
                              <Text style={[styles.privateDataValue, { color: colors.foreground }]} selectable>{application.email}</Text>
                            </View>
                            <View style={styles.privateDataRow}>
                              <Text style={[styles.privateDataLabel, { color: colors.mutedForeground }]}>Phone</Text>
                              <Text style={[styles.privateDataValue, { color: colors.foreground }]} selectable>{application.phone}</Text>
                            </View>
                            <View style={styles.privateDataRow}>
                              <Text style={[styles.privateDataLabel, { color: colors.mutedForeground }]}>Move-in</Text>
                              <Text style={[styles.privateDataValue, { color: colors.foreground }]}>{moveInLabel}</Text>
                            </View>
                            <View style={styles.privateDataRow}>
                              <Text style={[styles.privateDataLabel, { color: colors.mutedForeground }]}>Household</Text>
                              <Text style={[styles.privateDataValue, { color: colors.foreground }]}>{application.occupants} occupants</Text>
                            </View>
                            <View style={styles.privateDataRow}>
                              <Text style={[styles.privateDataLabel, { color: colors.mutedForeground }]}>Work</Text>
                              <Text style={[styles.privateDataValue, { color: colors.foreground }]}>
                                {[application.jobTitle, application.employerName].filter(Boolean).join(' · ') || application.employmentStatus.replace(/_/g, ' ')}
                              </Text>
                            </View>
                            {application.monthlyIncome !== null && (
                              <View style={styles.privateDataRow}>
                                <Text style={[styles.privateDataLabel, { color: colors.mutedForeground }]}>Monthly income</Text>
                                <Text style={[styles.privateDataValue, { color: colors.foreground }]}>
                                  {application.incomeCurrency ?? ''} {application.monthlyIncome.toLocaleString()}
                                </Text>
                              </View>
                            )}
                            {!!application.applicantNote && (
                              <View style={[styles.applicantNote, { backgroundColor: colors.muted }]}>
                                <Text style={[styles.applicantNoteLabel, { color: colors.mutedForeground }]}>RENTER NOTE</Text>
                                <Text style={[styles.applicantNoteText, { color: colors.foreground }]}>{application.applicantNote}</Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </Section>
          )}

          {/* Seller/landlord contact details are only fetched for this agent's contacts. */}
          <Section title={`${property.listingType === 'rent' ? 'LANDLORD' : 'SELLER'} DETAILS — PRIVATE`}>
            <View style={[styles.sellerCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              {isContactLoading && !hasPrivateContactDetails ? (
                <Text style={[styles.sellerValue, { color: colors.mutedForeground }]}>Loading saved contact details…</Text>
              ) : hasPrivateContactDetails ? (
                <>
                  {!!contactName && (
                    <View style={styles.sellerRow}>
                      <Ionicons name="person-outline" size={15} color={colors.primary} />
                      <Text style={[styles.sellerValue, { color: colors.foreground }]}>{contactName}</Text>
                    </View>
                  )}
                  {!!contactPhone && (
                    <View style={styles.sellerRow}>
                      <Ionicons name="call-outline" size={15} color={colors.primary} />
                      <Text style={[styles.sellerValue, { color: colors.foreground }]}>{contactPhone}</Text>
                    </View>
                  )}
                  {!!contactEmail && (
                    <View style={styles.sellerRow}>
                      <Ionicons name="mail-outline" size={15} color={colors.primary} />
                      <Text style={[styles.sellerValue, { color: colors.foreground }]}>{contactEmail}</Text>
                    </View>
                  )}
                  {!!contactMandateExpiry && (
                    <View style={styles.sellerRow}>
                      <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                      <Text style={[styles.sellerValue, { color: colors.foreground }]}>
                        {contactMandateType === 'open' ? 'Open mandate' : 'Sole mandate'} • Expires {contactMandateExpiryDisplay}
                      </Text>
                    </View>
                  )}
                  {!!contactNotes && (
                    <View style={[styles.notesBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.notesText, { color: colors.foreground }]}>{contactNotes}</Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.sellerRow}>
                  <Ionicons
                    name={isContactError ? 'cloud-offline-outline' : 'information-circle-outline'}
                    size={15}
                    color={colors.mutedForeground}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sellerValue, { color: colors.mutedForeground }]}>
                      {isContactError
                        ? 'Saved contact details could not be loaded. Try again when online.'
                        : `No ${property.listingType === 'rent' ? 'landlord' : 'seller'} details saved for this listing.`}
                    </Text>
                    <TouchableOpacity onPress={() => router.push(`/edit-listing/${property.id}`)}>
                      <Text style={[styles.sellerValue, { color: colors.primary, marginTop: 6 }]}>Edit listing details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </Section>

          {/* Property type row */}
          <Section title="PROPERTY INFO">
            <View style={styles.infoGrid}>
              <View style={[styles.infoItem, { backgroundColor: colors.muted }]}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Type</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{property.type.charAt(0).toUpperCase() + property.type.slice(1)}</Text>
              </View>
              <View style={[styles.infoItem, { backgroundColor: colors.muted }]}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Currency</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{property.currency}</Text>
              </View>
              <View style={[styles.infoItem, { backgroundColor: colors.muted }]}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Reference</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{property.referenceNumber}</Text>
              </View>
              <View style={[styles.infoItem, { backgroundColor: colors.muted }]}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Listed</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{new Date(property.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</Text>
              </View>
            </View>
          </Section>
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={[styles.bottomBtn, { backgroundColor: colors.secondary }]}
          onPress={handleShare}
        >
          <Ionicons name="share-outline" size={18} color={colors.primary} />
          <Text style={[styles.bottomBtnText, { color: colors.primary }]}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: colors.secondary }]} onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setBrochureOpen(true);
        }}>
          <Ionicons name="document-text-outline" size={18} color={colors.primary} />
          <Text style={[styles.bottomBtnText, { color: colors.primary }]}>Brochure</Text>
        </TouchableOpacity>
        {property.status === 'published' && property.type === 'sale' && (
          <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: colors.destructive + '15' }]} onPress={handleRemoveListing}>
            <Ionicons name="archive-outline" size={18} color={colors.destructive} />
            <Text style={[styles.bottomBtnText, { color: colors.destructive }]}>Remove</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.bottomBtnPrimary, { backgroundColor: colors.primary }]} onPress={() => router.push(`/edit-listing/${property.id}`)}>
          <Ionicons name="create-outline" size={18} color="#FFF" />
          <Text style={styles.bottomBtnPrimaryText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={applicationInviteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setApplicationInviteVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.inviteModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.inviteModalIcon, { backgroundColor: colors.accent + '18' }]}>
              <Ionicons name="shield-checkmark-outline" size={25} color={colors.accent} />
            </View>
            <Text style={[styles.inviteModalTitle, { color: colors.foreground }]}>Application link ready</Text>
            <Text style={[styles.inviteModalCopy, { color: colors.mutedForeground }]}>
              This link opens a private application form for {property.referenceNumber}. Share it directly with prospective renters.
            </Text>
            {applicationInvite && (
              <>
                <View style={[styles.inviteUrlBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Text style={[styles.inviteUrl, { color: colors.foreground }]} selectable numberOfLines={2}>
                    {applicationInvite.applicationUrl}
                  </Text>
                </View>
                <Text style={[styles.inviteExpiry, { color: colors.mutedForeground }]}>
                  Expires {Number.isNaN(Date.parse(applicationInvite.expiresAt))
                    ? applicationInvite.expiresAt
                    : new Date(applicationInvite.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
                <View style={styles.inviteShareRow}>
                  <TouchableOpacity
                    style={[styles.inviteShareButton, { backgroundColor: colors.primary }]}
                    onPress={() => shareApplicationInvite('whatsapp')}
                    accessibilityRole="button"
                    accessibilityLabel="Share application link with WhatsApp"
                    testID="share-application-whatsapp"
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primaryForeground} />
                    <Text style={[styles.inviteShareButtonText, { color: colors.primaryForeground }]}>WhatsApp</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.inviteShareButton, { backgroundColor: colors.secondary }]}
                    onPress={() => shareApplicationInvite('email')}
                    accessibilityRole="button"
                    accessibilityLabel="Share application link by email"
                    testID="share-application-email"
                  >
                    <Ionicons name="mail-outline" size={18} color={colors.primary} />
                    <Text style={[styles.inviteShareButtonText, { color: colors.primary }]}>Email</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.copyInviteButton, { borderColor: colors.border }]}
                  onPress={copyApplicationInvite}
                  accessibilityRole="button"
                  accessibilityLabel={inviteCopied ? 'Application link copied' : 'Copy application link'}
                  testID="copy-rental-application-link"
                >
                  <Ionicons name={inviteCopied ? 'checkmark-circle-outline' : 'copy-outline'} size={17} color={inviteCopied ? colors.accent : colors.primary} />
                  <Text style={[styles.copyInviteText, { color: inviteCopied ? colors.accent : colors.primary }]}>
                    {inviteCopied ? 'Link copied' : 'Copy secure link'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={styles.inviteDoneButton}
              onPress={() => setApplicationInviteVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close application link"
            >
              <Text style={[styles.inviteDoneText, { color: colors.mutedForeground }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={saleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSaleModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.saleModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <KeyboardAwareScrollViewCompat style={{ width: '100%' }} contentContainerStyle={{ gap: 12 }} bottomOffset={24}>
            {saleConfirmation ? (
              <>
                <Text style={[styles.saleModalTitle, { color: colors.foreground }]}>Conveyancer confirmation pending</Text>
                <Text style={[styles.saleModalCopy, { color: colors.mutedForeground }]}>
                  The sale is recorded, but it will appear on your public agent profile only after {saleConfirmation.conveyancerName} confirms it.
                </Text>
                {saleConfirmation.conveyancerEmail ? (
                  <TouchableOpacity
                    style={[styles.saleModalButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    onPress={() => {
                      const subject = `Please confirm completed sale — ${property.referenceNumber}`;
                      const body = `Hello ${saleConfirmation.conveyancerName},\n\nPlease confirm the completed sale of ${property.title} (${property.referenceNumber}) for ${property.currency} ${salePriceInput}.\n\nConfirm securely here: ${saleConfirmation.confirmationUrl}\n\nThank you.`;
                      void Linking.openURL(`mailto:${encodeURIComponent(saleConfirmation.conveyancerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Open email draft with sale confirmation link"
                    testID="share-sale-confirmation-email"
                  >
                    <Text style={[styles.saleModalButtonText, { color: '#FFF' }]}>Open email draft</Text>
                  </TouchableOpacity>
                ) : null}
                {saleConfirmation.conveyancerPhone ? (
                  <TouchableOpacity
                    style={[styles.saleModalButton, { borderColor: colors.border }]}
                    onPress={() => {
                      const phone = saleConfirmation.conveyancerPhone.replace(/\D/g, '');
                      const text = `Hello ${saleConfirmation.conveyancerName}, please confirm the completed sale of ${property.title} (${property.referenceNumber}) using this secure link: ${saleConfirmation.confirmationUrl}`;
                      void Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Open WhatsApp with sale confirmation link"
                    testID="share-sale-confirmation-whatsapp"
                  >
                    <Text style={[styles.saleModalButtonText, { color: colors.foreground }]}>Open WhatsApp</Text>
                  </TouchableOpacity>
                ) : null}
                <Text selectable style={[styles.saleModalCopy, { color: colors.mutedForeground }]}>{saleConfirmation.confirmationUrl}</Text>
                <TouchableOpacity style={styles.saleDoneButton} onPress={() => { setSaleModalVisible(false); router.back(); }}>
                  <Text style={[styles.saleModalButtonText, { color: colors.mutedForeground }]}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.saleModalTitle, { color: colors.foreground }]}>Record completed sale</Text>
                <Text style={[styles.saleModalCopy, { color: colors.mutedForeground }]}>
                  The original asking price remains {property.currency} {property.price.toLocaleString()}. A conveyancer must confirm the sale before it appears on your profile.
                </Text>
                <Text style={[styles.saleModalLabel, { color: colors.mutedForeground }]}>FINAL SALE PRICE ({property.currency})</Text>
                <TextInput
                  autoFocus
                  value={salePriceInput}
                  onChangeText={setSalePriceInput}
                  keyboardType="numeric"
                  placeholder="Enter sale price"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.salePriceInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                  accessibilityLabel="Final sale price"
                />
                <Text style={[styles.saleModalLabel, { color: colors.mutedForeground }]}>CONVEYANCER NAME</Text>
                <TextInput value={conveyancerNameInput} onChangeText={setConveyancerNameInput} placeholder="Name of conveyancer" placeholderTextColor={colors.mutedForeground} style={[styles.salePriceInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]} accessibilityLabel="Conveyancer name" />
                <Text style={[styles.saleModalLabel, { color: colors.mutedForeground }]}>CONVEYANCER EMAIL</Text>
                <TextInput value={conveyancerEmailInput} onChangeText={setConveyancerEmailInput} keyboardType="email-address" autoCapitalize="none" placeholder="name@example.com" placeholderTextColor={colors.mutedForeground} style={[styles.salePriceInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]} accessibilityLabel="Conveyancer email" />
                <Text style={[styles.saleModalLabel, { color: colors.mutedForeground }]}>WHATSAPP NUMBER</Text>
                <TextInput value={conveyancerPhoneInput} onChangeText={setConveyancerPhoneInput} keyboardType="phone-pad" placeholder="+263…" placeholderTextColor={colors.mutedForeground} style={[styles.salePriceInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]} accessibilityLabel="Conveyancer WhatsApp number" />
                <Text style={[styles.saleModalCopy, { color: colors.mutedForeground }]}>Enter at least an email address or WhatsApp number. QuickProp opens a draft for you to send.</Text>
                <View style={styles.saleModalActions}>
                  <TouchableOpacity style={[styles.saleModalButton, { borderColor: colors.border }]} onPress={() => setSaleModalVisible(false)}>
                    <Text style={[styles.saleModalButtonText, { color: colors.foreground }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saleModalButton, { backgroundColor: colors.primary, borderColor: colors.primary, opacity: saleSubmitting ? 0.7 : 1 }]} onPress={handleConfirmSale} disabled={saleSubmitting} testID="record-sale">
                    {saleSubmitting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={[styles.saleModalButtonText, { color: '#FFF' }]}>Record Sale</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
            </KeyboardAwareScrollViewCompat>
          </View>
        </View>
      </Modal>

      <PropertyBrochureSheet
        visible={brochureOpen}
        onClose={() => setBrochureOpen(false)}
        property={property}
      />
      <PropertyShareSheet
        visible={shareOptionsOpen}
        onClose={() => setShareOptionsOpen(false)}
        property={property}
        flyerLoading={flyer.loading}
        onCustomizeFlyer={() => setFlyerOpen(true)}
        captureCard={() => shareCardRef.current?.capture()
          ?? Promise.reject(new Error('Unable to prepare the property image.'))}
        captureSocialCard={() => shareCardRef.current?.capture()
          ?? Promise.reject(new Error('Unable to prepare the property flyer.'))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  topRef: { flex: 1, fontSize: 13, fontWeight: '600' },
  topActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  content: { paddingBottom: 40 },
  gallery: { height: 240, alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  galleryScroll: { paddingHorizontal: 12, paddingVertical: 12, gap: 10, alignItems: 'center', flexDirection: 'row' },
  photoThumb: { width: 200, height: 216, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  photoDelete: { position: 'absolute', top: 6, right: 6, backgroundColor: '#00000066', borderRadius: 12 },
  addPhotoTile: { width: 80, height: 80, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  addPhotoLabel: { fontSize: 11, fontWeight: '700' },
  photoCountBadge: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  photoCountText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  galleryHint: { fontSize: 14 },
  fallbackImage: { width: '100%', height: '100%' },
  fallbackVeil: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingTop: 20, gap: 0 },
  multiAgentSummary: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  multiAgentTitle: { fontSize: 14, fontWeight: '800' },
  agencyButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9 },
  agencyButtonText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  offerRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingVertical: 12, gap: 12 },
  offerAgency: { fontSize: 14, fontWeight: '700' },
  offerPrice: { fontSize: 14, fontWeight: '800' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  price: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  negBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  negText: { fontSize: 12, fontWeight: '700' },
  address: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  suburbRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  suburb: { fontSize: 14 },
  visibilityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  visibilityText: { fontSize: 11, fontWeight: '600' },
  mapWrap: { borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  mapButton: { overflow: 'hidden' },
  mapButtonInner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  mapIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  mapTextWrap: { flex: 1 },
  mapButtonTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  mapBadgeText: { fontSize: 12, fontWeight: '500' },
  statsRow: { flexDirection: 'row', borderRadius: 14, padding: 14, gap: 16, borderWidth: 1, marginBottom: 20, flexWrap: 'wrap' },
  statItem: { alignItems: 'center', gap: 4, minWidth: 50 },
  statValue: { fontSize: 17, fontWeight: '800' },
  statLabel: { fontSize: 11 },
  description: { fontSize: 15, lineHeight: 24 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  featureText: { fontSize: 13, fontWeight: '500' },
  financialRow: { flexDirection: 'row', gap: 10 },
  financialItem: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, gap: 4 },
  financialLabel: { fontSize: 11, fontWeight: '600' },
  financialValue: { fontSize: 15, fontWeight: '700' },
  sellerCard: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 10 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sellerValue: { fontSize: 14, fontWeight: '500', flex: 1 },
  notesBox: { marginTop: 4, padding: 10, borderRadius: 10, borderWidth: 1 },
  notesText: { fontSize: 13, lineHeight: 20 },
  applicationPanel: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 20, gap: 14 },
  applicationIntro: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  applicationIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  applicationHeading: { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  applicationSubcopy: { fontSize: 12, lineHeight: 17 },
  createInviteButton: { minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  createInviteText: { fontSize: 13, fontWeight: '800' },
  applicationsHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  applicationsTitle: { fontSize: 16, fontWeight: '800' },
  applicationsCaption: { fontSize: 12, marginTop: 3 },
  applicationCount: { minWidth: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  applicationCountText: { fontSize: 13, fontWeight: '800' },
  applicationLoadingCard: { padding: 15, gap: 12, borderRadius: 14, borderWidth: 1 },
  skeletonLine: { height: 10, borderRadius: 5, opacity: 0.72 },
  applicationEmptyCard: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 20, borderRadius: 15, borderWidth: 1, gap: 7 },
  emptyApplicationIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  applicationEmptyTitle: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  applicationEmptyCopy: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retryApplicationsButton: { marginTop: 5, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderRadius: 10 },
  retryApplicationsText: { fontSize: 12, fontWeight: '800' },
  applicationList: { gap: 10 },
  applicationCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  applicantRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  applicantInitial: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  applicantInitialText: { fontSize: 16, fontWeight: '800' },
  applicantName: { fontSize: 14, fontWeight: '800' },
  applicationDate: { fontSize: 11, marginTop: 3 },
  submittedBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  submittedBadgeText: { fontSize: 10, fontWeight: '800' },
  viewApplicantButton: { minHeight: 42, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14 },
  viewApplicantText: { flex: 1, fontSize: 12, fontWeight: '700' },
  privateApplicantDetails: { borderTopWidth: 1, padding: 14, gap: 10 },
  privateDataRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  privateDataLabel: { width: 92, fontSize: 11, fontWeight: '600', paddingTop: 1 },
  privateDataValue: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  applicantNote: { padding: 11, borderRadius: 10, gap: 5, marginTop: 2 },
  applicantNoteLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  applicantNoteText: { fontSize: 12, lineHeight: 18 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoItem: { flex: 1, minWidth: '45%', borderRadius: 12, padding: 12, gap: 4 },
  infoLabel: { fontSize: 11, fontWeight: '600' },
  infoValue: { fontSize: 14, fontWeight: '700' },
  videoPlayOverlay: { position: 'absolute' },
  shareCardHost: { position: 'absolute', left: -1000, top: 0, width: 360, height: 450 },
  shareCollageHost: { position: 'absolute', left: 0, top: 450, width: 360, height: 360 },
  bottomBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  bottomBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, paddingVertical: 11 },
  bottomBtnText: { fontSize: 13, fontWeight: '600' },
  bottomBtnPrimary: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, paddingVertical: 11 },
  bottomBtnPrimaryText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center', padding: 24 },
  inviteModal: { width: '100%', maxWidth: 440, borderRadius: 22, borderWidth: 1, padding: 21, gap: 12 },
  inviteModalIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  inviteModalTitle: { fontSize: 21, fontWeight: '900', letterSpacing: -0.3 },
  inviteModalCopy: { fontSize: 13, lineHeight: 19 },
  inviteUrlBox: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginTop: 2 },
  inviteUrl: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  inviteExpiry: { fontSize: 11, marginTop: -5 },
  inviteShareRow: { flexDirection: 'row', gap: 9, marginTop: 4 },
  inviteShareButton: { flex: 1, minHeight: 46, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  inviteShareButtonText: { fontSize: 12, fontWeight: '800' },
  copyInviteButton: { minHeight: 43, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  copyInviteText: { fontSize: 12, fontWeight: '800' },
  inviteDoneButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  inviteDoneText: { fontSize: 13, fontWeight: '700' },
  saleModal: { width: '100%', maxWidth: 440, maxHeight: '90%', borderRadius: 20, borderWidth: 1, padding: 20 },
  saleModalTitle: { fontSize: 20, fontWeight: '800' },
  saleModalCopy: { fontSize: 14, lineHeight: 21 },
  saleModalLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 4 },
  salePriceInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 },
  saleModalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  saleModalButton: { flex: 1, borderWidth: 1, borderRadius: 12, alignItems: 'center', paddingVertical: 12 },
  saleModalButtonText: { fontSize: 14, fontWeight: '700' },
  saleDoneButton: { alignItems: 'center', justifyContent: 'center', minHeight: 40 },
});
