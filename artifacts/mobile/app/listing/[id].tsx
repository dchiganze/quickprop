import React, { useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert, Share, Linking, Image, Modal, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { PropertyBrochureSheet } from '@/components/BrochureSheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { catalogueShareLinks, propertyShareLinks } from '@/utils/shareLinks';
import {
  sharePropertyToWhatsApp,
} from '@/utils/whatsapp';
import { getPrimaryListingPhoto } from '@/utils/listingPhoto';
import { SharePropertyCard, SharePropertyCardHandle } from '@/components/SharePropertyCard';
import { useData } from '@/contexts/DataContext';
import { Property } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getGetMultiAgentPropertyQueryKey, useGetMultiAgentProperty } from '@workspace/api-client-react';
import { addMyAgencyToProperty } from '@/utils/multiAgent';

function VideoPlayerModal({ uri, onClose }: { uri: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, p => { p.loop = false; p.play(); });
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <VideoView player={player} style={{ flex: 1 }} allowsFullscreen allowsPictureInPicture nativeControls />
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
  const { properties, updateProperty } = useData();
  const property = properties.find(p => p.id === id);
  const { user } = useAuth();
  const remotePropertyId = Number(id);
  const { data: multiAgent } = useGetMultiAgentProperty(remotePropertyId, {
    query: {
      enabled: Number.isInteger(remotePropertyId) && remotePropertyId > 0,
      queryKey: getGetMultiAgentPropertyQueryKey(remotePropertyId),
    },
  });
  const [brochureOpen, setBrochureOpen] = useState(false);
  const [videoPlayerVisible, setVideoPlayerVisible] = useState(false);
  const [sharingToWhatsApp, setSharingToWhatsApp] = useState(false);
  const shareCardRef = useRef<SharePropertyCardHandle>(null);

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

  const buildShareMessage = () => {
    const typeLabel = property.type.charAt(0).toUpperCase() + property.type.slice(1);
    const priceLabel = property.price >= 1_000_000
      ? `${property.currency} ${(property.price / 1_000_000).toFixed(2)}M`
      : `${property.currency} ${property.price.toLocaleString()}`;
    const priceStr = property.type === 'rent' ? `${priceLabel}/mo` : priceLabel;

    const lines: string[] = [];
    lines.push(`🏠 *${typeLabel} — ${property.suburb}*`);
    if (property.showAddress && property.address) {
      lines.push(`📍 ${property.address}, ${property.suburb}`);
    } else {
      lines.push(`📍 ${property.suburb}`);
    }
    lines.push('');
    lines.push(`💰 *${priceStr}*${property.negotiable ? ' _(Negotiable)_' : ''}`);
    lines.push('');

    const statsLine: string[] = [];
    if (property.bedrooms !== undefined) statsLine.push(`🛏 ${property.bedrooms} bed`);
    if (property.bathrooms !== undefined) statsLine.push(`🚿 ${property.bathrooms} bath`);
    if (property.garages !== undefined && property.garages > 0) statsLine.push(`🚗 ${property.garages} garage`);
    if (statsLine.length > 0) lines.push(statsLine.join('  |  '));

    const sizeLines: string[] = [];
    if (property.landSize && property.landSize > 0) sizeLines.push(`Land: ${property.landSize.toLocaleString()}m²`);
    if (property.floorArea && property.floorArea > 0) sizeLines.push(`Floor: ${property.floorArea.toLocaleString()}m²`);
    if (sizeLines.length > 0) lines.push(`📐 ${sizeLines.join('  |  ')}`);

    if (property.features.length > 0) {
      lines.push('');
      lines.push(`✅ *Features:* ${property.features.join(', ')}`);
    }

    if (property.description) {
      lines.push('');
      const desc = property.description.length > 200
        ? property.description.slice(0, 197) + '…'
        : property.description;
      lines.push(`📝 ${desc}`);
    }

    const financials: string[] = [];
    if (property.rates && property.rates > 0) financials.push(`Rates: ${property.currency} ${property.rates}/mo`);
    if (property.levies && property.levies > 0) financials.push(`Levies: ${property.currency} ${property.levies}/mo`);
    if (financials.length > 0) {
      lines.push('');
      lines.push(`💵 ${financials.join('  |  ')}`);
    }

    if (property.photos.length > 0) {
      lines.push('');
      lines.push(`📸 ${property.photos.length} photo${property.photos.length > 1 ? 's' : ''} available`);
    }

    lines.push('');
    lines.push(`📋 Ref: *${property.referenceNumber}*`);
    lines.push('Listed on QuickProp');
    const links = propertyShareLinks(property);
    lines.push('');
    lines.push(`Open in QuickProp Agent: ${links.appUrl}`);
    lines.push(`View online: ${links.webUrl}`);
    return lines.join('\n');
  };

  const handleShare = async () => {
    if (sharingToWhatsApp) return;
    setSharingToWhatsApp(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await sharePropertyToWhatsApp(
        property,
        user?.id ?? property.agentId,
        () => shareCardRef.current?.capture()
          ?? Promise.reject(new Error('Unable to prepare the property image.')),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (!message.includes('cancel') && !message.includes('dismiss')) {
        Alert.alert('Could not share property', 'Unable to prepare the property. Please try again.');
      }
    } finally {
      setSharingToWhatsApp(false);
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

  const handleMarkSold = () => {
    Alert.alert('Mark as Sold', 'Are you sure you want to mark this property as sold?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Sold', style: 'destructive',
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          updateProperty(property.id, { status: 'sold' });
          router.back();
        },
      },
    ]);
  };

  const price = property.price >= 1000000
    ? `${property.currency} ${(property.price / 1000000).toFixed(2)}M`
    : `${property.currency} ${property.price.toLocaleString()}`;
  const priceDisplay = property.type === 'rent' ? `${price}/mo` : price;
  const primaryPhoto = getPrimaryListingPhoto(property);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.shareCardHost} pointerEvents="none">
        <SharePropertyCard
          ref={shareCardRef}
          property={property}
          catalogueUrl={catalogueShareLinks(user?.id ?? property.agentId).webUrl}
        />
      </View>
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
            style={[styles.iconBtn, { backgroundColor: '#25D366', borderColor: '#25D366' }]}
            onPress={handleShare}
            disabled={sharingToWhatsApp}
          >
            {sharingToWhatsApp
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Ionicons name="logo-whatsapp" size={20} color="#FFF" />}
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
                  <Image source={{ uri: primaryPhoto }} style={styles.photoImg} resizeMode="cover" />
                </View>
              )}
              {property.photos.map((uri, index) => (
                <View key={index} style={styles.photoThumb}>
                  <Image source={{ uri }} style={styles.photoImg} resizeMode="cover" />
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

          {/* Seller Notes (private) */}
          <Section title="SELLER DETAILS — PRIVATE">
            <View style={[styles.sellerCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <View style={styles.sellerRow}>
                <Ionicons name="person-outline" size={15} color={colors.primary} />
                <Text style={[styles.sellerValue, { color: colors.foreground }]}>{property.seller.name}</Text>
              </View>
              <View style={styles.sellerRow}>
                <Ionicons name="call-outline" size={15} color={colors.primary} />
                <Text style={[styles.sellerValue, { color: colors.foreground }]}>{property.seller.phone}</Text>
              </View>
              <View style={styles.sellerRow}>
                <Ionicons name="mail-outline" size={15} color={colors.primary} />
                <Text style={[styles.sellerValue, { color: colors.foreground }]}>{property.seller.email}</Text>
              </View>
              <View style={styles.sellerRow}>
                <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                <Text style={[styles.sellerValue, { color: colors.foreground }]}>
                  {property.seller.mandateType.charAt(0).toUpperCase() + property.seller.mandateType.slice(1)} mandate • Expires {new Date(property.seller.mandateExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              {!!property.seller.notes && (
                <View style={[styles.notesBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.notesText, { color: colors.foreground }]}>{property.seller.notes}</Text>
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
          style={[styles.bottomBtn, { backgroundColor: '#25D366' }]}
          onPress={handleShare}
          disabled={sharingToWhatsApp}
        >
          {sharingToWhatsApp
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Ionicons name="logo-whatsapp" size={18} color="#FFF" />}
          <Text style={[styles.bottomBtnText, { color: '#FFF' }]}>
            {sharingToWhatsApp ? 'Preparing…' : 'WhatsApp'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: colors.secondary }]} onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setBrochureOpen(true);
        }}>
          <Ionicons name="document-text-outline" size={18} color={colors.primary} />
          <Text style={[styles.bottomBtnText, { color: colors.primary }]}>Brochure</Text>
        </TouchableOpacity>
        {property.status === 'published' && (
          <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: colors.destructive + '15' }]} onPress={handleMarkSold}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.destructive} />
            <Text style={[styles.bottomBtnText, { color: colors.destructive }]}>Sold</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.bottomBtnPrimary, { backgroundColor: colors.primary }]} onPress={() => router.push(`/edit-listing/${property.id}`)}>
          <Ionicons name="create-outline" size={18} color="#FFF" />
          <Text style={styles.bottomBtnPrimaryText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <PropertyBrochureSheet
        visible={brochureOpen}
        onClose={() => setBrochureOpen(false)}
        property={property}
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
  fallbackVeil: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8 },
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
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoItem: { flex: 1, minWidth: '45%', borderRadius: 12, padding: 12, gap: 4 },
  infoLabel: { fontSize: 11, fontWeight: '600' },
  infoValue: { fontSize: 14, fontWeight: '700' },
  videoPlayOverlay: { position: 'absolute' },
  shareCardHost: { position: 'absolute', left: -1000, top: 0, width: 360, height: 450 },
  bottomBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  bottomBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, paddingVertical: 11 },
  bottomBtnText: { fontSize: 13, fontWeight: '600' },
  bottomBtnPrimary: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, paddingVertical: 11 },
  bottomBtnPrimaryText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});
