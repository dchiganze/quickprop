import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Switch, Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';

interface ToggleRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ icon, label, description, value, onChange }: ToggleRowProps) {
  const colors = useColors();
  return (
    <View style={[tStyles.row, { borderBottomColor: colors.border }]}>
      <View style={[tStyles.icon, { backgroundColor: colors.secondary }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={tStyles.text}>
        <Text style={[tStyles.label, { color: colors.foreground }]}>{label}</Text>
        {description && <Text style={[tStyles.desc, { color: colors.mutedForeground }]}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={v => { Haptics.selectionAsync(); onChange(v); }}
        trackColor={{ false: '#CBD5E0', true: '#10B981' }}
        thumbColor="#FFF"
      />
    </View>
  );
}

const tStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  label: { fontSize: 15, fontWeight: '500' },
  desc: { fontSize: 12, marginTop: 1 },
});

function SelectRow({ icon, label, value, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={[tStyles.row, { borderBottomColor: colors.border }]} onPress={onPress}>
      <View style={[tStyles.icon, { backgroundColor: colors.secondary }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={[tStyles.label, { color: colors.foreground, flex: 1 }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{value}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
              await deleteAccount();
              router.replace('/login');
            } catch {
              setDeleting(false);
              Alert.alert('Error', 'Could not delete account. Please try again.');
            }
          },
        },
      ],
    );
  };

  const [pushEnabled, setPushEnabled] = useState(true);
  const [newLeadNotif, setNewLeadNotif] = useState(true);
  const [buyerMatchNotif, setBuyerMatchNotif] = useState(true);
  const [viewingReminder, setViewingReminder] = useState(true);
  const [offerNotif, setOfferNotif] = useState(true);
  const [mandateNotif, setMandateNotif] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [highQualityImages, setHighQualityImages] = useState(true);
  const [offlineMode, setOfflineMode] = useState(true);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NOTIFICATIONS</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ToggleRow icon="notifications-outline" label="Push Notifications" description="Enable all push notifications" value={pushEnabled} onChange={setPushEnabled} />
          <ToggleRow icon="person-add-outline" label="New Lead" description="When a buyer enquires on your listing" value={newLeadNotif} onChange={setNewLeadNotif} />
          <ToggleRow icon="target" label="Buyer Match" description="When a new buyer matches your listing" value={buyerMatchNotif} onChange={setBuyerMatchNotif} />
          <ToggleRow icon="eye-outline" label="Viewing Reminders" description="30 minutes before a scheduled viewing" value={viewingReminder} onChange={setViewingReminder} />
          <ToggleRow icon="cash-outline" label="Offer Received" description="When a buyer submits an offer" value={offerNotif} onChange={setOfferNotif} />
          <ToggleRow icon="refresh-circle-outline" label="Mandate Expiring" description="7 days before mandate expiry" value={mandateNotif} onChange={setMandateNotif} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SECURITY</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ToggleRow icon="finger-print-outline" label="Biometric Login" description="Use Face ID or Touch ID to sign in" value={biometric} onChange={setBiometric} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>APPEARANCE</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ToggleRow icon="moon-outline" label="Dark Mode" value={darkMode} onChange={setDarkMode} />
          <SelectRow icon="language-outline" label="Language" value="English" onPress={() => {}} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MEDIA & STORAGE</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ToggleRow icon="camera-outline" label="High Quality Images" description="Upload full resolution (uses more data)" value={highQualityImages} onChange={setHighQualityImages} />
          <SelectRow icon="cloud-upload-outline" label="Image Quality" value={highQualityImages ? 'High (Original)' : 'Compressed'} onPress={() => {}} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>OFFLINE</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ToggleRow icon="wifi-outline" label="Offline Mode" description="Cache listings and sync when online" value={offlineMode} onChange={setOfflineMode} />
          <SelectRow icon="folder-outline" label="Offline Storage Used" value="84 MB" onPress={() => {}} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PRIVACY</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SelectRow icon="shield-outline" label="Privacy Policy" value="" onPress={() => {}} />
          <SelectRow icon="document-text-outline" label="Terms of Service" value="" onPress={() => {}} />
          <SelectRow icon="trash-outline" label="Clear Cache" value="84 MB" onPress={() => {}} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SUPPORT</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SelectRow icon="help-circle-outline" label="Help Centre" value="" onPress={() => {}} />
          <SelectRow icon="chatbubble-outline" label="Contact Support" value="" onPress={() => {}} />
          <SelectRow icon="star-outline" label="Rate the App" value="" onPress={() => {}} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DANGER ZONE</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: '#EF4444' + '40' }]}>
          <TouchableOpacity
            style={[tStyles.row, { borderBottomColor: 'transparent' }]}
            onPress={handleDeleteAccount}
            disabled={deleting}
            activeOpacity={0.7}
          >
            <View style={[tStyles.icon, { backgroundColor: '#EF444415' }]}>
              {deleting
                ? <ActivityIndicator size="small" color="#EF4444" />
                : <Ionicons name="person-remove-outline" size={18} color="#EF4444" />}
            </View>
            <View style={tStyles.text}>
              <Text style={[tStyles.label, { color: '#EF4444' }]}>Delete Account</Text>
              <Text style={[tStyles.desc, { color: colors.mutedForeground }]}>
                Permanently removes your account and all data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>QuickProp Agent v1.0.0 — Build 100</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
  section: {
    marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden',
    ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 }, android: { elevation: 2 } }),
  },
  version: { textAlign: 'center', fontSize: 12, marginTop: 24, marginBottom: 8 },
});
