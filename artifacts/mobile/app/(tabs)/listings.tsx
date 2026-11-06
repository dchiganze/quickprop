import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet, Platform, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  getGetAgencyPropertiesQueryKey,
  listPublicProperties,
  useGetAgencyProperties,
  type PublicProperty,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { PropertyCard } from '@/components/PropertyCard';
import { SearchBar } from '@/components/SearchBar';
import { EmptyState } from '@/components/EmptyState';
import { QuickShareSheet } from '@/components/QuickShareSheet';
import { AlertsSheet } from '@/components/AlertsSheet';
import type { Property } from '@/types';

type ListingScope = 'all' | 'my' | 'agency';
type MyStatusFilter = 'all' | 'draft' | 'sold' | 'rented' | 'archived';

const SCOPE_FILTERS: { key: ListingScope; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'my', label: 'My Listings' },
  { key: 'agency', label: 'Agency Listings' },
];

const MY_STATUS_FILTERS: { key: Exclude<MyStatusFilter, 'all'>; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'sold', label: 'Sold' },
  { key: 'rented', label: 'Rented' },
  { key: 'archived', label: 'Archived' },
];

function mapPublicProperty(property: PublicProperty): Property {
  const normalizedType = property.propertyType.toLowerCase();
  const type = ['commercial', 'stand', 'farm', 'mine'].includes(normalizedType)
    ? normalizedType as Property['type']
    : property.listingType.toLowerCase() === 'rent' ? 'rent' : 'sale';
  const photos = property.photos.length > 0
    ? property.photos
    : property.coverImage ? [property.coverImage] : [];

  return {
    id: String(property.id),
    referenceNumber: property.reference,
    title: property.title,
    type,
    propertyType: property.propertyType,
    listingType: property.listingType === 'rent' ? 'rent' : 'sale',
    status: 'published',
    address: property.address ?? property.suburb,
    showAddress: Boolean(property.address),
    hasTitleDeed: property.hasTitleDeed,
    suburb: property.suburb,
    city: property.city,
    price: property.price,
    salePrice: property.salePrice ?? undefined,
    soldAt: property.soldAt,
    currency: property.currency,
    negotiable: false,
    bedrooms: property.bedrooms ?? undefined,
    bathrooms: property.bathrooms ?? undefined,
    garages: property.parking ?? undefined,
    landSize: property.landSize ?? undefined,
    floorArea: property.buildingSize ?? undefined,
    features: property.features,
    description: property.description ?? '',
    photos,
    proposedViewingTimes: property.proposedViewingTimes,
    seller: {
      name: '',
      phone: '',
      email: '',
      mandateExpiry: '',
      mandateType: 'open',
      notes: '',
    },
    agentId: property.agentId == null ? '' : String(property.agentId),
    createdAt: property.publishedAt ?? property.createdAt,
    updatedAt: property.publishedAt ?? property.createdAt,
    freshnessStatus: property.freshnessStatus as Property['freshnessStatus'],
    availabilityStatus: property.availabilityStatus as Property['availabilityStatus'],
    lastConfirmedAt: property.lastAvailabilityVerification,
    freshnessScore: property.freshnessScore,
    qualityScore: property.qualityScore,
  };
}

/** Comprehensive search across every meaningful property field */
function propertyMatchesQuery(p: {
  address: string; suburb: string; referenceNumber: string; type: string;
  status: string; currency: string; description: string; price: number;
  bedrooms?: number; bathrooms?: number; garages?: number;
  features: string[]; seller: { name: string; mandateType: string };
}, q: string): boolean {
  const lower = q.toLowerCase().trim();

  // Numeric-keyword shortcuts: "3 bed", "3bed", "3bedroom"
  const bedMatch = lower.match(/^(\d+)\s*bed/);
  if (bedMatch) return (p.bedrooms ?? 0) === parseInt(bedMatch[1]);

  const bathMatch = lower.match(/^(\d+)\s*bath/);
  if (bathMatch) return (p.bathrooms ?? 0) === parseInt(bathMatch[1]);

  const garageMatch = lower.match(/^(\d+)\s*gar/);
  if (garageMatch) return (p.garages ?? 0) === parseInt(garageMatch[1]);

  // "for sale" / "for rent" shorthand
  if (lower === 'for sale') return p.type === 'sale';
  if (lower === 'for rent' || lower === 'to rent') return p.type === 'rent';

  // Plain digits: match bedrooms, bathrooms, garages, or price digits
  if (/^\d+$/.test(lower)) {
    return (
      String(p.bedrooms ?? '') === lower ||
      String(p.bathrooms ?? '') === lower ||
      String(p.garages ?? '') === lower ||
      String(p.price).includes(lower) ||
      p.referenceNumber.toLowerCase().includes(lower)
    );
  }

  // Full text search across all fields
  return (
    p.address.toLowerCase().includes(lower) ||
    p.suburb.toLowerCase().includes(lower) ||
    p.referenceNumber.toLowerCase().includes(lower) ||
    p.seller.name.toLowerCase().includes(lower) ||
    p.type.toLowerCase().includes(lower) ||
    p.status.toLowerCase().includes(lower) ||
    p.currency.toLowerCase().includes(lower) ||
    p.description.toLowerCase().includes(lower) ||
    p.seller.mandateType.toLowerCase().includes(lower) ||
    String(p.price).includes(lower) ||
    p.features.some(f => f.toLowerCase().includes(lower)) ||
    // e.g. "solar", "borehole", "pool"
    // bedrooms as "3 bed" phrasing within text
    (p.bedrooms !== undefined && `${p.bedrooms} bed`.includes(lower)) ||
    (p.bathrooms !== undefined && `${p.bathrooms} bath`.includes(lower)) ||
    (p.garages !== undefined && `${p.garages} garage`.includes(lower))
  );
}

export default function ListingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    properties, unseenMatchCount, syncNow,
  } = useData();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ListingScope>('all');
  const [statusFilter, setStatusFilter] = useState<MyStatusFilter>('all');
  const [shareOpen, setShareOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const publicFeed = useInfiniteQuery({
    queryKey: ['mobile-public-properties'],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => listPublicProperties(
      { page: pageParam, limit: 20, sort: 'newest' },
      { signal },
    ),
    getNextPageParam: (lastPage) => (
      lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined
    ),
    enabled: scope === 'all',
    staleTime: 30_000,
  });
  const agencyQuery = useGetAgencyProperties({
    query: {
      enabled: Boolean(user?.id),
      queryKey: getGetAgencyPropertiesQueryKey(),
    },
  });
  const agencyName = agencyQuery.data?.agencyName?.trim() || 'Agency Listings';
  const publicProperties = useMemo(
    () => publicFeed.data?.pages.flatMap((page) => page.properties.map(mapPublicProperty)) ?? [],
    [publicFeed.data?.pages],
  );
  const agencyProperties = useMemo(
    () => agencyQuery.data?.properties.map(mapPublicProperty) ?? [],
    [agencyQuery.data?.properties],
  );

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (scope === 'all') await publicFeed.refetch();
      else if (scope === 'agency') await agencyQuery.refetch();
      else await syncNow();
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = useMemo(() => {
    let list = scope === 'all'
      ? [...publicProperties]
      : scope === 'agency'
        ? [...agencyProperties]
        : properties.filter((property) => property.agentId === user?.id);

    if (scope === 'my' && statusFilter !== 'all') {
      list = list.filter((property) => property.status === statusFilter);
    }

    // Full-text search
    if (query.trim()) {
      list = list.filter((property) => propertyMatchesQuery(property, query));
    }

    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [scope, statusFilter, properties, publicProperties, agencyProperties, query, user?.id]);

  const agencyFilterLabel = agencyName === 'Agency Listings' ? SCOPE_FILTERS[2].label : agencyName;
  const feedLoading = scope === 'all'
    ? publicFeed.isLoading
    : scope === 'agency' && agencyQuery.isLoading;
  const feedError = scope === 'all'
    ? publicFeed.isError
    : scope === 'agency' && agencyQuery.isError;

  const openAlerts = async () => {
    await Haptics.selectionAsync();
    setAlertsOpen(true);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), backgroundColor: colors.background }]}>
        <View style={styles.titleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.foreground }]}>Listings</Text>
          </View>
          <View style={styles.titleActions}>
            <Text style={[styles.count, { color: colors.mutedForeground }]}>{filtered.length} properties</Text>
            <TouchableOpacity
              style={[styles.shareIconBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
              onPress={async () => { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShareOpen(true); }}
            >
              <Ionicons name="share-social-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search suburb, beds, solar, owner, ref…"
        />

        {/* Filter chips — ScrollView so we can insert Alerts between My Listings and Draft */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterList}
          contentContainerStyle={styles.filterContent}
        >
          {SCOPE_FILTERS.map((item) => {
            const active = scope === item.key;
            const label = item.key === 'agency' ? agencyFilterLabel : item.label;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.filterBtn,
                  { backgroundColor: active ? colors.primary : colors.muted, borderColor: active ? colors.primary : colors.border },
                ]}
                onPress={async () => {
                  await Haptics.selectionAsync();
                  setScope(item.key);
                  setStatusFilter('all');
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterText, { color: active ? '#FFF' : colors.mutedForeground }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[
              styles.filterBtn, styles.alertsChip,
              {
                backgroundColor: unseenMatchCount > 0 ? colors.primary : colors.muted,
                borderColor: unseenMatchCount > 0 ? colors.primary : colors.border,
              },
            ]}
            onPress={openAlerts}
          >
            <Ionicons
              name={unseenMatchCount > 0 ? 'notifications' : 'notifications-outline'}
              size={13}
              color={unseenMatchCount > 0 ? '#FFF' : colors.mutedForeground}
            />
            <Text style={[styles.filterText, { color: unseenMatchCount > 0 ? '#FFF' : colors.mutedForeground }]}>
              Alerts
            </Text>
            {unseenMatchCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unseenMatchCount > 9 ? '9+' : unseenMatchCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          {scope === 'my' && MY_STATUS_FILTERS.map((item) => {
            const active = statusFilter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.filterBtn,
                  { backgroundColor: active ? colors.primary : colors.muted, borderColor: active ? colors.primary : colors.border },
                ]}
                onPress={async () => { await Haptics.selectionAsync(); setStatusFilter(item.key); }}
              >
                <Text style={[styles.filterText, { color: active ? '#FFF' : colors.mutedForeground }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={p => p.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 120 },
          filtered.length === 0 && { flex: 1 },
        ]}
        renderItem={({ item }) => (
          <PropertyCard
            property={item}
            onPress={() => {
              if (scope === 'my') router.push(`/listing/${item.id}`);
              else router.push({ pathname: '/public-listing/[id]', params: { id: item.id } });
            }}
          />
        )}
        ListEmptyComponent={feedLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <EmptyState
            icon={feedError ? 'cloud-offline-outline' : 'business-outline'}
            title={feedError ? 'Listings unavailable' : query ? 'No results found' : 'No listings yet'}
            description={feedError
              ? 'Please check your connection and pull down to try again.'
              : query
                ? 'Try suburb, beds, features or owner name.'
                : scope === 'my' ? 'Tap the + button to add your first listing.' : undefined}
            actionLabel={scope === 'my' && !query ? 'Create Listing' : undefined}
            onAction={scope === 'my' ? () => router.push('/new-listing') : undefined}
          />
        )}
        ListFooterComponent={scope === 'all' && publicFeed.isFetchingNextPage ? (
          <View style={styles.loadingFooter}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : undefined}
        onEndReached={() => {
          if (scope === 'all' && publicFeed.hasNextPage && !publicFeed.isFetchingNextPage) {
            void publicFeed.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.45}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        alwaysBounceVertical
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 100 }]}
        onPress={async () => { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/new-listing'); }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      <QuickShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} />
      <AlertsSheet visible={alertsOpen} onClose={() => setAlertsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 12, paddingBottom: 12, zIndex: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  count: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  shareIconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  filterList: { marginHorizontal: -16 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  alertsChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  filterText: { fontSize: 13, fontWeight: '600' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  loadingFooter: { height: 48, alignItems: 'center', justifyContent: 'center' },
  badge: {
    backgroundColor: '#FFF3', borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  fab: {
    position: 'absolute', right: 20, width: 56, height: 56,
    borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { shadowColor: '#1A3C6E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 6 } }),
  },
});
