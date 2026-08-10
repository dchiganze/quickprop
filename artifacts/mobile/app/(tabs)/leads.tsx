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
import { LeadCard } from '@/components/LeadCard';
import { SearchBar } from '@/components/SearchBar';
import { EmptyState } from '@/components/EmptyState';
import { Lead, LEAD_STAGES } from '@/types';

type StageFilter = 'all' | Lead['stage'];
const FILTERS: { key: StageFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'viewing_booked', label: 'Viewing' },
  { key: 'offer', label: 'Offer' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'completed', label: 'Closed' },
  { key: 'lost', label: 'Lost' },
];

export default function LeadsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { leads } = useData();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StageFilter>('all');

  const filtered = useMemo(() => {
    let list = [...leads];
    if (filter !== 'all') list = list.filter(l => l.stage === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(l =>
        l.buyerName.toLowerCase().includes(q) ||
        l.propertyAddress.toLowerCase().includes(q) ||
        l.buyerEmail.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [leads, filter, query]);

  const newCount = leads.filter(l => l.stage === 'new').length;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), backgroundColor: colors.background }]}>
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Leads</Text>
          {newCount > 0 && (
            <View style={[styles.newBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.newBadgeText}>{newCount} new</Text>
            </View>
          )}
        </View>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by name, property, email..." />
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={f => f.key}
          style={styles.filterList}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => {
            const active = filter === item.key;
            const stageColor = item.key !== 'all' ? LEAD_STAGES[item.key as Lead['stage']]?.color : colors.primary;
            return (
              <TouchableOpacity
                style={[styles.filterBtn, { backgroundColor: active ? stageColor : colors.muted, borderColor: active ? stageColor : colors.border }]}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setFilter(item.key); }}
              >
                <Text style={[styles.filterText, { color: active ? '#FFF' : colors.mutedForeground }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={l => l.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 120 },
          filtered.length === 0 && { flex: 1 },
        ]}
        renderItem={({ item }) => (
          <LeadCard lead={item} onPress={() => router.push(`/lead/${item.id}`)} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title={query ? 'No leads found' : 'No leads yet'}
            description={query ? 'Try a different search term.' : 'Leads appear here when buyers enquire about your listings.'}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 12, paddingBottom: 12, zIndex: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  newBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  newBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  filterList: { marginHorizontal: -16 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
});