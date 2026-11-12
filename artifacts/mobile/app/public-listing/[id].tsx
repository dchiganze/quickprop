import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGetPublicPropertyQueryKey, useGetPublicProperty } from '@workspace/api-client-react';
import { ListingImage } from '@/components/ListingImage';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { offlineListingsCacheKey, parseOfflineListingsCache } from '@/lib/offline-listings-cache';
import type { Property as MobileProperty } from '@/types';

const screenWidth = Dimensions.get('window').width;

function formatPrice(price: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(price)}`;
}

export default function PublicListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const propertyId = Array.isArray(id) ? id[0] : id;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const listingQuery = useGetPublicProperty(propertyId ?? '', {
    query: {
      enabled: Boolean(propertyId),
      queryKey: getGetPublicPropertyQueryKey(propertyId ?? ''),
    },
  });
  const [cachedPropertyRecord, setCachedPropertyRecord] = useState<{
    userId: string;
    property: MobileProperty;
  } | null>(null);
  const [offlineCacheChecked, setOfflineCacheChecked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const accountId = user?.id;
    setOfflineCacheChecked(false);
    setCachedPropertyRecord(null);
    if (!accountId || !propertyId) {
      setOfflineCacheChecked(true);
      return () => { cancelled = true; };
    }
    AsyncStorage.getItem(offlineListingsCacheKey(accountId))
      .then((serialized) => {
        if (cancelled) return;
        const cache = parseOfflineListingsCache(serialized, accountId);
        const saved = cache?.properties.find((item) => item.id === propertyId);
        setCachedPropertyRecord(saved ? { userId: accountId, property: saved } : null);
        setOfflineCacheChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setOfflineCacheChecked(true);
      });
    return () => { cancelled = true; };
  }, [propertyId, user?.id]);
  const cachedProperty = cachedPropertyRecord && cachedPropertyRecord.userId === user?.id
    ? cachedPropertyRecord.property
    : undefined;
  const property = listingQuery.data?.property ?? (cachedProperty ? {
    photos: cachedProperty.photos,
    coverImage: cachedProperty.photos[0] ?? null,
    priceOnApplication: cachedProperty.priceOnApplication ?? false,
    price: cachedProperty.price,
    currency: cachedProperty.currency,
    title: cachedProperty.title ?? '',
    suburb: cachedProperty.suburb,
    city: cachedProperty.city ?? '',
    bedrooms: cachedProperty.bedrooms ?? null,
    bathrooms: cachedProperty.bathrooms ?? null,
    parking: cachedProperty.garages ?? null,
    description: cachedProperty.description,
    features: cachedProperty.features,
  } : undefined);
  const photos = property?.photos.length
    ? property.photos
    : property?.coverImage ? [property.coverImage] : [];

  if ((listingQuery.isLoading || !offlineCacheChecked) && !property) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={[styles.center, styles.errorState, { backgroundColor: colors.background }]}>
        <Ionicons name="home-outline" size={42} color={colors.mutedForeground} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>
          {listingQuery.isError ? 'Listing unavailable' : 'Listing not found'}
        </Text>
        <Text style={[styles.errorDescription, { color: colors.mutedForeground }]}>
          This public listing may no longer be available.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backToListings, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.backToListingsText}>Back to listings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stats = [
    { icon: 'bed-outline' as const, value: property.bedrooms, label: 'Bedrooms' },
    { icon: 'water-outline' as const, value: property.bathrooms, label: 'Bathrooms' },
    { icon: 'car-outline' as const, value: property.parking, label: 'Parking' },
  ].filter((stat) => stat.value != null);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.background }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.muted }]}
          accessibilityRole="button"
          accessibilityLabel="Back to listings"
        >
          <Ionicons name="chevron-back" size={23} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {cachedProperty?.status === 'draft' ? 'Agency listing' : 'Public listing'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
        {photos.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.photoGallery}
          >
            {photos.map((uri, index) => (
              <ListingImage
                key={`${uri}-${index}`}
                uri={uri}
                resizeMode="cover"
                style={[styles.photo, { backgroundColor: colors.muted }]}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.photoPlaceholder, { backgroundColor: colors.muted }]}>
            <Ionicons name="home-outline" size={42} color={colors.mutedForeground} />
            <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>No photos available</Text>
          </View>
        )}

        <View style={styles.details}>
          <Text style={[styles.price, { color: colors.primary }]}>
            {property.priceOnApplication ? 'POA' : formatPrice(property.price, property.currency)}
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{property.title}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={17} color={colors.mutedForeground} />
            <Text style={[styles.location, { color: colors.mutedForeground }]}>
              {[property.suburb, property.city].filter(Boolean).join(', ')}
            </Text>
          </View>

          {stats.length > 0 && (
            <View style={[styles.stats, { borderColor: colors.border }]}>
              {stats.map((stat) => (
                <View key={stat.label} style={styles.stat}>
                  <Ionicons name={stat.icon} size={18} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
                </View>
              ))}
            </View>
          )}

          {property.description ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About this property</Text>
              <Text style={[styles.description, { color: colors.mutedForeground }]}>{property.description}</Text>
            </View>
          ) : null}

          {property.features.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Features</Text>
              <View style={styles.features}>
                {property.features.map((feature) => (
                  <View key={feature} style={[styles.feature, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.featureText, { color: colors.foreground }]}>{feature}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {listingQuery.data?.agent && (
            <View style={[styles.agentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.agentAvatar, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name="person-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.agentDetails}>
                <Text style={[styles.agentName, { color: colors.foreground }]}>{listingQuery.data.agent.name}</Text>
                {listingQuery.data.agent.agencyName ? (
                  <Text style={[styles.agentAgency, { color: colors.mutedForeground }]}>
                    {listingQuery.data.agent.agencyName}
                  </Text>
                ) : null}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorState: { paddingHorizontal: 32, gap: 10 },
  errorTitle: { fontSize: 19, fontWeight: '700', marginTop: 6 },
  errorDescription: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  backToListings: { marginTop: 10, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12 },
  backToListingsText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSpacer: { width: 38 },
  content: { paddingBottom: 28 },
  photoGallery: { height: 280 },
  photo: { width: screenWidth, height: 280 },
  photoPlaceholder: { height: 220, alignItems: 'center', justifyContent: 'center', gap: 8 },
  placeholderText: { fontSize: 13, fontWeight: '500' },
  details: { padding: 18 },
  price: { fontSize: 23, fontWeight: '800', marginBottom: 6 },
  title: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 },
  location: { fontSize: 14 },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, marginTop: 18, paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 15, fontWeight: '700' },
  statLabel: { fontSize: 11 },
  section: { marginTop: 20, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  description: { fontSize: 14, lineHeight: 21 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  feature: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16 },
  featureText: { fontSize: 12, fontWeight: '500' },
  agentCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderRadius: 14, marginTop: 24, gap: 12 },
  agentAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  agentDetails: { flex: 1, gap: 3 },
  agentName: { fontSize: 14, fontWeight: '700' },
  agentAgency: { fontSize: 12 },
});
