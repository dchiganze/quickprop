import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BuyerMatch } from '@/types';

interface Props {
  match: BuyerMatch;
  onRespond: () => void;
  onDismiss: () => void;
}

function MatchRing({ pct, color }: { pct: number; color: string }) {
  const grade = pct >= 90 ? '#10B981' : pct >= 75 ? '#3B82F6' : '#F59E0B';
  return (
    <View style={[styles.ring, { borderColor: grade }]}>
      <Text style={[styles.ringPct, { color: grade }]}>{pct}%</Text>
      <Text style={[styles.ringLabel, { color: grade }]}>Match</Text>
    </View>
  );
}

const FINANCE_LABELS: Record<BuyerMatch['financeType'], string> = {
  cash: 'Cash', mortgage: 'Mortgage', diaspora: 'Diaspora',
};
const URGENCY_LABELS: Record<BuyerMatch['urgency'], string> = {
  immediate: 'Immediate', within_month: 'Within Month', flexible: 'Flexible',
};

export function BuyerMatchCard({ match, onRespond, onDismiss }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.foreground }]}>
      <View style={styles.header}>
        <View style={styles.buyerInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
            <Ionicons name="person" size={22} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.name, { color: colors.foreground }]}>{match.buyerName}</Text>
            <Text style={[styles.property, { color: colors.mutedForeground }]} numberOfLines={1}>
              {match.propertyAddress}
            </Text>
          </View>
        </View>
        <MatchRing pct={match.matchPercentage} color={colors.accent} />
      </View>

      <View style={[styles.pills, { borderTopColor: colors.border }]}>
        <View style={[styles.pill, { backgroundColor: colors.muted }]}>
          <Ionicons name="cash-outline" size={12} color={colors.mutedForeground} />
          <Text style={[styles.pillText, { color: colors.foreground }]}>USD {(match.budget / 1000).toFixed(0)}k</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: colors.muted }]}>
          <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
          <Text style={[styles.pillText, { color: colors.foreground }]}>{match.preferredLocation}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: colors.muted }]}>
          <Ionicons name="card-outline" size={12} color={colors.mutedForeground} />
          <Text style={[styles.pillText, { color: colors.foreground }]}>{FINANCE_LABELS[match.financeType]}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: colors.muted }]}>
          <Ionicons name="flash-outline" size={12} color={colors.mutedForeground} />
          <Text style={[styles.pillText, { color: colors.foreground }]}>{URGENCY_LABELS[match.urgency]}</Text>
        </View>
      </View>

      {match.preferences.length > 0 && (
        <Text style={[styles.prefs, { color: colors.mutedForeground }]}>
          {match.preferences.join(' • ')}
        </Text>
      )}

      {!match.responded ? (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.respondBtn, { backgroundColor: colors.primary }]} onPress={onRespond}>
            <Ionicons name="chatbubble-outline" size={15} color="#FFF" />
            <Text style={styles.respondText}>Respond</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.callBtn, { borderColor: colors.accent }]} onPress={onRespond}>
            <Ionicons name="call-outline" size={15} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dismissBtn, { borderColor: colors.border }]} onPress={onDismiss}>
            <Ionicons name="close" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.respondedBadge, { backgroundColor: colors.muted }]}>
          <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
          <Text style={[styles.respondedText, { color: colors.accent }]}>Responded</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  buyerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '700' },
  property: { fontSize: 12, maxWidth: 200 },
  ring: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  ringPct: { fontSize: 14, fontWeight: '800', lineHeight: 16 },
  ringLabel: { fontSize: 9, fontWeight: '600', lineHeight: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, borderTopWidth: 1, paddingTop: 12, marginBottom: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  pillText: { fontSize: 12, fontWeight: '500' },
  prefs: { fontSize: 12, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  respondBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  respondText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  callBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dismissBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  respondedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, alignSelf: 'flex-start' },
  respondedText: { fontSize: 13, fontWeight: '600' },
});
