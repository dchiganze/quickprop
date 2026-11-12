import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, ScrollView, TouchableOpacity, StyleSheet, Platform, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  getGetAgencyPropertiesQueryKey,
  getListPropertiesQueryKey,
  getListPublicAgentsQueryKey,
  listPublicProperties,
  useGetAgencyProperties,
  useListProperties,
  useListPublicAgents,
  type PublicProperty,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { toMobileProperty, useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { PropertyCard } from '@/components/PropertyCard';
import { SearchBar } from '@/components/SearchBar';
import { EmptyState } from '@/components/EmptyState';
import { QuickShareSheet } from '@/components/QuickShareSheet';
import { useNetworkStatus } from '@/contexts/ConnectivityContext';
import { propertyMatchesQuery } from '@/lib/property-search';
import {
  agencyListingsCacheKey,
  emptyAgencyListingsCache,
  enqueueAgencyListingsCacheTask,
  mergeAgencyListingsCache,
  parseAgencyListingsCache,
  type AgencyListingsCache,
} from '@/lib/agency-listings-cache';
import { cacheMediaForOffline } from '@/utils/offlineMedia';
import type { Property } from '@/types';

type ListingScope = 'all' | 'my' | 'agency';
type MyStatusFilter = 'all' | 'draft' | 'sold' | 'rented' | 'archived';
type ListingVisibilityFilter = 'all' | 'draft' | 'live';

const SCOPE_FILTERS: { key: ListingScope; label: string }[] = [
  { key: 'all', label: 'All of QuickProp' },
  { key: 'my', label: 'My Listings' },
  { key: 'agency', label: 'Agency Listings' },
];

const MY_STATUS_FILTERS: { key: Exclude<MyStatusFilter, 'all'>; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'sold', label: 'Sold' },
  { key: 'rented', label: 'Rented' },
  { key: 'archived', label: 'Archived' },
];

const VISIBILITY_FILTERS: { key: ListingVisibilityFilter; label: string }[] = [
  { key: 'all', label: 'All statuses' },
  { key: 'draft', label: 'Draft listings' },
  { key: 'live', label: 'Live listings' },
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

export default function ListingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isOnline, isOffline } = useNetworkStatus();
  const {
    properties, syncNow,
  } = useData();
  const accountIdRef = useRef<string | null>(user?.id ?? null);
  accountIdRef.current = user?.id ?? null;
  const agencyCacheRef = useRef<AgencyListingsCache | null>(null);
  const [offlineAgencyCache, setOfflineAgencyCache] = useState<AgencyListingsCache | null>(null);
  const [agencyCacheReadyForUser, setAgencyCacheReadyForUser] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ListingScope>('all');
  const [statusFilter, setStatusFilter] = useState<MyStatusFilter>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<ListingVisibilityFilter>('all');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [agentFilter, setAgentFilter] = useState('');
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const accountId = user?.id;
    agencyCacheRef.current = null;
    setOfflineAgencyCache(null);
    setAgencyCacheReadyForUser(null);
    if (!accountId) return () => { cancelled = true; };

    AsyncStorage.getItem(agencyListingsCacheKey(accountId))
      .then((serialized) => {
        if (cancelled) return;
        const cached = parseAgencyListingsCache(serialized, accountId);
        agencyCacheRef.current = cached;
        setOfflineAgencyCache(cached);
        setAgencyCacheReadyForUser(accountId);
      })
      .catch(() => {
        if (cancelled) return;
        agencyCacheRef.current = emptyAgencyListingsCache(accountId);
        setAgencyCacheReadyForUser(accountId);
      });

    return () => { cancelled = true; };
  }, [user?.id]);

  const persistAgencyListings = useCallback((
    accountId: string,
    update: Partial<Omit<AgencyListingsCache, 'version' | 'userId'>>,
  ) => {
    if (accountIdRef.current !== accountId) return;
    const next = mergeAgencyListingsCache(agencyCacheRef.current, accountId, update);
    agencyCacheRef.current = next;
    setOfflineAgencyCache(next);
    void enqueueAgencyListingsCacheTask(async () => {
      if (accountIdRef.current !== accountId) return;
      await AsyncStorage.setItem(agencyListingsCacheKey(accountId), JSON.stringify(next));
    }).catch(() => {
      console.warn('Agency listings could not be saved for offline use.');
    });
  }, []);

  const publicAgentsQuery = useListPublicAgents({
    query: {
      enabled: Boolean(user?.id),
      queryKey: [...getListPublicAgentsQueryKey(), user?.id],
      staleTime: 5 * 60_000,
    },
  });
  const agencyQuery = useGetAgencyProperties({
    query: {
      enabled: Boolean(user?.id),
      queryKey: [...getGetAgencyPropertiesQueryKey(), user?.id],
    },
  });
  const accountAgencyCache = offlineAgencyCache?.userId === user?.id ? offlineAgencyCache : null;
  const activeAgencyName = agencyQuery.data?.agencyName?.trim()
    || accountAgencyCache?.agencyName?.trim()
    || '';
  const agencyName = activeAgencyName || 'Agency Listings';
  const agentOptions = useMemo(() => {
    if (!publicAgentsQuery.data) return accountAgencyCache?.agents ?? [];
    const normalizedAgency = activeAgencyName.toLocaleLowerCase();
    const options = publicAgentsQuery.data
      .filter((agent) => (
        (agent.role === 'agent' || agent.role === 'senior_agent')
        && agent.agencyName?.trim().toLocaleLowerCase() === normalizedAgency
      ))
      .map((agent) => ({
        id: String(agent.id),
        name: agent.name,
        detail: agent.branchName || activeAgencyName,
      }));
    if (
      activeAgencyName
      && user?.role === 'agent'
      && user
      && !options.some((agent) => agent.id === String(user.id))
    ) {
      options.push({ id: String(user.id), name: user.name, detail: user.branch || activeAgencyName });
    }
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, [accountAgencyCache?.agents, activeAgencyName, publicAgentsQuery.data, user]);

  useEffect(() => {
    if (
      !user?.id
      || !activeAgencyName
      || agencyCacheReadyForUser !== user.id
      || publicAgentsQuery.isError
      || !publicAgentsQuery.data
    ) return;
    persistAgencyListings(user.id, {
      agencyName: activeAgencyName,
      agents: agentOptions,
      agentsSyncedAt: new Date().toISOString(),
    });
  }, [
    activeAgencyName,
    agencyCacheReadyForUser,
    agentOptions,
    persistAgencyListings,
    publicAgentsQuery.data,
    user?.id,
  ]);

  const allAgencyAgentsLabel = activeAgencyName ? `All ${activeAgencyName} agents` : 'All agency agents';
  const visibleAgentOptions = useMemo(() => {
    const term = agentSearch.trim().toLowerCase();
    return term
      ? agentOptions.filter((agent) => agent.name.toLowerCase().includes(term) || agent.detail.toLowerCase().includes(term))
      : agentOptions;
  }, [agentOptions, agentSearch]);
  const selectedAgent = agentOptions.find((agent) => agent.id === agentFilter);
  const publicAgentId = /^\d+$/.test(agentFilter) ? Number(agentFilter) : undefined;
  const serverUserId = /^\d+$/.test(user?.id ?? '') ? Number(user?.id) : undefined;
  const draftFilterParams = useMemo(() => {
    if (
      scope === 'my'
      || (scope !== 'agency' && visibilityFilter !== 'draft' && user?.role !== 'agent')
    ) return undefined;

    if (scope === 'agency') {
      if (user?.role === 'agent' && serverUserId == null) return undefined;
      if (user?.role !== 'agent' && publicAgentId == null) return undefined;
      return {
        status: 'draft',
        ...(user?.role === 'agent' ? {} : { agentId: publicAgentId }),
        agencyInventory: 'agency' as const,
      };
    }

    if (user?.role === 'agent') {
      if (serverUserId == null) return undefined;
      return {
        status: 'draft',
        agencyInventory: 'agency' as const,
      };
    }

    if (publicAgentId != null) return { status: 'draft', agentId: publicAgentId };
    return user?.role === 'administrator' ? { status: 'draft' } : undefined;
  }, [publicAgentId, scope, serverUserId, user?.role, visibilityFilter]);
  const draftQueryEnabled = Boolean(
    serverUserId != null
    && scope !== 'my'
    && draftFilterParams
    && (scope === 'agency' || user?.role === 'agent' || visibilityFilter === 'draft'),
  );
  const draftListingsQuery = useListProperties(draftFilterParams, {
    query: {
      enabled: draftQueryEnabled,
      queryKey: [...getListPropertiesQueryKey(draftFilterParams), user?.id],
      staleTime: 30_000,
    },
  });

  const publicFeed = useInfiniteQuery({
    queryKey: ['mobile-public-properties', agentFilter || 'all'],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => listPublicProperties(
      { page: pageParam, limit: 20, sort: 'newest', agentId: publicAgentId },
      { signal },
    ),
    getNextPageParam: (lastPage) => (
      lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined
    ),
    enabled: scope === 'all',
    staleTime: 30_000,
  });
  const publicProperties = useMemo(
    () => publicFeed.data?.pages.flatMap((page) => page.properties.map(mapPublicProperty)) ?? [],
    [publicFeed.data?.pages],
  );
  const queriedAgencyProperties = useMemo(
    () => agencyQuery.data?.properties.map(mapPublicProperty) ?? [],
    [agencyQuery.data?.properties],
  );
  const queriedDraftProperties = useMemo(
    () => (draftListingsQuery.data ?? [])
      .filter((property) => property.status === 'draft' || property.pipelineStage === 'draft')
      .map(toMobileProperty),
    [draftListingsQuery.data],
  );
  const agencyProperties = agencyQuery.data
    ? queriedAgencyProperties
    : accountAgencyCache?.live ?? queriedAgencyProperties;
  const remoteDraftProperties = draftListingsQuery.data !== undefined
    ? queriedDraftProperties
    : (scope === 'agency' || user?.role === 'agent')
      ? accountAgencyCache?.drafts ?? queriedDraftProperties
      : queriedDraftProperties;

  useEffect(() => {
    if (!user?.id || agencyCacheReadyForUser !== user.id || agencyQuery.isError || !agencyQuery.data) return;
    persistAgencyListings(user.id, {
      agencyName: agencyQuery.data.agencyName?.trim() || null,
      live: queriedAgencyProperties,
      liveSyncedAt: new Date().toISOString(),
    });
  }, [agencyCacheReadyForUser, agencyQuery.data, persistAgencyListings, queriedAgencyProperties, user?.id]);

  useEffect(() => {
    if (
      !user?.id
      || agencyCacheReadyForUser !== user.id
      || draftListingsQuery.isError
      || !draftQueryEnabled
      || draftListingsQuery.data === undefined
    ) return;
    persistAgencyListings(user.id, {
      drafts: queriedDraftProperties,
      draftsSyncedAt: new Date().toISOString(),
    });
  }, [
    agencyCacheReadyForUser,
    draftListingsQuery.data,
    draftQueryEnabled,
    persistAgencyListings,
    queriedDraftProperties,
    user?.id,
  ]);

  const offlineAgencyPhotoUris = useMemo(
    () => [...new Set([...agencyProperties, ...remoteDraftProperties]
      .flatMap((property) => property.photos ?? [])
      .filter((uri) => typeof uri === 'string' && uri.trim()))],
    [agencyProperties, remoteDraftProperties],
  );
  const offlineAgencyPhotoSignature = offlineAgencyPhotoUris.join('\u0000');

  useEffect(() => {
    if (Platform.OS === 'web' || !user?.id || !isOnline || offlineAgencyPhotoUris.length === 0) return;
    let cancelled = false;
    let storageUnavailable = false;
    let nextIndex = 0;
    const cacheWorker = async () => {
      while (!cancelled && !storageUnavailable) {
        const uri = offlineAgencyPhotoUris[nextIndex];
        nextIndex += 1;
        if (!uri) return;
        if (uri.startsWith('file://')) continue;
        try {
          await cacheMediaForOffline(uri, user.id);
        } catch (error) {
          if (error instanceof Error && error.message.includes('free device storage')) {
            storageUnavailable = true;
            return;
          }
          console.warn('Agency listing photo cache deferred.', error);
        }
      }
    };

    void Promise.all(Array.from(
      { length: Math.min(3, offlineAgencyPhotoUris.length) },
      () => cacheWorker(),
    ));
    return () => { cancelled = true; };
  }, [isOnline, offlineAgencyPhotoSignature, offlineAgencyPhotoUris, user?.id]);
  const localDraftProperties = useMemo(
    () => properties.filter((property) =>
      (property.status === 'draft' || property.pendingStatus === 'draft')
      && property.agentId === user?.id
      && (!agentFilter || property.agentId === agentFilter),
    ),
    [agentFilter, properties, user?.id],
  );
  const draftProperties = useMemo(() => {
    const combined = new Map(remoteDraftProperties.map((property) => [property.id, property]));
    const canIncludeLocalDrafts = scope !== 'agency' || agentFilter === user?.id;
    if (canIncludeLocalDrafts) {
      for (const property of localDraftProperties) combined.set(property.id, property);
    }
    return [...combined.values()]
      .filter((property) => !agentFilter || property.agentId === agentFilter)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [agentFilter, localDraftProperties, remoteDraftProperties, scope, user?.id]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (visibilityFilter === 'draft' && scope !== 'my' && draftQueryEnabled) {
        await draftListingsQuery.refetch();
      } else if (visibilityFilter === 'draft' || scope === 'my') {
        await syncNow();
      } else if (scope === 'all') await publicFeed.refetch();
      else if (scope === 'agency') await agencyQuery.refetch();
      else await syncNow();
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = useMemo(() => {
    let list = visibilityFilter === 'draft'
      ? scope === 'my'
        ? localDraftProperties
        : draftProperties
      : scope === 'all'
        ? [...publicProperties]
        : scope === 'agency'
          ? [...agencyProperties]
          : properties.filter((property) => property.agentId === user?.id);

    if (agentFilter) {
      list = list.filter((property) => property.agentId === agentFilter);
    }

    if (visibilityFilter === 'live') {
      list = list.filter((property) => property.status === 'published');
    }

    if (scope === 'my' && visibilityFilter === 'all' && statusFilter !== 'all') {
      list = list.filter((property) => property.status === statusFilter);
    }

    // Full-text search
    if (query.trim()) {
      list = list.filter((property) => propertyMatchesQuery(property, query));
    }

    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [
    scope, statusFilter, visibilityFilter, properties, publicProperties, agencyProperties,
    localDraftProperties, draftProperties, query, user?.id, agentFilter,
  ]);

  const agencyFilterLabel = agencyName === 'Agency Listings' ? SCOPE_FILTERS[2].label : agencyName;
  const feedLoading = visibilityFilter === 'draft'
    ? scope !== 'my'
      && draftQueryEnabled
      && draftListingsQuery.isLoading
      && !(accountAgencyCache?.draftsSyncedAt && (scope === 'agency' || user?.role === 'agent'))
    : scope === 'all'
      ? publicFeed.isLoading
      : scope === 'agency' && agencyQuery.isLoading && !accountAgencyCache?.liveSyncedAt;
  const feedError = visibilityFilter === 'draft'
    ? scope !== 'my'
      && draftQueryEnabled
      && draftListingsQuery.isError
      && !(accountAgencyCache?.draftsSyncedAt && (scope === 'agency' || user?.role === 'agent'))
    : scope === 'all'
      ? publicFeed.isError
      : scope === 'agency' && agencyQuery.isError && !accountAgencyCache?.liveSyncedAt;

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

        <View style={styles.agentFilterWrap}>
          <TouchableOpacity
            style={[styles.agentFilterButton, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={() => {
              setAgentMenuOpen((open) => !open);
              setAgentSearch('');
            }}
            accessibilityRole="button"
            accessibilityLabel={selectedAgent ? `Filter by agent, ${selectedAgent.name}` : `Filter by agent, ${allAgencyAgentsLabel}`}
            accessibilityState={{ expanded: agentMenuOpen }}
            testID="mobile-agent-filter"
          >
            <Ionicons name="people-outline" size={17} color={colors.mutedForeground} />
            <Text numberOfLines={1} style={[styles.agentFilterButtonText, { color: colors.foreground }]}>
              {selectedAgent ? selectedAgent.name : allAgencyAgentsLabel}
            </Text>
            <Ionicons name={agentMenuOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          {agentMenuOpen && (
            <View style={[styles.agentDropdown, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={[styles.agentSearch, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
                <TextInput
                  value={agentSearch}
                  onChangeText={setAgentSearch}
                  placeholder="Search agents"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.agentSearchInput, { color: colors.foreground }]}
                  autoCapitalize="words"
                  testID="mobile-agent-search"
                />
              </View>

              <ScrollView style={styles.agentMenuScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                <TouchableOpacity
                  style={[styles.agentOption, !agentFilter && { backgroundColor: `${colors.primary}14` }]}
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    setAgentFilter('');
                    setAgentMenuOpen(false);
                    setAgentSearch('');
                  }}
                  accessibilityRole="button"
                  testID="mobile-agent-filter-all"
                >
                  <Text style={[styles.agentOptionName, { color: !agentFilter ? colors.primary : colors.foreground }]}>
                    {allAgencyAgentsLabel}
                  </Text>
                  {!agentFilter && <Ionicons name="checkmark" size={17} color={colors.primary} />}
                </TouchableOpacity>

                {(publicAgentsQuery.isLoading || agencyQuery.isLoading) && !accountAgencyCache?.agentsSyncedAt ? (
                  <View style={styles.agentLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.agentOptionDetail, { color: colors.mutedForeground }]}>Loading agents…</Text>
                  </View>
                ) : (publicAgentsQuery.isError || agencyQuery.isError || !activeAgencyName) && !accountAgencyCache?.agentsSyncedAt ? (
                  <TouchableOpacity
                    style={styles.agentLoading}
                    onPress={() => { void Promise.all([publicAgentsQuery.refetch(), agencyQuery.refetch()]); }}
                    accessibilityRole="button"
                    testID="mobile-agent-filter-retry"
                  >
                    <Text style={[styles.agentOptionName, { color: colors.primary }]}>Couldn’t load your agency’s agents — tap to retry</Text>
                  </TouchableOpacity>
                ) : visibleAgentOptions.length > 0 ? (
                  visibleAgentOptions.map((agent) => (
                    <TouchableOpacity
                      key={agent.id}
                      style={[styles.agentOption, agentFilter === agent.id && { backgroundColor: `${colors.primary}14` }]}
                      onPress={async () => {
                        await Haptics.selectionAsync();
                        setAgentFilter(agent.id);
                        setAgentMenuOpen(false);
                        setAgentSearch('');
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: agentFilter === agent.id }}
                      testID={`mobile-agent-option-${agent.id}`}
                    >
                      <View style={styles.agentOptionLabel}>
                        <Text numberOfLines={1} style={[styles.agentOptionName, { color: agentFilter === agent.id ? colors.primary : colors.foreground }]}>
                          {agent.name}
                        </Text>
                        {agent.detail ? (
                          <Text numberOfLines={1} style={[styles.agentOptionDetail, { color: colors.mutedForeground }]}>
                            {agent.detail}
                          </Text>
                        ) : null}
                      </View>
                      {agentFilter === agent.id && <Ionicons name="checkmark" size={17} color={colors.primary} />}
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={[styles.agentOptionDetail, styles.agentNoResults, { color: colors.mutedForeground }]}>
                    No agents match that search.
                  </Text>
                )}
              </ScrollView>
            </View>
          )}
        </View>

        <View style={styles.statusFilterWrap}>
          <TouchableOpacity
            style={[styles.statusFilterButton, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={() => setStatusMenuOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={`Listing status, ${VISIBILITY_FILTERS.find((item) => item.key === visibilityFilter)?.label ?? 'All statuses'}`}
            accessibilityState={{ expanded: statusMenuOpen }}
            testID="mobile-listing-status-filter"
          >
            <Ionicons name="options-outline" size={17} color={colors.mutedForeground} />
            <Text style={[styles.agentFilterButtonText, { color: colors.foreground }]}>
              {VISIBILITY_FILTERS.find((item) => item.key === visibilityFilter)?.label ?? 'All statuses'}
            </Text>
            <Ionicons name={statusMenuOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {statusMenuOpen && (
            <View style={[styles.statusDropdown, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {VISIBILITY_FILTERS.map((item) => {
                const selected = visibilityFilter === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.statusOption, selected && { backgroundColor: `${colors.primary}14` }]}
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      setVisibilityFilter(item.key);
                      setStatusFilter('all');
                      setStatusMenuOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    testID={`mobile-listing-status-${item.key}`}
                  >
                    <Text style={[styles.agentOptionName, { color: selected ? colors.primary : colors.foreground }]}>
                      {item.label}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={17} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Listing scope filters */}
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
          {scope === 'my' && visibilityFilter === 'all' && MY_STATUS_FILTERS.map((item) => {
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
        {scope === 'agency'
          && isOffline
          && (visibilityFilter === 'draft'
            ? Boolean(accountAgencyCache?.draftsSyncedAt)
            : Boolean(accountAgencyCache?.liveSyncedAt))
          && (
            <View style={[styles.offlineAgencyHint, { backgroundColor: `${colors.primary}12` }]}>
              <Ionicons name="cloud-offline-outline" size={15} color={colors.primary} />
              <Text style={[styles.offlineAgencyHintText, { color: colors.primary }]}>
                Offline — showing agency listings from the last sync.
              </Text>
            </View>
          )}
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
            title={feedError ? 'Listings unavailable' : query || agentFilter || visibilityFilter !== 'all' ? 'No results found' : 'No listings yet'}
            description={feedError
              ? 'Please check your connection and pull down to try again.'
              : visibilityFilter !== 'all' && !query && !agentFilter
                ? `No ${visibilityFilter} listings found. Try a different filter or agent.`
                : query || agentFilter
                ? 'Try a different search or agent.'
                : scope === 'my' ? 'Tap the + button to add your first listing.' : undefined}
            actionLabel={scope === 'my' && !query && !agentFilter ? 'Create Listing' : undefined}
            onAction={scope === 'my' ? () => router.push('/new-listing') : undefined}
          />
        )}
        ListFooterComponent={scope === 'all' && visibilityFilter !== 'draft' && publicFeed.isFetchingNextPage ? (
          <View style={styles.loadingFooter}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : undefined}
        onEndReached={() => {
          if (scope === 'all' && visibilityFilter !== 'draft' && publicFeed.hasNextPage && !publicFeed.isFetchingNextPage) {
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
  agentFilterWrap: { gap: 8 },
  statusFilterWrap: { gap: 8 },
  agentFilterButton: { minHeight: 42, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  statusFilterButton: { minHeight: 42, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  statusDropdown: { borderWidth: 1, borderRadius: 12, padding: 6, gap: 3 },
  statusOption: { minHeight: 42, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  agentFilterButtonText: { flex: 1, fontSize: 14, fontWeight: '600' },
  agentDropdown: { borderWidth: 1, borderRadius: 12, padding: 8, gap: 8 },
  agentSearch: { height: 40, borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  agentSearchInput: { flex: 1, height: '100%', fontSize: 14 },
  agentMenuScroll: { maxHeight: 210 },
  agentOption: { minHeight: 42, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  agentOptionLabel: { flex: 1, minWidth: 0 },
  agentOptionName: { fontSize: 14, fontWeight: '600' },
  agentOptionDetail: { fontSize: 12 },
  agentLoading: { minHeight: 40, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  agentNoResults: { paddingHorizontal: 10, paddingVertical: 14 },
  filterList: { marginHorizontal: -16 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  offlineAgencyHint: { marginHorizontal: 18, marginTop: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  offlineAgencyHintText: { flex: 1, fontSize: 12, fontWeight: '600' },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: '600' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  loadingFooter: { height: 48, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  fab: {
    position: 'absolute', right: 20, width: 56, height: 56,
    borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { shadowColor: '#1A3C6E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 6 } }),
  },
});
