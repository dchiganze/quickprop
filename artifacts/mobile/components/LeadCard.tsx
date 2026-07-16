import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Lead, LEAD_STAGES } from '@/types';

interface Props {
  lead: Lead;
  onPress: () => void;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export function LeadCard({ lead, onPress }: Props) {
  const colors = useColors();
  const stage = LEAD_STAGES[lead.stage];

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.foreground }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{lead.buyerName.split(' ').map(n => n[0]).join('').slice(0,2)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.foreground }]}>{lead.buyerName}</Text>
          <Text style={[styles.address, { color: colors.mutedForeground }]} numberOfLines={1}>
            {lead.propertyAddress}
          </Text>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeAgo(lead.createdAt)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: stage.color + '20' }]}>
          <Text style={[styles.badgeText, { color: stage.color }]}>{stage.label}</Text>
        </View>
      </View>
      {!!lead.notes && (
        <Text style={[styles.notes, { color: colors.mutedForeground, borderTopColor: colors.border }]} numberOfLines={2}>
          {lead.notes}
        </Text>
      )}
      {lead.followUpDate && (
        <View style={[styles.followUp, { backgroundColor: colors.muted }]}>
          <Ionicons name="time-outline" size={12} color={colors.accent} />
          <Text style={[styles.followUpText, { color: colors.accent }]}>
            Follow up: {new Date(lead.followUpDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  address: { fontSize: 12, marginBottom: 2 },
  time: { fontSize: 11 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  notes: {
    fontSize: 13, marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, lineHeight: 18,
  },
  followUp: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, alignSelf: 'flex-start',
  },
  followUpText: { fontSize: 12, fontWeight: '600' },
});
