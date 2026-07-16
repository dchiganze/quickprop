import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';
import { BuyerMatchCard } from '@/components/BuyerMatchCard';
import { EmptyState } from '@/components/EmptyState';

export default function MatchesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { buyerMatches, setBuyerMatches } = useData() as any;
  const [matches, setMatches] = useState(buyerMatches);

  const unresponded = matches.filter((m: any) => !m.responded).length;

  const handleRespond = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMatches((prev: any[]) => prev.map(m => m.id === id ? { ...m, responded: true } : m));
  };

  const handleDismiss = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMatches((prev: any[]) => prev.filter(m => m.id !== id));
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), backgroundColor: colors.background }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Buyer Matches</Text>
          {unresponded > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={styles.badgeText}>{unresponded} new</Text>
            </View>
          )}
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Automatically matched based on buyer preferences
        </Text>
      </View>

      <FlatList
        data={matches}
        keyExtractor={(m: any) => m.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 120 },
          matches.length === 0 && { flex: 1 },
        ]}
        renderItem={({ item }) => (
          <BuyerMatchCard
            match={item}
            onRespond={() => handleRespond(item.id)}
            onDismiss={() => handleDismiss(item.id)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="people-circle-outline"
            title="No buyer matches yet"
            description="Matches appear when buyer preferences align with your listings."
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 6, paddingBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
});
