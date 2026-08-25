import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { PropertyCard } from '@/components/PropertyCard';
import { SearchBar } from '@/components/SearchBar';
import { EmptyState } from '@/components/EmptyState';
import { QuickShareSheet } from '@/components/QuickShareSheet';
import { AlertsSheet } from '@/components/AlertsSheet';

type Filter = 'all' | 'my' | 'agency' | 'draft' | 'pending' | 'sold' | 'rented' | 'archived';

const STATUS_FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'my', label: 'My Listings' },
  // 'alerts' chip is rendered separately between My Listings and Draft
  { key: 'draft', label: 'Draft' },
  { key: 'pending', label: 'Pending' },
  { key: 'sold', label: 'Sold' },
  { key: 'rented', label: 'Rented' },
  { key: 'archived', label: 'Archived' },
];

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
    properties, unseenMatchCount, cloudSyncState, lastSyncedAt,
    lastSyncError, pendingSyncCount, syncNow,
  } = useData();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [shareOpen, setShareOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [refreshingSync, setRefreshingSync] = useState(false);

  const filtered = useMemo(() => {
    let list = [...properties];

    // Status / ownership filter
    if (filter === 'my') list = list.filter(p => p.agentId === user?.id);
    else if (filter === 'draft') list = list.filter(p => p.status === 'draft');
    else if (filter === 'pending') list = list.filter(p => p.status === 'pending');
    else if (filter === 'sold') list = list.filter(p => p.status === 'sold');
    else if (filter === 'rented') list = list.filter(p => p.status === 'rented');
    else if (filter === 'archived') list = list.filter(p => p.status === 'archived');

    // Full-text search
    if (query.trim()) {
      list = list.filter(p => propertyMatchesQuery(p, query));
    }

    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [properties, filter, query, user]);

  const openAlerts = async () => {
    await Haptics.selectionAsync();
    setAlertsOpen(true);
  };

  const refreshCloud = async () => {
    setRefreshingSync(true);
    await Haptics.selectionAsync();
    try {
      await syncNow();
    } finally {
      setRefreshingSync(false);
    }
  };

  const syncSummary = (() => {
    if (lastSyncError) return lastSyncError;
    if (cloudSyncState === 'offline') return 'Offline mode — changes stay on this device until you sign in.';
    if (cloudSyncState === 'syncing' || refreshingSync) return 'Syncing your portfolio with QuickProp cloud…';
    if (cloudSyncState === 'pending') return `${pendingSyncCount || 'Some'} change${pendingSyncCount === 1 ? '' : 's'} waiting to upload.`;
    if (lastSyncedAt) return `Cloud backup complete at ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    return 'Your listings are stored securely in QuickProp cloud.';
  })();

  const syncTone = lastSyncError || cloudSyncState === 'pending'
    ? colors.warning ?? '#C27803'
    : cloudSyncState === 'offline'
      ? colors.mutedForeground
      : colors.primary;

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

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Sync listings with QuickProp cloud"
          style={[styles.syncCard, { backgroundColor: colors.card, borderColor: lastSyncError ? syncTone : colors.border }]}
          onPress={refreshCloud}
          disabled={refreshingSync}
        >
          <View style={[styles.syncIcon, { backgroundColor: syncTone + '16' }]}>
            <Ionicons
              name={lastSyncError ? 'cloud-offline-outline' : cloudSyncState === 'synced' ? 'cloud-done-outline' : 'cloud-upload-outline'}
              size={18}
              color={syncTone}
            />
          </View>
          <View style={styles.syncCopy}>
            <Text style={[styles.syncTitle, { color: colors.foreground }]}>Listing cloud backup</Text>
            <Text style={[styles.syncSummary, { color: lastSyncError ? syncTone : colors.mutedForeground }]} numberOfLines={2}>
              {syncSummary}
            </Text>
          </View>
          <Ionicons name={refreshingSync ? 'sync' : 'refresh'} size={18} color={syncTone} />
        </TouchableOpacity>

        {/* Filter chips — ScrollView so we can insert Alerts between My Listings and Draft */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterList}
          contentContainerStyle={styles.filterContent}
        >
          {STATUS_FILTERS.map((item, index) => {
            const active = filter === item.key;
            return (
              <React.Fragment key={item.key}>
                <TouchableOpacity
                  style={[
                    styles.filterBtn,
                    { backgroundColor: active ? colors.primary : colors.muted, borderColor: active ? colors.primary : colors.border },
                  ]}
                  onPress={async () => { await Haptics.selectionAsync(); setFilter(item.key); }}
                >
                  <Text style={[styles.filterText, { color: active ? '#FFF' : colors.mutedForeground }]}>{item.label}</Text>
                </TouchableOpacity>

                {/* Alerts chip inserted after "My Listings" (index 1) */}
                {index === 1 && (
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
                )}
              </React.Fragment>
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
          <PropertyCard property={item} onPress={() => router.push(`/listing/${item.id}`)} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="business-outline"
            title={query ? 'No results found' : 'No listings yet'}
            description={query ? 'Try suburb, beds, features or owner name.' : 'Tap the + button to add your first listing.'}
            actionLabel={query ? undefined : 'Create Listing'}
            onAction={() => router.push('/new-listing')}
          />
        }
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
  syncCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 10 },
  syncIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  syncCopy: { flex: 1, gap: 2 },
  syncTitle: { fontSize: 13, fontWeight: '800' },
  syncSummary: { fontSize: 11, lineHeight: 15 },
  filterList: { marginHorizontal: -16 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  alertsChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  filterText: { fontSize: 13, fontWeight: '600' },
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
