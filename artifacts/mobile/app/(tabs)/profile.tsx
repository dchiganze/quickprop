import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert,
  Modal, TextInput, Switch, Linking, Pressable, Appearance, ActivityIndicator,
} from 'react-native';
import { CatalogueBrochureSheet } from '@/components/BrochureSheet';
import { ShareHubSheet } from '@/components/ShareHubSheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';

const BIOMETRIC_KEY = '@qp_biometric';
const DARK_MODE_KEY = '@qp_dark_mode';
const SUPPORT_EMAIL = 'info@melios.co.zw';
const SUPPORT_PHONE = '+2637881999908';

/* ─── Row components ─── */

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
  rightElement?: React.ReactNode;
}

function Row({ icon, label, value, onPress, destructive, chevron = true, rightElement }: RowProps) {
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
        {rightElement ?? (
          <>
            {value && <Text style={[styles.rowValue, { color: colors.mutedForeground }]} numberOfLines={1}>{value}</Text>}
            {chevron && onPress && <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

/* ─── Edit Modal ─── */
interface EditModalProps {
  visible: boolean;
  title: string;
  fields: { label: string; value: string; onChange: (v: string) => void; keyboardType?: 'default' | 'email-address' | 'phone-pad' }[];
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
}

function EditModal({ visible, title, fields, onCancel, onSave, saving }: EditModalProps) {
  const colors = useColors();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={em.backdrop} onPress={onCancel}>
        <Pressable style={[em.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          <View style={[em.handle, { backgroundColor: colors.border }]} />
          <View style={em.headerRow}>
            <Text style={[em.title, { color: colors.foreground }]}>{title}</Text>
            <TouchableOpacity onPress={onCancel} style={[em.closeBtn, { backgroundColor: colors.muted }]}>
              <Ionicons name="close" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {fields.map(f => (
            <View key={f.label} style={{ marginBottom: 16 }}>
              <Text style={[em.fieldLabel, { color: colors.mutedForeground }]}>{f.label.toUpperCase()}</Text>
              <TextInput
                style={[em.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
                value={f.value}
                onChangeText={f.onChange}
                keyboardType={f.keyboardType ?? 'default'}
                autoCapitalize={f.keyboardType === 'email-address' ? 'none' : 'words'}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          ))}
          <TouchableOpacity
            style={[em.saveBtn, { backgroundColor: saving ? colors.muted : colors.primary }]}
            onPress={onSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#FFF" />
              : <><Ionicons name="checkmark" size={18} color="#FFF" /><Text style={em.saveBtnText}>Save</Text></>
            }
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const em = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 44 : 28, paddingTop: 12,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  closeBtn: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginBottom: 8 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 15, marginTop: 4 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});

/* ─── About Modal ─── */
function AboutModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={em.backdrop} onPress={onClose}>
        <Pressable style={[em.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          <View style={[em.handle, { backgroundColor: colors.border }]} />
          <View style={{ alignItems: 'center', paddingVertical: 16, gap: 8 }}>
            <View style={[ab.iconWrap, { backgroundColor: colors.primary }]}>
              <Ionicons name="home" size={32} color="#FFF" />
            </View>
            <Text style={[ab.appName, { color: colors.foreground }]}>QuickProp Agent</Text>
            <Text style={[ab.version, { color: colors.mutedForeground }]}>Version 1.0.0 · Build 77</Text>
            <Text style={[ab.tagline, { color: colors.mutedForeground }]}>
              Zimbabwe's premier property management platform for estate agents.
            </Text>
            <View style={[ab.divider, { backgroundColor: colors.border }]} />
            <TouchableOpacity onPress={() => Linking.openURL('https://quickprop.melios.co.zw')}>
              <Text style={[ab.link, { color: colors.primary }]}>quickprop.melios.co.zw</Text>
            </TouchableOpacity>
            <Text style={[ab.copy, { color: colors.mutedForeground }]}>© 2026 QuickProp (Pvt) Ltd</Text>
          </View>
          <TouchableOpacity
            style={[em.saveBtn, { backgroundColor: colors.muted, marginTop: 8 }]}
            onPress={onClose}
          >
            <Text style={[em.saveBtnText, { color: colors.foreground }]}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const ab = StyleSheet.create({
  iconWrap: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  appName: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  version: { fontSize: 13 },
  tagline: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  divider: { width: '100%', height: 1, marginVertical: 8 },
  link: { fontSize: 15, fontWeight: '600' },
  copy: { fontSize: 12 },
});

/* ─── Main Screen ─── */
export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser } = useAuth();
  const { properties, leads } = useData();

  // Sheet visibility
  const [brochureOpen, setBrochureOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Edit personal info
  const [editPersonalOpen, setEditPersonalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingPersonal, setSavingPersonal] = useState(false);

  // Edit phone
  const [editPhoneOpen, setEditPhoneOpen] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  // Toggles
  const [biometric, setBiometric] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([BIOMETRIC_KEY, DARK_MODE_KEY]).then(pairs => {
      const bio = pairs.find(p => p[0] === BIOMETRIC_KEY)?.[1];
      const dark = pairs.find(p => p[0] === DARK_MODE_KEY)?.[1];
      if (bio !== null && bio !== undefined) setBiometric(bio === 'true');
      if (dark !== null && dark !== undefined) setDarkMode(dark === 'true');
    });
  }, []);

  const activeListings = properties.filter(p => p.status === 'published' && p.agentId === user?.id).length;
  const soldListings = properties.filter(p => p.status === 'sold' && p.agentId === user?.id).length;
  const myLeads = leads.filter(l => !['completed', 'lost'].includes(l.stage)).length;

  const openEditPersonal = () => {
    setEditName(user?.name ?? '');
    setEditEmail(user?.email ?? '');
    setEditPersonalOpen(true);
  };

  const handleSavePersonal = async () => {
    if (!editName.trim()) { Alert.alert('Name required'); return; }
    setSavingPersonal(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateUser({ name: editName.trim(), email: editEmail.trim() });
    setSavingPersonal(false);
    setEditPersonalOpen(false);
  };

  const openEditPhone = () => {
    setEditPhone(user?.phone ?? '');
    setEditPhoneOpen(true);
  };

  const handleSavePhone = async () => {
    if (!editPhone.trim()) { Alert.alert('Phone required'); return; }
    setSavingPhone(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateUser({ phone: editPhone.trim() });
    setSavingPhone(false);
    setEditPhoneOpen(false);
  };

  const handleBiometric = async (val: boolean) => {
    await Haptics.selectionAsync();
    setBiometric(val);
    await AsyncStorage.setItem(BIOMETRIC_KEY, String(val));
  };

  const handleDarkMode = async (val: boolean) => {
    await Haptics.selectionAsync();
    setDarkMode(val);
    await AsyncStorage.setItem(DARK_MODE_KEY, String(val));
    Appearance.setColorScheme(val ? 'dark' : 'light');
  };

  const handleSupport = () => {
    Alert.alert('Help & Support', 'How would you like to reach us?', [
      {
        text: 'Email Us',
        onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=QuickProp Agent Support`),
      },
      {
        text: 'Call Us',
        onPress: () => Linking.openURL(`tel:${SUPPORT_PHONE}`),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleLogout = () => {
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
        <Row icon="person-outline" label="Personal Info" value={user?.email} onPress={openEditPersonal} />
        <Row icon="call-outline" label="Phone Number" value={user?.phone} onPress={openEditPhone} />
        <Row icon="business-outline" label="Agency" value={user?.agency} onPress={() => {}} />
      </View>

      {/* Settings */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SETTINGS</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Row icon="settings-outline" label="App Settings" onPress={() => router.push('/settings')} />
        <Row icon="notifications-outline" label="Notifications" onPress={() => router.push('/settings')} />
        <Row
          icon="finger-print-outline"
          label="Biometric Login"
          chevron={false}
          rightElement={
            <Switch
              value={biometric}
              onValueChange={handleBiometric}
              trackColor={{ false: '#CBD5E0', true: colors.primary }}
              thumbColor="#FFF"
            />
          }
        />
        <Row
          icon="moon-outline"
          label="Dark Mode"
          chevron={false}
          rightElement={
            <Switch
              value={darkMode}
              onValueChange={handleDarkMode}
              trackColor={{ false: '#CBD5E0', true: colors.primary }}
              thumbColor="#FFF"
            />
          }
        />
      </View>

      {/* Catalogue */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CATALOGUE</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Row
          icon="share-outline"
          label="Share My Catalogue"
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setShareOpen(true); }}
        />
        <Row
          icon="document-text-outline"
          label="Generate PDF Brochure"
          onPress={() => setBrochureOpen(true)}
        />
      </View>

      {/* Support */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SUPPORT</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Row icon="help-circle-outline" label="Help & Support" onPress={handleSupport} />
        <Row icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => {}} />
        <Row icon="information-circle-outline" label="About QuickProp" onPress={() => setAboutOpen(true)} />
      </View>

      {/* Sign Out */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Row icon="log-out-outline" label="Sign Out" onPress={handleLogout} destructive chevron={false} />
      </View>

      <Text style={[styles.version, { color: colors.mutedForeground }]}>QuickProp Agent v1.0.0 · Build 77</Text>

      {/* Sheets & Modals */}
      <CatalogueBrochureSheet visible={brochureOpen} onClose={() => setBrochureOpen(false)} />
      <ShareHubSheet visible={shareOpen} onClose={() => setShareOpen(false)} />
      <AboutModal visible={aboutOpen} onClose={() => setAboutOpen(false)} />

      <EditModal
        visible={editPersonalOpen}
        title="Personal Info"
        fields={[
          { label: 'Full Name', value: editName, onChange: setEditName },
          { label: 'Email Address', value: editEmail, onChange: setEditEmail, keyboardType: 'email-address' },
        ]}
        onCancel={() => setEditPersonalOpen(false)}
        onSave={handleSavePersonal}
        saving={savingPersonal}
      />

      <EditModal
        visible={editPhoneOpen}
        title="Phone Number"
        fields={[
          { label: 'Phone Number', value: editPhone, onChange: setEditPhone, keyboardType: 'phone-pad' },
        ]}
        onCancel={() => setEditPhoneOpen(false)}
        onSave={handleSavePhone}
        saving={savingPhone}
      />
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
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 180 },
  rowValue: { fontSize: 13, maxWidth: 140 },
  version: { textAlign: 'center', fontSize: 12, marginTop: 8, marginBottom: 16 },
});
