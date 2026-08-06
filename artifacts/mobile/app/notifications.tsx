import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';

type NotifKind = 'new_lead' | 'viewing' | 'overdue' | 'due_today' | 'mandate';

interface Notification {
  id: string;
  kind: NotifKind;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string | null;
}

const KIND_META: Record<NotifKind, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  new_lead:  { icon: 'person-add-outline',   color: '#8B5CF6' },
  viewing:   { icon: 'eye-outline',           color: '#06B6D4' },
  overdue:   { icon: 'alert-circle-outline',  color: '#EF4444' },
  due_today: { icon: 'time-outline',          color: '#F59E0B' },
  mandate:   { icon: 'refresh-outline',       color: '#10B981' },
};

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { leads, tasks } = useData();

  const notifications = useMemo<Notification[]>(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const items: Notification[] = [];

    // New leads
    leads
      .filter(l => l.stage === 'new')
      .forEach(l => {
        items.push({
          id: `lead-new-${l.id}`,
          kind: 'new_lead',
          title: 'New lead',
          subtitle: `${l.name} is interested in ${l.propertyType} — ${l.budget}`,
          icon: KIND_META.new_lead.icon,
          color: KIND_META.new_lead.color,
          route: `/lead/${l.id}`,
        });
      });

    // Today's viewings
    tasks
      .filter(t => t.type === 'viewing' && !t.completed && new Date(t.dueDate).toDateString() === todayStr)
      .forEach(t => {
        items.push({
          id: `viewing-${t.id}`,
          kind: 'viewing',
          title: 'Viewing today',
          subtitle: t.propertyAddress ? `${t.title} — ${t.propertyAddress}` : t.title,
          icon: KIND_META.viewing.icon,
          color: KIND_META.viewing.color,
          route: t.propertyId ? `/listing/${t.propertyId}` : null,
        });
      });

    // Overdue tasks (not viewings — those are shown above when today)
    tasks
      .filter(t => !t.completed && new Date(t.dueDate) < now && new Date(t.dueDate).toDateString() !== todayStr)
      .forEach(t => {
        const daysAgo = Math.floor((now.getTime() - new Date(t.dueDate).getTime()) / 86400000);
        items.push({
          id: `overdue-${t.id}`,
          kind: 'overdue',
          title: `Overdue${daysAgo > 1 ? ` · ${daysAgo} days` : ''}`,
          subtitle: t.propertyAddress ? `${t.title} — ${t.propertyAddress}` : t.title,
          icon: KIND_META.overdue.icon,
          color: KIND_META.overdue.color,
          route: t.propertyId ? `/listing/${t.propertyId}` : null,
        });
      });

    // Tasks due today (non-viewing)
    tasks
      .filter(t => t.type !== 'viewing' && !t.completed && new Date(t.dueDate).toDateString() === todayStr)
      .forEach(t => {
        items.push({
          id: `due-${t.id}`,
          kind: 'due_today',
          title: 'Due today',
          subtitle: t.propertyAddress ? `${t.title} — ${t.propertyAddress}` : t.title,
          icon: KIND_META.due_today.icon,
          color: KIND_META.due_today.color,
          route: t.propertyId ? `/listing/${t.propertyId}` : null,
        });
      });

    // Mandate renewals
    tasks
      .filter(t => t.type === 'renew_mandate' && !t.completed)
      .forEach(t => {
        items.push({
          id: `mandate-${t.id}`,
          kind: 'mandate',
          title: 'Mandate renewal',
          subtitle: t.propertyAddress ? `${t.title} — ${t.propertyAddress}` : t.title,
          icon: KIND_META.mandate.icon,
          color: KIND_META.mandate.color,
          route: t.propertyId ? `/listing/${t.propertyId}` : null,
        });
      });

    return items;
  }, [leads, tasks]);

  const handlePress = (n: Notification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (n.route) router.push(n.route as any);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); router.back(); }}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Notifications</Text>
        {notifications.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.primary + '18' }]}>
            <Text style={[styles.countText, { color: colors.primary }]}>{notifications.length}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
          notifications.length === 0 && styles.centeredContent,
        ]}
        showsVerticalScrollIndicator={false}
        delaysContentTouches={false}
      >
        {notifications.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
              <Ionicons name="notifications-off-outline" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>You're all caught up</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>No new leads, overdue tasks, or upcoming viewings.</Text>
          </View>
        ) : (
          <>
            {/* Group: Action Required */}
            {notifications.filter(n => ['new_lead', 'overdue'].includes(n.kind)).length > 0 && (
              <>
                <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>ACTION REQUIRED</Text>
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {notifications
                    .filter(n => ['new_lead', 'overdue'].includes(n.kind))
                    .map((n, i, arr) => (
                      <Pressable
                        key={n.id}
                        style={({ pressed }) => [
                          styles.row,
                          i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                          pressed && n.route ? { opacity: 0.7 } : undefined,
                        ]}
                        onPress={() => handlePress(n)}
                      >
                        <View style={[styles.iconWrap, { backgroundColor: n.color + '18' }]}>
                          <Ionicons name={n.icon} size={18} color={n.color} />
                        </View>
                        <View style={styles.rowText}>
                          <Text style={[styles.rowTitle, { color: n.color }]}>{n.title}</Text>
                          <Text style={[styles.rowSub, { color: colors.foreground }]} numberOfLines={2}>{n.subtitle}</Text>
                        </View>
                        {n.route && <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />}
                      </Pressable>
                    ))}
                </View>
              </>
            )}

            {/* Group: Today */}
            {notifications.filter(n => ['viewing', 'due_today'].includes(n.kind)).length > 0 && (
              <>
                <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>TODAY</Text>
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {notifications
                    .filter(n => ['viewing', 'due_today'].includes(n.kind))
                    .map((n, i, arr) => (
                      <Pressable
                        key={n.id}
                        style={({ pressed }) => [
                          styles.row,
                          i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                          pressed && n.route ? { opacity: 0.7 } : undefined,
                        ]}
                        onPress={() => handlePress(n)}
                      >
                        <View style={[styles.iconWrap, { backgroundColor: n.color + '18' }]}>
                          <Ionicons name={n.icon} size={18} color={n.color} />
                        </View>
                        <View style={styles.rowText}>
                          <Text style={[styles.rowTitle, { color: n.color }]}>{n.title}</Text>
                          <Text style={[styles.rowSub, { color: colors.foreground }]} numberOfLines={2}>{n.subtitle}</Text>
                        </View>
                        {n.route && <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />}
                      </Pressable>
                    ))}
                </View>
              </>
            )}

            {/* Group: Upcoming */}
            {notifications.filter(n => n.kind === 'mandate').length > 0 && (
              <>
                <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>UPCOMING</Text>
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {notifications
                    .filter(n => n.kind === 'mandate')
                    .map((n, i, arr) => (
                      <Pressable
                        key={n.id}
                        style={({ pressed }) => [
                          styles.row,
                          i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                          pressed && n.route ? { opacity: 0.7 } : undefined,
                        ]}
                        onPress={() => handlePress(n)}
                      >
                        <View style={[styles.iconWrap, { backgroundColor: n.color + '18' }]}>
                          <Ionicons name={n.icon} size={18} color={n.color} />
                        </View>
                        <View style={styles.rowText}>
                          <Text style={[styles.rowTitle, { color: n.color }]}>{n.title}</Text>
                          <Text style={[styles.rowSub, { color: colors.foreground }]} numberOfLines={2}>{n.subtitle}</Text>
                        </View>
                        {n.route && <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />}
                      </Pressable>
                    ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', flex: 1, letterSpacing: -0.3 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  countText: { fontSize: 13, fontWeight: '700' },
  content: { padding: 16, gap: 6 },
  centeredContent: { flex: 1, justifyContent: 'center' },
  groupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 14, marginBottom: 6, marginLeft: 4 },
  card: {
    borderRadius: 16, borderWidth: 1, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 12, fontWeight: '700', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  rowSub: { fontSize: 14, fontWeight: '500', lineHeight: 18 },
  empty: { alignItems: 'center', gap: 12 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 260 },
});
