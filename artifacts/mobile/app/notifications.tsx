import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { leads, tasks } = useData();

  const todayStr = new Date().toDateString();
  const now = new Date();

  const newLeads = leads.filter(l => l.stage === 'new');
  const overdueTasks = tasks.filter(t => !t.completed && new Date(t.dueDate) < now && new Date(t.dueDate).toDateString() !== todayStr);

  const viewingsToday = tasks.filter(t => t.type === 'viewing' && !t.completed && new Date(t.dueDate).toDateString() === todayStr);
  const tasksDueToday = tasks.filter(t => t.type !== 'viewing' && !t.completed && new Date(t.dueDate).toDateString() === todayStr);

  const in14 = new Date(); in14.setDate(in14.getDate() + 14);
  const mandateRenewals = tasks.filter(t =>
    t.type === 'renew_mandate' && !t.completed &&
    new Date(t.dueDate) > now && new Date(t.dueDate) <= in14
  );

  const hasAny =
    newLeads.length + overdueTasks.length +
    viewingsToday.length + tasksDueToday.length +
    mandateRenewals.length > 0;

  const TASK_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    call_seller: 'call-outline', viewing: 'eye-outline',
    price_update: 'trending-down-outline', renew_mandate: 'refresh-outline',
    take_photos: 'camera-outline', other: 'checkbox-outline',
  };

  const handlePress = (destination: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(destination as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); router.back(); }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {!hasAny && (
          <View style={styles.emptyWrap}>
            <Ionicons name="checkmark-circle-outline" size={56} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All caught up</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>No notifications right now.</Text>
          </View>
        )}

        {(newLeads.length > 0 || overdueTasks.length > 0) && (
          <Section title="Action Required" color="#EF4444" icon="alert-circle-outline" colors={colors}>
            {newLeads.map(lead => (
              <NotifRow
                key={lead.id}
                icon="person-add-outline"
                iconColor="#8B5CF6"
                title="New lead assigned"
                subtitle={lead.buyerName + (lead.propertyAddress ? ` · ${lead.propertyAddress}` : '')}
                onPress={() => handlePress(`/lead/${lead.id}`)}
                colors={colors}
              />
            ))}
            {overdueTasks.map(task => (
              <NotifRow
                key={task.id}
                icon={TASK_ICONS[task.type] || 'checkbox-outline'}
                iconColor="#EF4444"
                title={task.title}
                subtitle={task.propertyAddress ? task.propertyAddress : 'Overdue task'}
                onPress={() => task.propertyId ? handlePress(`/listing/${task.propertyId}`) : handlePress('/tasks')}
                colors={colors}
              />
            ))}
          </Section>
        )}

        {(viewingsToday.length > 0 || tasksDueToday.length > 0) && (
          <Section title="Today" color={colors.accent} icon="today-outline" colors={colors}>
            {viewingsToday.map(task => (
              <NotifRow
                key={task.id}
                icon="eye-outline"
                iconColor={colors.accent}
                title={task.title}
                subtitle={task.propertyAddress ?? 'Viewing today'}
                onPress={() => task.propertyId ? handlePress(`/listing/${task.propertyId}`) : handlePress('/tasks')}
                colors={colors}
              />
            ))}
            {tasksDueToday.map(task => (
              <NotifRow
                key={task.id}
                icon={TASK_ICONS[task.type] || 'checkbox-outline'}
                iconColor={colors.primary}
                title={task.title}
                subtitle={task.propertyAddress ?? 'Due today'}
                onPress={() => task.propertyId ? handlePress(`/listing/${task.propertyId}`) : handlePress('/tasks')}
                colors={colors}
              />
            ))}
          </Section>
        )}

        {mandateRenewals.length > 0 && (
          <Section title="Upcoming" color={colors.primary} icon="calendar-outline" colors={colors}>
            {mandateRenewals.map(task => (
              <NotifRow
                key={task.id}
                icon="refresh-outline"
                iconColor={colors.primary}
                title={task.title}
                subtitle={task.propertyAddress ? `${task.propertyAddress} · due ${new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Mandate renewal coming up'}
                onPress={() => task.propertyId ? handlePress(`/listing/${task.propertyId}`) : handlePress('/tasks')}
                colors={colors}
              />
            ))}
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, color, icon, colors, children }: {
  title: string; color: string; icon: keyof typeof Ionicons.glyphMap; colors: any; children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={15} color={color} />
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      </View>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function NotifRow({ icon, iconColor, title, subtitle, onPress, colors }: {
  icon: keyof typeof Ionicons.glyphMap; iconColor: string; title: string; subtitle: string; onPress: () => void; colors: any;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  title: { fontSize: 17, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingTop: 20, gap: 24 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCard: {
    borderRadius: 16, borderWidth: 1, overflow: 'hidden',
    ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 }, android: { elevation: 2 } }),
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  rowSub: { fontSize: 12 },
});