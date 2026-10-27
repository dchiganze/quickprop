import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Switch, Linking, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth, apiBaseUrl } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  deactivateListingHousekeepingPushToken,
  getListingHousekeepingPreferences,
  registerListingHousekeepingPushToken,
  updateListingHousekeepingPreferences,
} from '@workspace/api-client-react';
import {
  PUSH_TOKEN_STORAGE_KEY,
  registerForPushNotificationsAsync,
} from '@/utils/pushNotifications';

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
  const { user } = useAuth();

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [reminderPreferences, setReminderPreferences] = useState({
    whatsappEnabled: true,
    pushEnabled: true,
    emailEnabled: true,
    viewingReminderEnabled: true,
    reminderFrequency: 'smart',
  });
  const [reminderPreferencesLoading, setReminderPreferencesLoading] = useState(false);
  const [newLeadNotif, setNewLeadNotif] = useState(true);
  const [buyerMatchNotif, setBuyerMatchNotif] = useState(true);
  const [offerNotif, setOfferNotif] = useState(true);
  const [mandateNotif, setMandateNotif] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [highQualityImages, setHighQualityImages] = useState(true);
  const [offlineMode, setOfflineMode] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.getPermissionsAsync()
      .then((permissions) => setPushEnabled(permissions.granted))
      .catch(() => setPushEnabled(false));
  }, []);

  const persistReminderPreferences = async (next: typeof reminderPreferences) => {
    setReminderPreferences(next);
    if (!apiBaseUrl || !user || !/^\d+$/.test(user.id)) return;
    setReminderPreferencesLoading(true);
    try {
      await updateListingHousekeepingPreferences(next);
    } catch {
      Alert.alert('Unable to save notification settings', 'Your change will be tried again the next time you open Settings.');
    } finally {
      setReminderPreferencesLoading(false);
    }
  };

  useEffect(() => {
    if (!apiBaseUrl || !user || !/^\d+$/.test(user.id)) return;
    getListingHousekeepingPreferences()
      .then((preferences) => {
        setReminderPreferences({
          whatsappEnabled: preferences.whatsappEnabled,
          pushEnabled: preferences.pushEnabled,
          emailEnabled: preferences.emailEnabled,
          viewingReminderEnabled: preferences.viewingReminderEnabled,
          reminderFrequency: preferences.reminderFrequency,
        });
      })
      .catch(() => {});
  }, [user]);

  const setNativePushEnabled = async (enabled: boolean) => {
    if (Platform.OS === 'web') {
      setPushEnabled(enabled);
      return;
    }

    if (!enabled) {
      setPushEnabled(false);
      const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
      if (token && apiBaseUrl) {
        await deactivateListingHousekeepingPushToken({ token, platform: Platform.OS }).catch(() => {});
      }
      return;
    }

    setPushLoading(true);
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) {
        setPushEnabled(false);
        const permissions = await Notifications.getPermissionsAsync();
        if (permissions.status === 'denied' && !permissions.canAskAgain) {
          Alert.alert(
            'Notifications are turned off',
            'Enable notifications for QuickProp Agent in your device settings.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => { Linking.openSettings().catch(() => {}); } },
            ],
          );
        }
        return;
      }
      if (apiBaseUrl && user) {
        await registerListingHousekeepingPushToken({ token, platform: Platform.OS });
      }
      await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
      setPushEnabled(true);
    } catch {
      setPushEnabled(false);
      Alert.alert('Unable to enable notifications', 'Please try again on this device.');
    } finally {
      setPushLoading(false);
    }
  };

  const setReminderChannel = (channel: 'whatsappEnabled' | 'pushEnabled' | 'emailEnabled', enabled: boolean) => {
    const next = { ...reminderPreferences, [channel]: enabled };
    void persistReminderPreferences(next);
  };

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
          <ToggleRow icon="notifications-outline" label="Push Notifications" description={pushLoading ? 'Enabling on this device…' : 'Enable alerts from QuickProp Agent'} value={pushEnabled} onChange={(value) => { void setNativePushEnabled(value); }} />
          <ToggleRow icon="person-add-outline" label="New Lead" description="When a buyer enquires on your listing" value={newLeadNotif} onChange={setNewLeadNotif} />
          <ToggleRow icon="locate-outline" label="Buyer Match" description="When a new buyer matches your listing" value={buyerMatchNotif} onChange={setBuyerMatchNotif} />
          <ToggleRow icon="eye-outline" label="Viewing Reminders" description="At 7:30 am on the day of a scheduled viewing" value={reminderPreferences.viewingReminderEnabled} onChange={(value) => persistReminderPreferences({ ...reminderPreferences, viewingReminderEnabled: value })} />
          <ToggleRow icon="cash-outline" label="Offer Received" description="When a buyer submits an offer" value={offerNotif} onChange={setOfferNotif} />
          <ToggleRow icon="refresh-circle-outline" label="Mandate Expiring" description="7 days before mandate expiry" value={mandateNotif} onChange={setMandateNotif} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>LISTING REMINDERS</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ToggleRow icon="logo-whatsapp" label="WhatsApp" description="Due-soon and stale reminders to your mobile number" value={reminderPreferences.whatsappEnabled} onChange={(value) => setReminderChannel('whatsappEnabled', value)} />
          <ToggleRow icon="phone-portrait-outline" label="Push notifications" description="Reminders on your registered QuickProp devices" value={reminderPreferences.pushEnabled} onChange={(value) => setReminderChannel('pushEnabled', value)} />
          <ToggleRow icon="mail-outline" label="Email" description="Reminders sent to your account email" value={reminderPreferences.emailEnabled} onChange={(value) => setReminderChannel('emailEnabled', value)} />
          {reminderPreferencesLoading && <Text style={[styles.saveHint, { color: colors.mutedForeground }]}>Saving notification settings…</Text>}
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
          <SelectRow
            icon="shield-outline"
            label="Privacy Policy"
            value=""
            onPress={() => {
              Linking.openURL('https://quickprop.melios.co.zw/privacy').catch(() => {
                Alert.alert('Unable to open Privacy Policy', 'Please visit quickprop.melios.co.zw/privacy in your browser.');
              });
            }}
          />
          <SelectRow icon="document-text-outline" label="Terms of Service" value="" onPress={() => {}} />
          <SelectRow icon="trash-outline" label="Clear Cache" value="84 MB" onPress={() => {}} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SUPPORT</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SelectRow icon="help-circle-outline" label="Help Centre" value="" onPress={() => {}} />
          <SelectRow icon="chatbubble-outline" label="Contact Support" value="" onPress={() => {}} />
          <SelectRow icon="star-outline" label="Rate the App" value="" onPress={() => {}} />
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>QuickProp Agent v1.0.0 — Build 78</Text>
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
  saveHint: { fontSize: 11, paddingHorizontal: 14, paddingVertical: 10 },
});
