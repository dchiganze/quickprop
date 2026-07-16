import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Platform,
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
import { Property } from '@/types';

type Filter = 'all' | 'my' | 'agency' | 'draft' | 'pending' | 'sold' | 'rented' | 'archived';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'my', label: 'My Listings' },
  { key: 'draft', label: 'Draft' },
  { key: 'pending', label: 'Pending' },
  { key: 'sold', label: 'Sold' },
  { key: 'rented', label: 'Rented' },
  { key: 'archived', label: 'Archived' },
];

export default function ListingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { properties } = useData();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    let list = [...properties];
    if (filter === 'my') list = list.filter(p => p.agentId === user?.id);
    else if (filter === 'draft') list = list.filter(p => p.status === 'draft');
    else if (filter === 'pending') list = list.filter(p => p.status === 'pending');
    else if (filter === 'sold') list = list.filter(p => p.status === 'sold');
    else if (filter === 'rented') list = list.filter(p => p.status === 'rented');
    else if (filter === 'archived') list = list.filter(p => p.status === 'archived');

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(p =>
        p.address.toLowerCase().includes(q) ||
        p.suburb.toLowerCase().includes(q) ||
        p.referenceNumber.toLowerCase().includes(q) ||
        p.seller.name.toLowerCase().includes(q) ||
        String(p.price).includes(q) ||
        p.type.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [properties, filter, query, user]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), backgroundColor: colors.background }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Listings</Text>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>{filtered.length} properties</Text>
        </View>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by address, suburb, price, agent..." />
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={f => f.key}
          style={styles.filterList}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => {
            const active = filter === item.key;
            return (
              <TouchableOpacity
                style={[styles.filterBtn, { backgroundColor: active ? colors.primary : colors.muted, borderColor: active ? colors.primary : colors.border }]}
                onPress={async () => { await Haptics.selectionAsync(); setFilter(item.key); }}
              >
                <Text style={[styles.filterText, { color: active ? '#FFF' : colors.mutedForeground }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          }}
        />
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
            description={query ? 'Try a different search term.' : 'Tap the + button to add your first listing.'}
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 12, paddingBottom: 12, zIndex: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  count: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  filterList: { marginHorizontal: -16 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  fab: {
    position: 'absolute', right: 20, width: 56, height: 56,
    borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { shadowColor: '#1A3C6E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 6 } }),
  },
});
