import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert, RefreshControl, Image,
} from 'react-native';
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
import { useMatchNotifications } from '@/hooks/useMatchNotifications';
import { useGetAgentContacts } from '@workspace/api-client-react';

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const { properties, leads, syncNow } = useData();
  const { data: sellers } = useGetAgentContacts({ type: 'seller' });
  const { data: landlords } = useGetAgentContacts({ type: 'landlord' });
  const matchInbox = useMatchNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const refreshRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!refreshing) {
      refreshRotation.stopAnimation();
      refreshRotation.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(refreshRotation, {
        toValue: 1,
        duration: 750,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [refreshing, refreshRotation]);

  const refreshRotationDegrees = refreshRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleRefresh = async () => {
    if (refreshing) return;
    const startedAt = Date.now();
    setRefreshing(true);
    try {
      await Promise.all([syncNow(), matchInbox.refetch()]);
    } finally {
      const remainingIndicatorTime = 850 - (Date.now() - startedAt);
      if (remainingIndicatorTime > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, remainingIndicatorTime));
      }
      setRefreshing(false);
    }
  };

  const activeListings = properties.filter(p => p.status === 'published').length;
  const draftListings = properties.filter(p => p.status === 'draft').length;
  const activeLeads = leads.filter(l => !['completed', 'lost'].includes(l.stage)).length;
  const newLeads = leads.filter(l => l.stage === 'new').length;
  const recentProperties = [...properties].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 3);


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
    { label: 'Share Brochure', icon: 'share-outline' as const, accent: true, onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); router.push('/brochure'); } },
    { label: 'Upcoming Viewings', icon: 'calendar-outline' as const, accent: false, onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); router.push('/viewings'); } },
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
      alwaysBounceVertical
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.brandRow}>
        <TouchableOpacity
          style={styles.headerProfileBtn}
          onPress={() => router.push('/(tabs)/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          testID="dashboard-profile-button"
        >
          {user?.photo
            ? <Image source={{ uri: user.photo }} style={[styles.headerAvatar, { borderColor: colors.border }]} />
            : <Ionicons name="person-circle-outline" size={28} color={colors.primary} />}
        </TouchableOpacity>
        <View style={styles.brandIdentity}>
          <Image
            source={require('../../assets/images/quickprop-house-logo-green.png')}
            style={styles.brandMark}
            resizeMode="contain"
            accessibilityLabel="QuickProp house logo"
          />
          <Text style={[styles.brandTitle, { color: '#1F956B' }]}>QuickProp Agent</Text>
        </View>
        <TouchableOpacity
          style={[styles.notifBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); NavigationFlags.notificationsFromDashboard = true; navigation.getParent()?.navigate('notifications' as never); }}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={22} color={colors.foreground} />
          {newLeads + matchInbox.unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={styles.badgeText}>{newLeads + matchInbox.unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      {refreshing && (
        <View
          style={[styles.refreshIndicator, { backgroundColor: colors.card, borderColor: colors.border }]}
          accessibilityRole="progressbar"
          accessibilityLabel="Refreshing dashboard"
        >
          <Animated.View style={{ transform: [{ rotate: refreshRotationDegrees }] }}>
            <Ionicons name="refresh" size={16} color={colors.primary} />
          </Animated.View>
          <Text style={[styles.refreshIndicatorText, { color: colors.mutedForeground }]}>
            Refreshing dashboard
          </Text>
        </View>
      )}
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.name, { color: colors.foreground }]}>Hi Agent</Text>
      </View>

      {/* Stats */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Today's Overview</Text>
      <View style={styles.statsRow}>
        <StatCard label="Active Listings" value={activeListings} icon="business-outline" color={colors.primary} subtitle={draftListings > 0 ? `${draftListings} drafts` : undefined} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); router.push('/(tabs)/listings'); }} />
        <StatCard label="Active Leads" value={activeLeads} icon="people-outline" color="#8B5CF6" subtitle={newLeads > 0 ? `${newLeads} new` : undefined} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); router.push('/(tabs)/leads'); }} />
      </View>
      <View style={[styles.statsRow, { marginTop: 10 }]}>
        <StatCard label="Sellers" value={sellers?.length ?? 0} icon="briefcase-outline" color={colors.accent} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push('/contacts/seller');
        }} />
        <StatCard label="Landlords" value={landlords?.length ?? 0} icon="home-outline" color={colors.mutedForeground} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push('/contacts/landlord');
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

      {/* Recent Listings */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Recent Listings</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/listings')}>
          <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
        </TouchableOpacity>
      </View>
      {recentProperties.length > 0
        ? recentProperties.map(p => (
            <PropertyCard key={p.id} property={p} onPress={() => router.push(`/listing/${p.id}`)} />
          ))
        : (
          <View style={[styles.recentEmpty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="home-outline" size={20} color={colors.mutedForeground} />
            <Text style={[styles.recentEmptyText, { color: colors.mutedForeground }]}>No recent listings to show.</Text>
            <TouchableOpacity onPress={() => router.push('/new-listing')} accessibilityRole="button" accessibilityLabel="Create a listing">
              <Text style={[styles.recentEmptyAction, { color: colors.primary }]}>Add listing</Text>
            </TouchableOpacity>
          </View>
        )}

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

    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16 },
  refreshIndicator: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 12,
  },
  refreshIndicatorText: { fontSize: 12, fontWeight: '600' },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerProfileBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1 },
  brandIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  brandMark: { width: 24, height: 24 },
  brandTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800', letterSpacing: -0.3 },
  header: { marginBottom: 22 },
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
  recentEmpty: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  recentEmptyText: { flex: 1, fontSize: 12, fontWeight: '500' },
  recentEmptyAction: { fontSize: 12, fontWeight: '700' },
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

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 24,
  },
  signOutIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  signOutText: { fontSize: 15, fontWeight: '600' },
});
