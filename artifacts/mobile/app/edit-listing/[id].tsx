import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform,
  TextInput, Switch, Alert, KeyboardAvoidingView, ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';
import { FeatureChip } from '@/components/FeatureChip';
import { PROPERTY_FEATURES, Property } from '@/types';

const CURRENCIES = ['USD', 'ZAR', 'ZWL', 'GBP', 'EUR'];
const PROPERTY_TYPES: Property['type'][] = ['sale', 'rent', 'commercial', 'stand', 'farm', 'mine'];
const STATUSES: Property['status'][] = ['published', 'draft', 'archived', 'sold', 'rented', 'pending'];
const MANDATE_TYPES: Array<'open' | 'sole' | 'exclusive'> = ['open', 'sole', 'exclusive'];

const STATUS_COLORS: Record<Property['status'], string> = {
  published: '#10B981', draft: '#F59E0B', archived: '#64748B',
  sold: '#EF4444', rented: '#8B5CF6', pending: '#3B82F6',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );
}

function Stepper({ value, onChange, min = 0, max = 20 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const colors = useColors();
  return (
    <View style={styles.stepperRow}>
      <TouchableOpacity
        style={[styles.stepBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        onPress={() => { if (value > min) { Haptics.selectionAsync(); onChange(value - 1); } }}
      >
        <Ionicons name="remove" size={18} color={colors.primary} />
      </TouchableOpacity>
      <Text style={[styles.stepVal, { color: colors.foreground }]}>{value}</Text>
      <TouchableOpacity
        style={[styles.stepBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        onPress={() => { if (value < max) { Haptics.selectionAsync(); onChange(value + 1); } }}
      >
        <Ionicons name="add" size={18} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

export default function EditListingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { properties, updateProperty } = useData();
  const property = properties.find(p => p.id === id);
  const [saving, setSaving] = useState(false);

  const [status, setStatus] = useState<Property['status']>(property?.status ?? 'draft');
  const [type, setType] = useState<Property['type']>(property?.type ?? 'sale');
  const [address, setAddress] = useState(property?.address ?? '');
  const [suburb, setSuburb] = useState(property?.suburb ?? '');
  const [showAddress, setShowAddress] = useState(property?.showAddress ?? false);
  const [price, setPrice] = useState(String(property?.price ?? ''));
  const [currency, setCurrency] = useState(property?.currency ?? 'USD');
  const [negotiable, setNegotiable] = useState(property?.negotiable ?? false);
  const [bedrooms, setBedrooms] = useState(property?.bedrooms ?? 3);
  const [bathrooms, setBathrooms] = useState(property?.bathrooms ?? 2);
  const [garages, setGarages] = useState(property?.garages ?? 1);
  const [landSize, setLandSize] = useState(property?.landSize ? String(property.landSize) : '');
  const [floorArea, setFloorArea] = useState(property?.floorArea ? String(property.floorArea) : '');
  const [levies, setLevies] = useState(property?.levies ? String(property.levies) : '');
  const [rates, setRates] = useState(property?.rates ? String(property.rates) : '');
  const [features, setFeatures] = useState<string[]>(property?.features ?? []);
  const [description, setDescription] = useState(property?.description ?? '');
  const [sellerName, setSellerName] = useState(property?.seller.name ?? '');
  const [sellerPhone, setSellerPhone] = useState(property?.seller.phone ?? '');
  const [sellerEmail, setSellerEmail] = useState(property?.seller.email ?? '');
  const [mandateExpiry, setMandateExpiry] = useState(property?.seller.mandateExpiry ?? '');
  const [mandateType, setMandateType] = useState<'open' | 'sole' | 'exclusive'>(property?.seller.mandateType ?? 'sole');
  const [sellerNotes, setSellerNotes] = useState(property?.seller.notes ?? '');
  const [photos, setPhotos] = useState<string[]>(property?.photos ?? []);
  const [collaborationEnabled, setCollaborationEnabled] = useState(Boolean(property?.collaborationEnabled));

  if (!property) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.foreground }}>Property not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleFeature = (f: string) => {
    Haptics.selectionAsync();
    setFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  };

  const handleSave = async () => {
    if (!address.trim() || !suburb.trim() || !price.trim() || Number(price) <= 0 || photos.length === 0) {
      Alert.alert('Required Fields', 'Add at least one photo, then enter an address, suburb, and a valid price.');
      return;
    }
    setSaving(true);
    try {
      await updateProperty(property.id, {
        status, type, address, suburb, showAddress,
        price: parseFloat(price) || 0,
        currency, negotiable, bedrooms, bathrooms, garages,
        landSize: landSize ? parseFloat(landSize) : undefined,
        floorArea: floorArea ? parseFloat(floorArea) : undefined,
        levies: levies ? parseFloat(levies) : undefined,
        rates: rates ? parseFloat(rates) : undefined,
        features, description, photos, collaborationEnabled,
        seller: { name: sellerName, phone: sellerPhone, email: sellerEmail, mandateExpiry, mandateType, notes: sellerNotes },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addPhotos = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled) setPhotos(current => [...current, ...result.assets.map(asset => asset.uri)]);
    } catch (e: any) {
      Alert.alert('Photo Library Error', e?.message ?? 'Could not open the photo library.');
    }
  };

  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }];
  const textAreaStyle = [styles.input, styles.textArea, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }];

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.headerBtn, { backgroundColor: colors.muted }]}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Edit Listing</Text>
          <Text style={[styles.headerRef, { color: colors.mutedForeground }]}>{property.referenceNumber}</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saving ? colors.muted : colors.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Text style={styles.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.flex} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Status */}
          <Text style={[styles.sectionHeading, { color: colors.mutedForeground }]}>STATUS</Text>
          <View style={styles.chipRow}>
            {STATUSES.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.statusChip, { backgroundColor: status === s ? STATUS_COLORS[s] : colors.secondary, borderColor: status === s ? STATUS_COLORS[s] : colors.border }]}
                onPress={() => { Haptics.selectionAsync(); setStatus(s); }}
              >
                <Text style={[styles.statusChipText, { color: status === s ? '#FFF' : colors.foreground }]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionHeading, { color: colors.mutedForeground, marginTop: 20 }]}>PHOTOS</Text>
          <Text style={[styles.mediaHint, { color: colors.mutedForeground }]}>The first photo is used as the main listing image.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {photos.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.photoPreview}>
                <Image source={{ uri }} style={styles.photoImage} />
                {index === 0 && <Text style={styles.mainPhotoLabel}>Main</Text>}
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => setPhotos(current => current.filter((_, photoIndex) => photoIndex !== index))}
                  accessibilityLabel={`Remove photo ${index + 1}`}
                >
                  <Ionicons name="close-circle" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={[styles.addPhoto, { backgroundColor: colors.muted, borderColor: colors.border }]} onPress={addPhotos}>
              <Ionicons name="images-outline" size={24} color={colors.primary} />
              <Text style={[styles.addPhotoText, { color: colors.primary }]}>Add photos</Text>
            </TouchableOpacity>
          </ScrollView>

          <Text style={[styles.sectionHeading, { color: colors.mutedForeground, marginTop: 20 }]}>COLLABORATION</Text>
          <View style={[styles.disclosureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.disclosureTitle, { color: colors.foreground }]}>Open to collaboration</Text>
                <Text style={[styles.disclosureSub, { color: colors.mutedForeground }]}>
                  Other QuickProp agents can find this listing and ask you to collaborate. Seller details remain private.
                </Text>
              </View>
              <Switch value={collaborationEnabled} onValueChange={v => { Haptics.selectionAsync(); setCollaborationEnabled(v); }} trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#FFF" />
            </View>
          </View>

          {/* Location */}
          <Text style={[styles.sectionHeading, { color: colors.mutedForeground, marginTop: 20 }]}>LOCATION</Text>
          <Field label="STREET ADDRESS *">
            <TextInput style={inputStyle} value={address} onChangeText={setAddress} placeholder="14 Acacia Avenue" placeholderTextColor={colors.mutedForeground} />
          </Field>
          <Field label="SUBURB *">
            <TextInput style={inputStyle} value={suburb} onChangeText={setSuburb} placeholder="Borrowdale" placeholderTextColor={colors.mutedForeground} />
          </Field>
          <View style={[styles.disclosureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={showAddress ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.disclosureTitle, { color: colors.foreground }]}>Show exact address publicly</Text>
                <Text style={[styles.disclosureSub, { color: colors.mutedForeground }]}>
                  {showAddress ? 'Full street address visible on website.' : 'Only suburb shown publicly.'}
                </Text>
              </View>
              <Switch value={showAddress} onValueChange={v => { Haptics.selectionAsync(); setShowAddress(v); }} trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#FFF" />
            </View>
          </View>

          {/* Listing type & price */}
          <Text style={[styles.sectionHeading, { color: colors.mutedForeground, marginTop: 20 }]}>PROPERTY DETAILS</Text>
          <Field label="LISTING TYPE *">
            <View style={styles.chipRow}>
              {PROPERTY_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, { backgroundColor: type === t ? colors.primary : colors.secondary, borderColor: type === t ? colors.primary : colors.border }]}
                  onPress={() => { Haptics.selectionAsync(); setType(t); }}
                >
                  <Text style={[styles.typeChipText, { color: type === t ? '#FFF' : colors.foreground }]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>
          <Field label="PRICE *">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.currencyBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={() => setCurrency(CURRENCIES[(CURRENCIES.indexOf(currency) + 1) % CURRENCIES.length])}
                accessibilityLabel="Change currency"
              >
                <Text style={[{ fontSize: 14, fontWeight: '600', color: colors.foreground }]}>{currency}</Text>
                <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TextInput style={[inputStyle, { flex: 1 }]} value={price} onChangeText={setPrice} placeholder="285000" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
            </View>
          </Field>
          <Field label="NEGOTIABLE">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[{ fontSize: 14, color: colors.foreground }]}>Price is negotiable</Text>
              <Switch value={negotiable} onValueChange={setNegotiable} trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#FFF" />
            </View>
          </Field>

          {/* Rooms */}
          <Field label="BEDROOMS">
            <Stepper value={bedrooms} onChange={setBedrooms} />
          </Field>
          <Field label="BATHROOMS">
            <Stepper value={bathrooms} onChange={setBathrooms} />
          </Field>
          <Field label="GARAGES">
            <Stepper value={garages} onChange={setGarages} min={0} />
          </Field>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="LAND SIZE (m²)">
                <TextInput style={inputStyle} value={landSize} onChangeText={setLandSize} placeholder="1200" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="FLOOR AREA (m²)">
                <TextInput style={inputStyle} value={floorArea} onChangeText={setFloorArea} placeholder="380" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              </Field>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="LEVIES/mo">
                <TextInput style={inputStyle} value={levies} onChangeText={setLevies} placeholder="0" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="RATES/mo">
                <TextInput style={inputStyle} value={rates} onChangeText={setRates} placeholder="180" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              </Field>
            </View>
          </View>

          {/* Features */}
          <Text style={[styles.sectionHeading, { color: colors.mutedForeground, marginTop: 8 }]}>FEATURES ({features.length} selected)</Text>
          <View style={styles.featuresWrap}>
            {PROPERTY_FEATURES.map(f => (
              <FeatureChip key={f} label={f} selected={features.includes(f)} onToggle={() => toggleFeature(f)} />
            ))}
          </View>

          {/* Description */}
          <Text style={[styles.sectionHeading, { color: colors.mutedForeground, marginTop: 16 }]}>DESCRIPTION</Text>
          <TextInput
            style={[textAreaStyle, { minHeight: 120 }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the property..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
          />

          {/* Seller */}
          <Text style={[styles.sectionHeading, { color: colors.mutedForeground, marginTop: 16 }]}>SELLER DETAILS — PRIVATE</Text>
          <View style={[styles.privateNote, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={13} color={colors.primary} />
            <Text style={[{ fontSize: 12, color: colors.mutedForeground }]}>Never visible to the public.</Text>
          </View>
          <Field label="SELLER NAME">
            <TextInput style={inputStyle} value={sellerName} onChangeText={setSellerName} placeholder="Robert Chikwanda" placeholderTextColor={colors.mutedForeground} />
          </Field>
          <Field label="PHONE">
            <TextInput style={inputStyle} value={sellerPhone} onChangeText={setSellerPhone} placeholder="+263 77 123 4567" placeholderTextColor={colors.mutedForeground} keyboardType="phone-pad" />
          </Field>
          <Field label="EMAIL">
            <TextInput style={inputStyle} value={sellerEmail} onChangeText={setSellerEmail} placeholder="seller@email.com" placeholderTextColor={colors.mutedForeground} keyboardType="email-address" autoCapitalize="none" />
          </Field>
          <Field label="MANDATE EXPIRY">
            <TextInput style={inputStyle} value={mandateExpiry} onChangeText={setMandateExpiry} placeholder="2025-12-31" placeholderTextColor={colors.mutedForeground} />
          </Field>
          <Field label="MANDATE TYPE">
            <View style={styles.chipRow}>
              {MANDATE_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, { backgroundColor: mandateType === t ? colors.primary : colors.secondary, borderColor: mandateType === t ? colors.primary : colors.border }]}
                  onPress={() => { Haptics.selectionAsync(); setMandateType(t); }}
                >
                  <Text style={[styles.typeChipText, { color: mandateType === t ? '#FFF' : colors.foreground }]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>
          <Field label="INTERNAL NOTES">
            <TextInput
              style={[textAreaStyle, { minHeight: 80 }]}
              value={sellerNotes}
              onChangeText={setSellerNotes}
              placeholder="Seller motivation, negotiation notes, viewing instructions..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
            />
          </Field>

          {/* Save button at bottom */}
          <TouchableOpacity
            style={[styles.saveBottom, { backgroundColor: saving ? colors.muted : colors.primary }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#FFF" />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
                  <Text style={styles.saveBottomText}>Save Changes</Text>
                </>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  headerBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerRef: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 12, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  sectionHeading: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
  field: { gap: 8, marginBottom: 16 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textArea: { minHeight: 100 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  statusChipText: { fontSize: 13, fontWeight: '600' },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  typeChipText: { fontSize: 13, fontWeight: '600' },
  disclosureCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 },
  disclosureTitle: { fontSize: 14, fontWeight: '600' },
  disclosureSub: { fontSize: 12, marginTop: 2 },
  currencyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontSize: 20, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  featuresWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  privateNote: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 14 },
  mediaHint: { fontSize: 12, marginTop: -6, marginBottom: 10 },
  photoRow: { gap: 10, paddingBottom: 8 },
  photoPreview: { width: 112, height: 88, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoImage: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: '#00000066', borderRadius: 14 },
  mainPhotoLabel: { position: 'absolute', bottom: 4, left: 4, color: '#FFF', backgroundColor: '#00000099', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, fontSize: 10, fontWeight: '700' },
  addPhoto: { width: 112, height: 88, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  addPhotoText: { fontSize: 11, fontWeight: '700' },
  saveBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 15, marginTop: 8 },
  saveBottomText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
