import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert,
} from 'react-native';
import { CatalogueBrochureSheet } from '@/components/BrochureSheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useNavigation } from 'expo-router';
import { NavigationFlags } from '@/utils/navigationFlags';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { StatCard } from '@/components/StatCard';
import { PropertyCard } from '@/components/PropertyCard';
import { QuickShareSheet } from '@/components/QuickShareSheet';

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const { properties, leads, tasks } = useData();
  const [shareOpen, setShareOpen] = useState(false);
  const [brochureOpen, setBrochureOpen] = useState(false);

  const activeListings = properties.filter(p => p.status === 'published').length;
  const draftListings = properties.filter(p => p.status === 'draft').length;
  const activeLeads = leads.filter(l => !['completed', 'lost'].includes(l.stage)).length;
  const newLeads = leads.filter(l => l.stage === 'new').length;
  const todayStr = new Date().toDateString();
  const pendingTasks = tasks.filter(t => !t.completed);
  const viewingsToday = pendingTasks.filter(t => t.type === 'viewing' && new Date(t.dueDate).toDateString() === todayStr).length;
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const dueTasks = pendingTasks.filter(t => new Date(t.dueDate) <= endOfToday);
  const overdueTasks = dueTasks.filter(t => new Date(t.dueDate) < now).length;
  const todayTasks = tasks.filter(t => !t.completed && new Date(t.dueDate).toDateString() === todayStr);
  const recentProperties = [...properties].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 3);

  const firstName = user?.name.split(' ')[0] ?? 'Agent';
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const TASK_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    call_seller: 'call-outline', viewing: 'eye-outline',
    price_update: 'trending-down-outline', renew_mandate: 'refresh-outline',
    take_photos: 'camera-outline', other: 'checkbox-outline',
  };

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const QUICK_ACTIONS = [
    { label: 'New Listing', icon: 'add-circle' as const, accent: true, onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); router.push('/new-listing'); } },
    { label: 'Search Inventory', icon: 'search-outline' as const, accent: false, onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); router.push('/(tabs)/listings'); } },
    { label: 'Share Catalogue', icon: 'share-outline' as const, accent: true, onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setShareOpen(true); } },
    { label: 'Generate Brochure', icon: 'document-text-outline' as const, accent: false, onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setBrochureOpen(true); } },
  ];

  return (
    <>
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16),
          paddingBottom: insets.bottom + 100,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{dateStr}</Text>
          <Text style={[styles.name, { color: colors.foreground }]}>Welcome back, {firstName}</Text>
        </View>
        <TouchableOpacity
          style={[styles.notifBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); NavigationFlags.notificationsFromDashboard = true; navigation.getParent()?.navigate('notifications' as never); }}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.foreground} />
          {newLeads > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={styles.badgeText}>{newLeads}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Today's Overview</Text>
      <View style={styles.statsRow}>
        <StatCard label="Active Listings" value={activeListings} icon="business-outline" color={colors.primary} subtitle={draftListings > 0 ? `${draftListings} drafts` : undefined} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); router.push('/(tabs)/listings'); }} />
        <StatCard label="Active Leads" value={activeLeads} icon="people-outline" color="#8B5CF6" subtitle={newLeads > 0 ? `${newLeads} new` : undefined} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); router.push('/(tabs)/leads'); }} />
      </View>
      <View style={[styles.statsRow, { marginTop: 10 }]}>
        <StatCard label="Viewings Today" value={viewingsToday} icon="eye-outline" color={colors.accent} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          NavigationFlags.tasksFilter = 'viewing';
          NavigationFlags.tasksDateScope = 'today';
          NavigationFlags.tasksTitle = 'Viewings Today';
          router.navigate({ pathname: '/(tabs)/tasks', params: { filter: 'viewing', dateScope: 'today', title: 'Viewings Today', _t: String(Date.now()) } });
        }} />
        <StatCard label="Tasks Due" value={dueTasks.length} icon="time-outline" color={overdueTasks > 0 ? colors.destructive : colors.mutedForeground} subtitle={overdueTasks > 0 ? `${overdueTasks} overdue` : 'On track'} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          NavigationFlags.tasksFilter = 'due';
          NavigationFlags.tasksDateScope = null;
          NavigationFlags.tasksTitle = 'Tasks Due';
          router.navigate({ pathname: '/(tabs)/tasks', params: { filter: 'due', title: 'Tasks Due', _t: String(Date.now()) } });
        }} />
      </View>

      {/* Quick Actions — 2×2 grid, nudged down 9px */}
      <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 31 }]}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={[
              styles.actionCard,
              {
                backgroundColor: action.accent ? colors.primary : colors.card,
                borderColor: action.accent ? colors.primary : colors.border,
                shadowColor: colors.foreground,
              },
            ]}
            onPress={action.onPress}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIcon, { backgroundColor: action.accent ? 'rgba(255,255,255,0.2)' : colors.secondary }]}>
              <Ionicons name={action.icon} size={18} color={action.accent ? '#FFF' : colors.primary} />
            </View>
            <Text style={[styles.actionLabel, { color: action.accent ? '#FFF' : colors.foreground }]} numberOfLines={2}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Today's Tasks */}
      {todayTasks.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Today's Tasks</Text>
            <Text style={[styles.seeAll, { color: colors.primary }]}>{todayTasks.length} tasks</Text>
          </View>
          <View style={[styles.tasksCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {todayTasks.map((task, i) => (
              <TouchableOpacity
                key={task.id}
                style={[styles.taskRow, i < todayTasks.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); router.push(`/task/${task.id}`); }}
              >
                <View style={[styles.taskIcon, { backgroundColor: colors.secondary }]}>
                  <Ionicons name={TASK_ICONS[task.type] || 'checkbox-outline'} size={16} color={colors.primary} />
                </View>
                <View style={styles.taskInfo}>
                  <Text style={[styles.taskTitle, { color: colors.foreground }]} numberOfLines={1}>{task.title}</Text>
                  {task.propertyAddress && (
                    <Text style={[styles.taskSub, { color: colors.mutedForeground }]} numberOfLines={1}>{task.propertyAddress}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Recent Listings */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Recent Listings</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/listings')}>
          <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
        </TouchableOpacity>
      </View>
      {recentProperties.map(p => (
        <PropertyCard key={p.id} property={p} onPress={() => router.push(`/listing/${p.id}`)} />
      ))}

      {/* Sign Out */}
      <TouchableOpacity
        style={[styles.signOutBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={handleSignOut}
        activeOpacity={0.75}
      >
        <View style={[styles.signOutIcon, { backgroundColor: colors.destructive + '12' }]}>
          <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
        </View>
        <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>

    <QuickShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} />
    <CatalogueBrochureSheet visible={brochureOpen} onClose={() => setBrochureOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  greeting: { fontSize: 13, fontWeight: '500', marginBottom: 3 },
  name: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  notifBtn: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 4 }, android: { elevation: 2 } }),
  },
  badge: {
    position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12, letterSpacing: -0.3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 22 },
  seeAll: { fontSize: 14, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10 },

  // 2×2 Quick Actions grid
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  actionCard: {
    width: '47.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  actionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 17 },

  tasksCard: {
    borderRadius: 16, borderWidth: 1,
    ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 }, android: { elevation: 2 } }),
    marginBottom: 4,
  },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  taskIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  taskSub: { fontSize: 12 },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 24,
  },
  signOutIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  signOutText: { fontSize: 15, fontWeight: '600' },
});
