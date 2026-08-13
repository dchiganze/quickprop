import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Platform,
  Pressable, ScrollView, TextInput, Switch, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Property, PropertyAlert, PROPERTY_FEATURES } from '@/types';

type Step = 'list' | 'create' | 'matches';

const TYPE_OPTIONS: { value: Property['type'] | ''; label: string }[] = [
  { value: '', label: 'Any type' },
  { value: 'sale', label: 'For Sale' },
  { value: 'rent', label: 'To Rent' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'stand', label: 'Stand' },
  { value: 'farm', label: 'Farm' },
  { value: 'mine', label: 'Mine' },
];

const BED_OPTIONS = [
  { value: 0, label: 'Any' },
  { value: 1, label: '1+' },
  { value: 2, label: '2+' },
  { value: 3, label: '3+' },
  { value: 4, label: '4+' },
  { value: 5, label: '5+' },
];

const CURRENCY_OPTIONS = ['USD', 'ZiG', 'ZWL'];

const COMMON_FEATURES = [
  'Solar', 'Borehole', 'Swimming Pool', 'Generator',
  'Electric Fence', 'Fibre', 'Staff Quarters', 'Air Conditioning',
  'Alarm System', 'Fitted Kitchen', 'Cottage', 'Fireplace',
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function AlertsSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const { alerts, alertMatches, addAlert, deleteAlert, dismissAlertMatches } = useData();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('list');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<Property['type'] | ''>('');
  const [formSuburb, setFormSuburb] = useState('');
  const [formMinBeds, setFormMinBeds] = useState(0);
  const [formMaxPrice, setFormMaxPrice] = useState('');
  const [formCurrency, setFormCurrency] = useState('USD');
  const [formFeatures, setFormFeatures] = useState<string[]>([]);
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep('list');
      setSelectedAlertId(null);
    }, 400);
  };

  const resetForm = () => {
    setFormName('');
    setFormType('');
    setFormSuburb('');
    setFormMinBeds(0);
    setFormMaxPrice('');
    setFormCurrency('USD');
    setFormFeatures([]);
    setShowAllFeatures(false);
  };

  const goBack = () => {
    if (step === 'create') { resetForm(); setStep('list'); }
    else if (step === 'matches') setStep('list');
  };

  const autoName = (): string => {
    const parts: string[] = [];
    if (formMinBeds > 0) parts.push(`${formMinBeds}+ bed`);
    if (formType) parts.push(formType === 'sale' ? 'for sale' : formType === 'rent' ? 'to rent' : formType);
    if (formSuburb.trim()) parts.push(`in ${formSuburb.trim()}`);
    if (formMaxPrice) parts.push(`up to ${formCurrency} ${Number(formMaxPrice).toLocaleString()}`);
    if (formFeatures.length) parts.push(`with ${formFeatures.slice(0, 2).join(', ')}`);
    return parts.length ? parts.join(' ') : 'New Alert';
  };

  const handleSave = async () => {
    const name = formName.trim() || autoName();
    setSaving(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addAlert({
      agentId: user?.id ?? '',
      name,
      type: formType || undefined,
      suburb: formSuburb.trim() || undefined,
      minBedrooms: formMinBeds > 0 ? formMinBeds : undefined,
      maxPrice: formMaxPrice ? Number(formMaxPrice) : undefined,
      currency: formMaxPrice ? formCurrency : undefined,
      features: formFeatures,
    });
    setSaving(false);
    resetForm();
    setStep('list');
  };

  const handleDelete = (alert: PropertyAlert) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(
      'Delete Alert',
      `Delete "${alert.name}"? You won't receive new matches for this criteria.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteAlert(alert.id) },
      ]
    );
  };

  const handleViewMatches = (alertId: string) => {
    Haptics.selectionAsync();
    setSelectedAlertId(alertId);
    setStep('matches');
  };

  const handleDismissAll = async (alertId: string, propertyIds: string[]) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await dismissAlertMatches(alertId, propertyIds);
    setStep('list');
    setSelectedAlertId(null);
  };

  const toggleFeature = (f: string) => {
    Haptics.selectionAsync();
    setFormFeatures(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    );
  };

  const selectedMatchGroup = alertMatches.find(m => m.alert.id === selectedAlertId);
  const featureList = showAllFeatures ? PROPERTY_FEATURES : COMMON_FEATURES;
  const totalUnseen = alertMatches.reduce((s, m) => s + m.properties.length, 0);

  const inputStyle = [
    s.input,
    { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border },
  ];

  /* ─── RENDER: LIST ─── */
  const renderList = () => (
    <>
      <Text style={[s.title, { color: colors.foreground }]}>Property Alerts</Text>
      <Text style={[s.sub, { color: colors.mutedForeground }]}>
        Get notified when a matching listing is uploaded by any agent.
      </Text>

      {/* New matches banner */}
      {totalUnseen > 0 && (
        <View style={[s.matchBanner, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '30' }]}>
          <View style={[s.matchBannerIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="notifications" size={16} color="#FFF" />
          </View>
          <Text style={[s.matchBannerText, { color: colors.foreground }]}>
            {totalUnseen} new {totalUnseen === 1 ? 'match' : 'matches'} across your alerts
          </Text>
        </View>
      )}

      <ScrollView style={s.listScroll} showsVerticalScrollIndicator={false}>
        {alerts.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={[s.emptyIcon, { backgroundColor: colors.muted }]}>
              <Ionicons name="notifications-outline" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>No alerts yet</Text>
            <Text style={[s.emptyDesc, { color: colors.mutedForeground }]}>
              Create an alert and we'll notify you when a matching property is listed.
            </Text>
          </View>
        ) : (
          alerts.map(alert => {
            const matchGroup = alertMatches.find(m => m.alert.id === alert.id);
            const count = matchGroup?.properties.length ?? 0;
            return (
              <View
                key={alert.id}
                style={[s.alertCard, { backgroundColor: colors.card, borderColor: count > 0 ? colors.primary + '40' : colors.border }]}
              >
                <View style={s.alertCardMain}>
                  <View style={[s.alertIcon, { backgroundColor: count > 0 ? colors.primary + '18' : colors.muted }]}>
                    <Ionicons
                      name={count > 0 ? 'notifications' : 'notifications-outline'}
                      size={18}
                      color={count > 0 ? colors.primary : colors.mutedForeground}
                    />
                  </View>
                  <View style={s.alertInfo}>
                    <Text style={[s.alertName, { color: colors.foreground }]} numberOfLines={1}>{alert.name}</Text>
                    <Text style={[s.alertMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {[
                        alert.type ? (alert.type === 'sale' ? 'For Sale' : alert.type === 'rent' ? 'To Rent' : alert.type) : null,
                        alert.suburb ? alert.suburb : null,
                        alert.minBedrooms ? `${alert.minBedrooms}+ bed` : null,
                        alert.maxPrice ? `≤ ${alert.currency} ${alert.maxPrice.toLocaleString()}` : null,
                        alert.features.length ? alert.features.slice(0, 2).join(', ') : null,
                      ].filter(Boolean).join(' · ') || 'Any property'}
                    </Text>
                  </View>
                  {count > 0 && (
                    <View style={[s.countBadge, { backgroundColor: colors.primary }]}>
                      <Text style={s.countBadgeText}>{count}</Text>
                    </View>
                  )}
                </View>
                <View style={[s.alertCardActions, { borderTopColor: colors.border }]}>
                  {count > 0 ? (
                    <TouchableOpacity
                      style={[s.alertAction, { backgroundColor: colors.primary + '12' }]}
                      onPress={() => handleViewMatches(alert.id)}
                    >
                      <Ionicons name="eye-outline" size={14} color={colors.primary} />
                      <Text style={[s.alertActionText, { color: colors.primary }]}>View {count} match{count !== 1 ? 'es' : ''}</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={s.alertAction}>
                      <Text style={[s.alertActionText, { color: colors.mutedForeground }]}>No new matches</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[s.alertAction, { backgroundColor: colors.destructive + '10' }]}
                    onPress={() => handleDelete(alert)}
                  >
                    <Ionicons name="trash-outline" size={14} color={colors.destructive} />
                    <Text style={[s.alertActionText, { color: colors.destructive }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 12 }} />
      </ScrollView>

      <TouchableOpacity
        style={[s.createBtn, { backgroundColor: colors.primary }]}
        onPress={() => { Haptics.selectionAsync(); setStep('create'); }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={18} color="#FFF" />
        <Text style={s.createBtnText}>Create Alert</Text>
      </TouchableOpacity>
    </>
  );

  /* ─── RENDER: MATCHES ─── */
  const renderMatches = () => {
    const group = selectedMatchGroup;
    if (!group) return null;
    const props = group.properties;
    return (
      <>
        <Text style={[s.title, { color: colors.foreground }]} numberOfLines={1}>{group.alert.name}</Text>
        <Text style={[s.sub, { color: colors.mutedForeground }]}>
          {props.length} new {props.length === 1 ? 'property matches' : 'properties match'} your alert.
        </Text>
        <ScrollView style={s.listScroll} showsVerticalScrollIndicator={false}>
          {props.map(p => (
            <View key={p.id} style={[s.matchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[s.matchIcon, { backgroundColor: colors.primary + '14' }]}>
                <Ionicons name="home-outline" size={18} color={colors.primary} />
              </View>
              <View style={s.matchInfo}>
                <Text style={[s.matchTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {p.bedrooms ? `${p.bedrooms}-bed · ` : ''}{p.suburb}
                </Text>
                <Text style={[s.matchPrice, { color: colors.primary }]}>
                  {p.currency} {p.price.toLocaleString()}{p.type === 'rent' ? '/mo' : ''}
                </Text>
                <Text style={[s.matchRef, { color: colors.mutedForeground }]}>{p.referenceNumber}</Text>
              </View>
            </View>
          ))}
          <View style={{ height: 12 }} />
        </ScrollView>
        <TouchableOpacity
          style={[s.createBtn, { backgroundColor: '#10B981' }]}
          onPress={() => handleDismissAll(group.alert.id, props.map(p => p.id))}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
          <Text style={s.createBtnText}>Mark all as seen</Text>
        </TouchableOpacity>
      </>
    );
  };

  /* ─── RENDER: CREATE ─── */
  const renderCreate = () => (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={[s.title, { color: colors.foreground }]}>New Alert</Text>
      <Text style={[s.sub, { color: colors.mutedForeground }]}>
        We'll notify you when a matching property is uploaded.
      </Text>

      {/* Name */}
      <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>ALERT NAME (optional)</Text>
      <TextInput
        style={inputStyle}
        value={formName}
        onChangeText={setFormName}
        placeholder={autoName()}
        placeholderTextColor={colors.mutedForeground}
      />

      {/* Type */}
      <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginTop: 16 }]}>PROPERTY TYPE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
        {TYPE_OPTIONS.map(opt => {
          const active = formType === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[s.chip, { backgroundColor: active ? colors.primary : colors.muted, borderColor: active ? colors.primary : colors.border }]}
              onPress={() => { Haptics.selectionAsync(); setFormType(opt.value); }}
            >
              <Text style={[s.chipText, { color: active ? '#FFF' : colors.foreground }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Suburb */}
      <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginTop: 16 }]}>SUBURB</Text>
      <TextInput
        style={inputStyle}
        value={formSuburb}
        onChangeText={setFormSuburb}
        placeholder="e.g. Borrowdale, Highlands"
        placeholderTextColor={colors.mutedForeground}
      />

      {/* Bedrooms */}
      <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginTop: 16 }]}>MIN BEDROOMS</Text>
      <View style={s.bedRow}>
        {BED_OPTIONS.map(opt => {
          const active = formMinBeds === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[s.bedChip, { backgroundColor: active ? colors.primary : colors.muted, borderColor: active ? colors.primary : colors.border }]}
              onPress={() => { Haptics.selectionAsync(); setFormMinBeds(opt.value); }}
            >
              <Text style={[s.chipText, { color: active ? '#FFF' : colors.foreground }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Max price */}
      <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginTop: 16 }]}>MAX PRICE</Text>
      <View style={s.priceRow}>
        <View style={s.currencyPicker}>
          {CURRENCY_OPTIONS.map(c => {
            const active = formCurrency === c;
            return (
              <TouchableOpacity
                key={c}
                style={[s.currencyChip, { backgroundColor: active ? colors.primary : colors.muted, borderColor: active ? colors.primary : colors.border }]}
                onPress={() => { Haptics.selectionAsync(); setFormCurrency(c); }}
              >
                <Text style={[s.chipText, { color: active ? '#FFF' : colors.foreground }]}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          style={[inputStyle, s.priceInput]}
          value={formMaxPrice}
          onChangeText={setFormMaxPrice}
          placeholder="Any"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="numeric"
        />
      </View>

      {/* Features */}
      <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginTop: 16 }]}>MUST-HAVE FEATURES</Text>
      <View style={s.featureGrid}>
        {featureList.map(f => {
          const active = formFeatures.includes(f);
          return (
            <TouchableOpacity
              key={f}
              style={[s.featureChip, { backgroundColor: active ? colors.primary + '18' : colors.muted, borderColor: active ? colors.primary : colors.border }]}
              onPress={() => toggleFeature(f)}
            >
              {active && <Ionicons name="checkmark-circle" size={13} color={colors.primary} />}
              <Text style={[s.featureChipText, { color: active ? colors.primary : colors.foreground }]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity onPress={() => setShowAllFeatures(v => !v)} style={s.showMoreBtn}>
        <Text style={[s.showMoreText, { color: colors.primary }]}>
          {showAllFeatures ? 'Show less' : `Show all ${PROPERTY_FEATURES.length} features`}
        </Text>
      </TouchableOpacity>

      {/* Save */}
      <TouchableOpacity
        style={[s.createBtn, { backgroundColor: saving ? colors.muted : colors.primary, marginTop: 20, marginBottom: 8 }]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.85}
      >
        <Ionicons name="notifications-outline" size={18} color="#FFF" />
        <Text style={s.createBtnText}>{saving ? 'Saving…' : 'Create Alert'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Pressable style={s.backdrop} onPress={handleClose}>
        <Pressable style={[s.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          <View style={[s.handle, { backgroundColor: colors.border }]} />

          {/* Header row */}
          <View style={s.headerRow}>
            {step !== 'list' ? (
              <TouchableOpacity onPress={goBack} style={[s.navBtn, { backgroundColor: colors.muted }]}>
                <Ionicons name="arrow-back" size={18} color={colors.foreground} />
              </TouchableOpacity>
            ) : (
              <View style={[s.navBtn, { backgroundColor: colors.muted }]}>
                <Ionicons name="notifications-outline" size={18} color={colors.primary} />
              </View>
            )}
            <TouchableOpacity onPress={handleClose} style={[s.navBtn, { backgroundColor: colors.muted }]}>
              <Ionicons name="close" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {step === 'list' && renderList()}
          {step === 'create' && renderCreate()}
          {step === 'matches' && renderMatches()}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 44 : 28, paddingTop: 12,
    maxHeight: '92%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginBottom: 4 },
  sub: { fontSize: 14, marginBottom: 16, lineHeight: 20 },

  matchBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 14,
  },
  matchBannerIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  matchBannerText: { fontSize: 14, fontWeight: '600', flex: 1 },

  listScroll: { maxHeight: 380 },

  emptyWrap: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyIcon: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },

  alertCard: {
    borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  alertCardMain: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  alertIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  alertInfo: { flex: 1 },
  alertName: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  alertMeta: { fontSize: 12, lineHeight: 16 },
  countBadge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  alertCardActions: { flexDirection: 'row', borderTopWidth: 1 },
  alertAction: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10,
  },
  alertActionText: { fontSize: 12, fontWeight: '600' },

  matchCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8,
  },
  matchIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  matchInfo: { flex: 1 },
  matchTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  matchPrice: { fontSize: 14, fontWeight: '800' },
  matchRef: { fontSize: 12, marginTop: 2 },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 15,
  },
  createBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },

  chipRow: { marginHorizontal: -2 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginHorizontal: 2,
  },
  chipText: { fontSize: 13, fontWeight: '600' },

  bedRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  bedChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },

  priceRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  currencyPicker: { flexDirection: 'row', gap: 6 },
  currencyChip: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  priceInput: { flex: 1 },

  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  featureChipText: { fontSize: 13, fontWeight: '500' },
  showMoreBtn: { alignItems: 'center', paddingVertical: 10 },
  showMoreText: { fontSize: 13, fontWeight: '600' },
});
