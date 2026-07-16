import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert,
} from 'react-native';
import { CatalogueBrochureSheet } from '@/components/BrochureSheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
}

function Row({ icon, label, value, onPress, destructive, chevron = true }: RowProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: destructive ? colors.destructive + '15' : colors.secondary }]}>
        <Ionicons name={icon} size={18} color={destructive ? colors.destructive : colors.primary} />
      </View>
      <Text style={[styles.rowLabel, { color: destructive ? colors.destructive : colors.foreground }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>}
        {chevron && onPress && <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />}
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { properties, leads } = useData();
  const [brochureOpen, setBrochureOpen] = useState(false);

  const activeListings = properties.filter(p => p.status === 'published' && p.agentId === user?.id).length;
  const soldListings = properties.filter(p => p.status === 'sold' && p.agentId === user?.id).length;
  const myLeads = leads.filter(l => !['completed', 'lost'].includes(l.stage)).length;

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 20),
        paddingBottom: insets.bottom + 120,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Agent Card */}
      <View style={styles.headerPad}>
        <View style={[styles.agentCard, { backgroundColor: colors.primary }]}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="person" size={40} color="#FFF" />
            </View>
            <View style={[styles.verifiedBadge, { backgroundColor: colors.accent }]}>
              <Ionicons name="checkmark" size={12} color="#FFF" />
            </View>
          </View>
          <Text style={styles.agentName}>{user?.name}</Text>
          <Text style={styles.agentAgency}>{user?.agency}</Text>
          <Text style={styles.agentBranch}>{user?.branch}</Text>
          <View style={styles.licRow}>
            <Ionicons name="id-card-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.licText}>{user?.licenceNumber}</Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{activeListings}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Active</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.accent }]}>{myLeads}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Leads</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: '#8B5CF6' }]}>{soldListings}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Closed</Text>
        </View>
      </View>

      {/* Account */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Row icon="person-outline" label="Personal Info" value={user?.email} onPress={() => {}} />
        <Row icon="call-outline" label="Phone Number" value={user?.phone} onPress={() => {}} />
        <Row icon="business-outline" label="Agency" value={user?.agency} onPress={() => {}} />
      </View>

      {/* Settings */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SETTINGS</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Row icon="settings-outline" label="App Settings" onPress={() => router.push('/settings')} />
        <Row icon="notifications-outline" label="Notifications" onPress={() => router.push('/settings')} />
        <Row icon="finger-print-outline" label="Biometric Login" onPress={() => {}} />
        <Row icon="moon-outline" label="Dark Mode" onPress={() => {}} />
      </View>

      {/* Catalogue */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CATALOGUE</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Row icon="share-outline" label="Share My Catalogue" onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)} />
        <Row icon="document-text-outline" label="Generate PDF Brochure" onPress={() => setBrochureOpen(true)} />
        <Row icon="qr-code-outline" label="My QR Code" onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)} />
      </View>

      {/* Support */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SUPPORT</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Row icon="help-circle-outline" label="Help & Support" onPress={() => {}} />
        <Row icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => {}} />
        <Row icon="information-circle-outline" label="About QuickProp" onPress={() => {}} />
      </View>

      {/* Sign Out */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Row icon="log-out-outline" label="Sign Out" onPress={handleLogout} destructive chevron={false} />
      </View>

      <Text style={[styles.version, { color: colors.mutedForeground }]}>QuickProp Agent v1.0.0</Text>
      <CatalogueBrochureSheet visible={brochureOpen} onClose={() => setBrochureOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerPad: { paddingHorizontal: 16, marginBottom: 16 },
  agentCard: {
    borderRadius: 20, padding: 24, alignItems: 'center', gap: 4,
    ...Platform.select({ ios: { shadowColor: '#1A3C6E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 }, android: { elevation: 6 } }),
  },
  avatarWrap: { position: 'relative', marginBottom: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  verifiedBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1A3C6E' },
  agentName: { color: '#FFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  agentAgency: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  agentBranch: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  licRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  licText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  statsCard: {
    marginHorizontal: 16, borderRadius: 16, borderWidth: 1,
    flexDirection: 'row', marginBottom: 24,
    ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 }, android: { elevation: 2 } }),
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statValue: { fontSize: 26, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 12, fontWeight: '500' },
  statDivider: { width: 1 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginHorizontal: 16, marginBottom: 8 },
  section: {
    marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 20,
    ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 }, android: { elevation: 2 } }),
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 13, maxWidth: 160 },
  version: { textAlign: 'center', fontSize: 12, marginTop: 8, marginBottom: 16 },
});
