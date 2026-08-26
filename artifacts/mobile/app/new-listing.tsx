import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform,
  TextInput, Switch, Alert, KeyboardAvoidingView, ActivityIndicator, Image,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { FeatureChip } from '@/components/FeatureChip';
import { StepIndicator } from '@/components/StepIndicator';
import { PROPERTY_FEATURES, Property } from '@/types';

const TOTAL_STEPS = 10;
const STEP_LABELS = [
  'Photos', 'Video', 'Location', 'Listing Type', 'Property Details',
  'Features', 'Description', 'Seller Details', 'Collaboration', 'Review & Publish',
];

const CURRENCIES = ['USD', 'ZAR', 'ZWL', 'GBP', 'EUR'];
const MANDATE_TYPES: Array<'open' | 'sole' | 'exclusive'> = ['open', 'sole', 'exclusive'];

interface FormData {
  photos: string[];
  videoUri: string;
  address: string;
  suburb: string;
  showAddress: boolean;
  type: Property['type'] | null;
  price: string;
  currency: string;
  negotiable: boolean;
  bedrooms: number;
  bathrooms: number;
  garages: number;
  landSize: string;
  floorArea: string;
  levies: string;
  rates: string;
  referenceNumber: string;
  features: string[];
  description: string;
  sellerName: string;
  sellerPhone: string;
  sellerEmail: string;
  mandateExpiry: string;
  mandateType: 'open' | 'sole' | 'exclusive';
  sellerNotes: string;
  collaborationEnabled: boolean;
}

const defaultForm: FormData = {
  photos: [], videoUri: '', address: '', suburb: '', showAddress: false,
  type: null, price: '', currency: 'USD', negotiable: false,
  bedrooms: 3, bathrooms: 2, garages: 1, landSize: '', floorArea: '',
  levies: '', rates: '', referenceNumber: `QP-${Date.now().toString().slice(-6)}`,
  features: [], description: '',
  sellerName: '', sellerPhone: '', sellerEmail: '',
  mandateExpiry: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
  mandateType: 'sole', sellerNotes: '',
  collaborationEnabled: false,
};

function Stepper({ value, onChange, min = 0, max = 20 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const colors = useColors();
  return (
    <View style={ss.stepperRow}>
      <TouchableOpacity
        style={[ss.stepBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        onPress={() => { if (value > min) { Haptics.selectionAsync(); onChange(value - 1); } }}
      >
        <Ionicons name="remove" size={18} color={colors.primary} />
      </TouchableOpacity>
      <Text style={[ss.stepVal, { color: colors.foreground }]}>{value}</Text>
      <TouchableOpacity
        style={[ss.stepBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        onPress={() => { if (value < max) { Haptics.selectionAsync(); onChange(value + 1); } }}
      >
        <Ionicons name="add" size={18} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const ss = StyleSheet.create({
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontSize: 20, fontWeight: '800', minWidth: 28, textAlign: 'center' },
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={fStyles.field}>
      <Text style={[fStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );
}
const fStyles = StyleSheet.create({
  field: { gap: 8, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
});

function VideoThumbnailPreview({ uri, onRemove }: { uri: string; onRemove: () => void }) {
  const colors = useColors();
  const player = useVideoPlayer(uri, p => { p.pause(); });
  return (
    <View style={vt.wrap}>
      <VideoView player={player} style={vt.thumb} contentFit="cover" nativeControls={false} />
      <View style={vt.overlay}>
        <View style={vt.playBadge}>
          <Ionicons name="play" size={22} color="#FFF" />
        </View>
      </View>
      <TouchableOpacity style={vt.removeBtn} onPress={onRemove}>
        <Ionicons name="close-circle" size={26} color="#FFF" />
      </TouchableOpacity>
      <View style={[vt.label, { backgroundColor: colors.accent + 'CC' }]}>
        <Ionicons name="checkmark-circle" size={14} color="#FFF" />
        <Text style={vt.labelText}>Video selected</Text>
      </View>
    </View>
  );
}
const vt = StyleSheet.create({
  wrap: { borderRadius: 16, overflow: 'hidden', height: 200, backgroundColor: '#000' },
  thumb: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  removeBtn: { position: 'absolute', top: 10, right: 10 },
  label: { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  labelText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});

export default function NewListingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { addProperty } = useData();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof FormData, value: any) => setForm(f => ({ ...f, [key]: value }));

  const toggleFeature = (feature: string) => {
    Haptics.selectionAsync();
    const current = form.features;
    if (current.includes(feature)) {
      set('features', current.filter(f => f !== feature));
    } else {
      set('features', [...current, feature]);
    }
  };

  const handleRecordVideo = async () => {
    try {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!camPerm.granted) {
        Alert.alert('Camera Permission Required', 'Please enable camera access in Settings to record property videos.');
        return;
      }
      // Note: requestMicrophonePermissionsAsync was removed in expo-image-picker v15+.
      // Microphone permission is granted at install time via the plugin config in app.json.
      // Note: videoQuality / UIImagePickerControllerQualityType was removed in
      // expo-image-picker v15+. Omit it so iOS uses its default medium quality.
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'videos',
        videoMaxDuration: 60,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        set('videoUri', result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Camera Error', e?.message ?? 'Could not open camera. Please try again.');
    }
  };

  const handlePickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'videos',
        videoMaxDuration: 60,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        set('videoUri', result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Library Error', e?.message ?? 'Could not open photo library. Please try again.');
    }
  };

  const handlePickPhotos = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled) set('photos', [...form.photos, ...result.assets.map(a => a.uri)]);
    } catch (e: any) {
      Alert.alert('Photo Library Error', e?.message ?? 'Could not open the photo library.');
    }
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Camera', 'Camera permission is required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      set('photos', [...form.photos, result.assets[0].uri]);
    }
  };

  const handlePublish = async (status: 'published' | 'draft') => {
    if (!form.address.trim() || !form.suburb.trim() || !form.price.trim() || Number(form.price) <= 0 || !form.type || form.photos.length === 0) {
      Alert.alert('Required Fields', 'Add at least one photo, choose a listing type, then enter a street address, suburb, and a valid price.');
      return;
    }
    setSaving(true);
    try {
      const property = await addProperty({
      referenceNumber: form.referenceNumber,
      type: form.type,
      status,
      address: form.address,
      showAddress: form.showAddress,
      suburb: form.suburb,
      price: parseFloat(form.price) || 0,
      currency: form.currency,
      negotiable: form.negotiable,
      bedrooms: form.bedrooms,
      bathrooms: form.bathrooms,
      garages: form.garages,
      landSize: parseFloat(form.landSize) || undefined,
      floorArea: parseFloat(form.floorArea) || undefined,
      levies: parseFloat(form.levies) || undefined,
      rates: parseFloat(form.rates) || undefined,
      features: form.features,
      description: form.description,
      photos: form.photos,
        collaborationEnabled: form.collaborationEnabled,
       videoUrl: form.videoUri || undefined,
      seller: {
        name: form.sellerName,
        phone: form.sellerPhone,
        email: form.sellerEmail,
        mandateExpiry: form.mandateExpiry,
        mandateType: form.mandateType,
        notes: form.sellerNotes,
      },
        agentId: user?.id ?? 'agent-001',
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        status === 'published' ? 'Listing Published' : 'Draft Saved',
        status === 'published'
          ? `${property.referenceNumber} is now live and visible in your listings.`
          : `${property.referenceNumber} was saved as a draft.`,
        [{ text: 'View Listings', onPress: () => router.replace('/(tabs)/listings') }]
      );
    } catch (e: any) {
      Alert.alert('Could Not Save Listing', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const canNext = () => {
    if (step === 0) return form.photos.length > 0;
    if (step === 2) return !!form.address.trim() && !!form.suburb.trim();
    if (step === 3) return form.type === 'sale' || form.type === 'rent';
    if (step === 4) return !!form.price.trim() && Number(form.price) > 0;
    return true;
  };

  const inputStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }];
  const textAreaStyle = [styles.input, styles.textArea, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }];

  // ---- STEP CONTENT ----
  const renderStep = () => {
    switch (step) {
      case 0: return ( // Photos
        <View style={styles.stepContent}>
          <Text style={[styles.stepHeading, { color: colors.foreground }]}>Property Photos</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>Add high-quality photos to attract buyers.</Text>
          <View style={styles.photoButtons}>
            <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.primary }]} onPress={handleTakePhoto}>
              <Ionicons name="camera" size={24} color="#FFF" />
              <Text style={styles.photoBtnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]} onPress={handlePickPhotos}>
              <Ionicons name="images-outline" size={24} color={colors.primary} />
              <Text style={[styles.photoBtnText, { color: colors.primary }]}>Upload Photos</Text>
            </TouchableOpacity>
          </View>
          {form.photos.length > 0 ? (
            <View>
              <View style={[styles.photoCount, { backgroundColor: colors.accent + '15', borderColor: colors.accent }]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                <Text style={[styles.photoCountText, { color: colors.accent }]}>{form.photos.length} photo{form.photos.length > 1 ? 's' : ''} selected</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoPreviewRow}>
                {form.photos.map((uri, index) => (
                  <View key={`${uri}-${index}`} style={styles.photoPreview}>
                    <Image source={{ uri }} style={styles.photoPreviewImage} />
                    {index === 0 && <Text style={styles.mainPhotoLabel}>Main</Text>}
                    <TouchableOpacity
                      accessibilityLabel={`Remove photo ${index + 1}`}
                      style={styles.photoRemove}
                      onPress={() => set('photos', form.photos.filter((_, photoIndex) => photoIndex !== index))}
                    >
                      <Ionicons name="close-circle" size={24} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={[styles.photoEmpty, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Ionicons name="images-outline" size={36} color={colors.mutedForeground} />
              <Text style={[styles.photoEmptyText, { color: colors.mutedForeground }]}>No photos yet</Text>
            </View>
          )}
        </View>
      );

      case 1: return ( // Video
        <View style={styles.stepContent}>
          <Text style={[styles.stepHeading, { color: colors.foreground }]}>Property Video</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>Optional — max 60 seconds. Compresses automatically.</Text>
          {form.videoUri ? (
            <VideoThumbnailPreview uri={form.videoUri} onRemove={() => set('videoUri', '')} />
          ) : (
            <View style={styles.videoButtons}>
              <TouchableOpacity
                style={[styles.videoBtn, { backgroundColor: colors.primary }]}
                onPress={handleRecordVideo}
              >
                <Ionicons name="videocam" size={24} color="#FFF" />
                <Text style={styles.videoBtnText}>Record Video</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.videoBtn, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}
                onPress={handlePickVideo}
              >
                <Ionicons name="folder-open-outline" size={24} color={colors.primary} />
                <Text style={[styles.videoBtnText, { color: colors.primary }]}>Upload Video</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={[styles.skipInfo, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={[styles.skipInfoText, { color: colors.mutedForeground }]}>This step is optional. Tap Next to continue.</Text>
          </View>
        </View>
      );

      case 2: return ( // Location
        <View style={styles.stepContent}>
          <Text style={[styles.stepHeading, { color: colors.foreground }]}>Property Location</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>Exact coordinates are private. Public listing shows approximate location.</Text>
          <Field label="STREET ADDRESS *">
            <TextInput style={inputStyle} value={form.address} onChangeText={v => set('address', v)} placeholder="14 Acacia Avenue" placeholderTextColor={colors.mutedForeground} />
          </Field>
          <Field label="SUBURB *">
            <TextInput style={inputStyle} value={form.suburb} onChangeText={v => set('suburb', v)} placeholder="Borrowdale" placeholderTextColor={colors.mutedForeground} />
          </Field>
          <TouchableOpacity style={[styles.gpsBtn, { backgroundColor: colors.accent + '15', borderColor: colors.accent }]}>
            <Ionicons name="navigate" size={18} color={colors.accent} />
            <Text style={[styles.gpsBtnText, { color: colors.accent }]}>Use Current GPS Location</Text>
          </TouchableOpacity>
          <View style={[styles.disclosureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.disclosureTop}>
              <Ionicons name="eye-outline" size={18} color={colors.primary} />
              <View style={styles.disclosureText}>
                <Text style={[styles.disclosureTitle, { color: colors.foreground }]}>Show exact address publicly</Text>
                <Text style={[styles.disclosureSub, { color: colors.mutedForeground }]}>
                  {form.showAddress
                    ? 'Full street address will appear on the website.'
                    : 'Only the suburb and approximate area will be shown publicly.'}
                </Text>
              </View>
              <Switch
                value={form.showAddress}
                onValueChange={v => { Haptics.selectionAsync(); set('showAddress', v); }}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#FFF"
              />
            </View>
          </View>
        </View>
      );

      case 3: return ( // Listing Type
        <View style={styles.stepContent}>
          <Text style={[styles.stepHeading, { color: colors.foreground }]}>What are you listing?</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            Choose whether this property is being offered for sale or rent.
          </Text>
          <View style={styles.listingTypeGrid}>
            {([
              { value: 'sale' as const, title: 'For Sale', subtitle: 'A property being sold to a buyer', icon: 'home-outline' as const },
              { value: 'rent' as const, title: 'For Rent', subtitle: 'A property available to let', icon: 'key-outline' as const },
            ]).map(option => {
              const selected = form.type === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[
                    styles.listingTypeCard,
                    {
                      backgroundColor: selected ? colors.primary : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => { Haptics.selectionAsync(); set('type', option.value); }}
                >
                  <View style={[styles.listingTypeIcon, { backgroundColor: selected ? '#FFFFFF24' : colors.secondary }]}>
                    <Ionicons name={option.icon} size={28} color={selected ? '#FFF' : colors.primary} />
                  </View>
                  <View style={styles.listingTypeCopy}>
                    <Text style={[styles.listingTypeTitle, { color: selected ? '#FFF' : colors.foreground }]}>{option.title}</Text>
                    <Text style={[styles.listingTypeSubtitle, { color: selected ? '#FFFFFFCC' : colors.mutedForeground }]}>{option.subtitle}</Text>
                  </View>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={selected ? '#FFF' : colors.mutedForeground}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[styles.selectionNote, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={[styles.selectionNoteText, { color: colors.mutedForeground }]}>
              You can review this choice before publishing.
            </Text>
          </View>
        </View>
      );

      case 4: return ( // Property Details
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={[styles.stepHeading, { color: colors.foreground }]}>Property Details</Text>
          <Field label="LISTING TYPE">
            <View style={[styles.selectedTypeCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Ionicons name={form.type === 'rent' ? 'key-outline' : 'home-outline'} size={20} color={colors.primary} />
              <Text style={[styles.selectedTypeText, { color: colors.foreground }]}>
                {form.type === 'rent' ? 'For Rent' : 'For Sale'}
              </Text>
              <Text style={[styles.selectedTypeHint, { color: colors.mutedForeground }]}>Selected on the previous step</Text>
            </View>
          </Field>
          <Field label="PRICE *">
            <View style={styles.priceRow}>
              <TouchableOpacity
                style={[styles.currencyBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={() => set('currency', CURRENCIES[(CURRENCIES.indexOf(form.currency) + 1) % CURRENCIES.length])}
                accessibilityLabel="Change currency"
              >
                <Text style={[styles.currencyText, { color: colors.foreground }]}>{form.currency}</Text>
                <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                value={form.price}
                onChangeText={v => set('price', v)}
                placeholder="420000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
              />
            </View>
          </Field>
          <Field label="NEGOTIABLE">
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: colors.foreground }]}>Price is negotiable</Text>
              <Switch
                value={form.negotiable}
                onValueChange={v => set('negotiable', v)}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#FFF"
              />
            </View>
          </Field>
          <Field label="BEDROOMS">
            <Stepper value={form.bedrooms} onChange={v => set('bedrooms', v)} />
          </Field>
          <Field label="BATHROOMS">
            <Stepper value={form.bathrooms} onChange={v => set('bathrooms', v)} />
          </Field>
          <Field label="GARAGES">
            <Stepper value={form.garages} onChange={v => set('garages', v)} />
          </Field>
          <View style={styles.twoCol}>
            <View style={styles.halfField}>
              <Field label="LAND SIZE (m²)">
                <TextInput style={inputStyle} value={form.landSize} onChangeText={v => set('landSize', v)} placeholder="4200" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              </Field>
            </View>
            <View style={styles.halfField}>
              <Field label="FLOOR AREA (m²)">
                <TextInput style={inputStyle} value={form.floorArea} onChangeText={v => set('floorArea', v)} placeholder="380" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              </Field>
            </View>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.halfField}>
              <Field label="LEVIES/mo">
                <TextInput style={inputStyle} value={form.levies} onChangeText={v => set('levies', v)} placeholder="0" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              </Field>
            </View>
            <View style={styles.halfField}>
              <Field label="RATES/mo">
                <TextInput style={inputStyle} value={form.rates} onChangeText={v => set('rates', v)} placeholder="280" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              </Field>
            </View>
          </View>
          <Field label="REFERENCE NUMBER">
            <TextInput style={inputStyle} value={form.referenceNumber} onChangeText={v => set('referenceNumber', v)} placeholderTextColor={colors.mutedForeground} />
          </Field>
        </ScrollView>
      );

      case 5: return ( // Features
        <View style={styles.stepContent}>
          <Text style={[styles.stepHeading, { color: colors.foreground }]}>Property Features</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>Select all features this property has. {form.features.length} selected.</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.chipsWrap}>
              {PROPERTY_FEATURES.map(f => (
                <FeatureChip key={f} label={f} selected={form.features.includes(f)} onToggle={() => toggleFeature(f)} />
              ))}
            </View>
          </ScrollView>
        </View>
      );

      case 6: return ( // Description
        <View style={styles.stepContent}>
          <Text style={[styles.stepHeading, { color: colors.foreground }]}>Description</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>Write a compelling description. Use AI tools to refine.</Text>
          <TextInput
            style={[textAreaStyle, { minHeight: 150 }]}
            value={form.description}
            onChangeText={v => set('description', v)}
            placeholder="Describe the property — location, key features, lifestyle appeal..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
          />
          <Text style={[styles.aiLabel, { color: colors.mutedForeground }]}>AI TONE TOOLS</Text>
          <View style={styles.aiButtons}>
            {['Improve Writing', 'Shorten', 'Luxury Tone', 'Investment Tone', 'Professional'].map(tool => (
              <TouchableOpacity
                key={tool}
                style={[styles.aiBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              >
                <Ionicons name="sparkles" size={13} color={colors.primary} />
                <Text style={[styles.aiBtnText, { color: colors.primary }]}>{tool}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.aiDisclaimer, { backgroundColor: colors.muted }]}>
            <Ionicons name="information-circle-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.aiDisclaimerText, { color: colors.mutedForeground }]}>AI will improve your writing but will never invent facts.</Text>
          </View>
        </View>
      );

      case 7: return ( // Seller Details
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={[styles.stepHeading, { color: colors.foreground }]}>Seller Details</Text>
          <View style={[styles.privateNote, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={14} color={colors.primary} />
            <Text style={[styles.privateNoteText, { color: colors.mutedForeground }]}>This information is private and never visible to the public.</Text>
          </View>
          <Field label="SELLER NAME"><TextInput style={inputStyle} value={form.sellerName} onChangeText={v => set('sellerName', v)} placeholder="Robert Chikwanda" placeholderTextColor={colors.mutedForeground} /></Field>
          <Field label="PHONE"><TextInput style={inputStyle} value={form.sellerPhone} onChangeText={v => set('sellerPhone', v)} placeholder="+263 77 123 4567" placeholderTextColor={colors.mutedForeground} keyboardType="phone-pad" /></Field>
          <Field label="EMAIL"><TextInput style={inputStyle} value={form.sellerEmail} onChangeText={v => set('sellerEmail', v)} placeholder="seller@email.com" placeholderTextColor={colors.mutedForeground} keyboardType="email-address" autoCapitalize="none" /></Field>
          <Field label="MANDATE EXPIRY">
            <TextInput style={inputStyle} value={form.mandateExpiry} onChangeText={v => set('mandateExpiry', v)} placeholder="2025-03-31" placeholderTextColor={colors.mutedForeground} />
          </Field>
          <Field label="MANDATE TYPE">
            <View style={styles.typeGrid}>
              {MANDATE_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, { backgroundColor: form.mandateType === t ? colors.primary : colors.secondary, borderColor: form.mandateType === t ? colors.primary : colors.border }]}
                  onPress={() => { Haptics.selectionAsync(); set('mandateType', t); }}
                >
                  <Text style={[styles.typeBtnText, { color: form.mandateType === t ? '#FFF' : colors.foreground }]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>
          <Field label="INTERNAL NOTES">
            <TextInput style={[textAreaStyle, { minHeight: 80 }]} value={form.sellerNotes} onChangeText={v => set('sellerNotes', v)} placeholder="Seller motivation, negotiation notes, access instructions..." placeholderTextColor={colors.mutedForeground} multiline textAlignVertical="top" />
          </Field>
        </ScrollView>
      );

      case 8: return ( // Collaboration
        <View style={styles.stepContent}>
          <Text style={[styles.stepHeading, { color: colors.foreground }]}>Open to collaboration?</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            Let other QuickProp agents discover this listing and send you a collaboration request. Your seller details stay private.
          </Text>
          <TouchableOpacity
            accessibilityRole="radio"
            accessibilityState={{ selected: form.collaborationEnabled }}
            style={[
              styles.listingTypeCard,
              {
                backgroundColor: form.collaborationEnabled ? colors.primary : colors.card,
                borderColor: form.collaborationEnabled ? colors.primary : colors.border,
              },
            ]}
            onPress={() => { Haptics.selectionAsync(); set('collaborationEnabled', true); }}
          >
            <View style={[styles.listingTypeIcon, { backgroundColor: form.collaborationEnabled ? '#FFFFFF24' : colors.secondary }]}>
              <Ionicons name="people-outline" size={28} color={form.collaborationEnabled ? '#FFF' : colors.primary} />
            </View>
            <View style={styles.listingTypeCopy}>
              <Text style={[styles.listingTypeTitle, { color: form.collaborationEnabled ? '#FFF' : colors.foreground }]}>Yes, accept requests</Text>
              <Text style={[styles.listingTypeSubtitle, { color: form.collaborationEnabled ? '#FFFFFFCC' : colors.mutedForeground }]}>Other agencies can ask to collaborate.</Text>
            </View>
            <Ionicons name={form.collaborationEnabled ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={form.collaborationEnabled ? '#FFF' : colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="radio"
            accessibilityState={{ selected: !form.collaborationEnabled }}
            style={[
              styles.listingTypeCard,
              {
                backgroundColor: !form.collaborationEnabled ? colors.primary : colors.card,
                borderColor: !form.collaborationEnabled ? colors.primary : colors.border,
              },
            ]}
            onPress={() => { Haptics.selectionAsync(); set('collaborationEnabled', false); }}
          >
            <View style={[styles.listingTypeIcon, { backgroundColor: !form.collaborationEnabled ? '#FFFFFF24' : colors.secondary }]}>
              <Ionicons name="lock-closed-outline" size={28} color={!form.collaborationEnabled ? '#FFF' : colors.primary} />
            </View>
            <View style={styles.listingTypeCopy}>
              <Text style={[styles.listingTypeTitle, { color: !form.collaborationEnabled ? '#FFF' : colors.foreground }]}>No, keep it private</Text>
              <Text style={[styles.listingTypeSubtitle, { color: !form.collaborationEnabled ? '#FFFFFFCC' : colors.mutedForeground }]}>Only your agency portfolio can access it.</Text>
            </View>
            <Ionicons name={!form.collaborationEnabled ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={!form.collaborationEnabled ? '#FFF' : colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      );

      case 9: return ( // Review & Publish
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={[styles.stepHeading, { color: colors.foreground }]}>Review & Publish</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>Confirm your listing details before publishing.</Text>
          <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { label: 'Reference', value: form.referenceNumber },
               { label: 'Type', value: form.type ? `${form.type.charAt(0).toUpperCase() + form.type.slice(1)}` : 'Not selected' },
              { label: 'Address', value: `${form.address}, ${form.suburb}` },
              { label: 'Address visibility', value: form.showAddress ? 'Public (exact address shown)' : 'Private (suburb only)' },
              { label: 'Price', value: `${form.currency} ${form.price}${form.negotiable ? ' (Neg)' : ''}` },
              { label: 'Beds / Baths', value: `${form.bedrooms} bed / ${form.bathrooms} bath` },
              { label: 'Photos', value: `${form.photos.length} added` },
               { label: 'Collaboration', value: form.collaborationEnabled ? 'Open to agent requests' : 'Private to your agency' },
              { label: 'Features', value: form.features.length > 0 ? `${form.features.length} selected` : 'None' },
              { label: 'Seller', value: form.sellerName || 'Not entered' },
              { label: 'Mandate', value: `${form.mandateType} · ${form.mandateExpiry}` },
            ].map(({ label, value }, i, arr) => (
              <View key={label} style={[styles.reviewRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{label}</Text>
                <Text style={[styles.reviewValue, { color: colors.foreground }]}>{value}</Text>
              </View>
            ))}
          </View>
          <View style={styles.publishButtons}>
            <TouchableOpacity
              style={[styles.publishBtn, { backgroundColor: colors.primary }]}
              onPress={() => handlePublish('published')}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : (
                <>
                  <Ionicons name="globe-outline" size={18} color="#FFF" />
                  <Text style={styles.publishBtnText}>Publish Now</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.draftBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => handlePublish('draft')}
              disabled={saving}
            >
              <Ionicons name="save-outline" size={18} color={colors.primary} />
              <Text style={[styles.draftBtnText, { color: colors.primary }]}>Save as Draft</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.draftBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => Alert.alert('Save Before Scheduling', 'Save this listing as a draft first. You can publish it when you are ready.')}
            >
              <Ionicons name="time-outline" size={18} color={colors.mutedForeground} />
              <Text style={[styles.draftBtnText, { color: colors.mutedForeground }]}>Schedule Later</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );

      default: return null;
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.closeBtn, { backgroundColor: colors.muted }]}>
          <Ionicons name="close" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>New Listing</Text>
          <StepIndicator currentStep={step} totalSteps={TOTAL_STEPS} stepLabel={STEP_LABELS[step]} />
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 140 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Navigation buttons */}
      <View style={[styles.navBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
        {step > 0 && (
          <TouchableOpacity
            style={[styles.backNavBtn, { borderColor: colors.border }]}
            onPress={() => { Haptics.selectionAsync(); setStep(s => s - 1); }}
          >
            <Ionicons name="arrow-back" size={18} color={colors.foreground} />
            <Text style={[styles.backNavText, { color: colors.foreground }]}>Back</Text>
          </TouchableOpacity>
        )}
        {step < TOTAL_STEPS - 1 && (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: canNext() ? colors.primary : colors.muted, flex: step > 0 ? 1 : undefined, width: step === 0 ? '100%' : undefined }]}
            onPress={() => { if (canNext()) { Haptics.selectionAsync(); setStep(s => s + 1); } }}
          >
            <Text style={[styles.nextBtnText, { color: canNext() ? '#FFF' : colors.mutedForeground }]}>
              {step === 1 ? (form.videoUri ? 'Next' : 'Skip') : 'Continue'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={canNext() ? '#FFF' : colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  closeBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  headerCenter: { gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 20 },
  stepContent: { gap: 16 },
  stepHeading: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginBottom: 2 },
  stepSub: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  photoButtons: { flexDirection: 'row', gap: 12 },
  photoBtn: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 8, borderRadius: 16, paddingVertical: 20 },
  photoBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  photoCount: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  photoCountText: { fontSize: 14, fontWeight: '700' },
  photoPreviewRow: { gap: 10, paddingTop: 12 },
  photoPreview: { width: 110, height: 86, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoPreviewImage: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: '#00000066', borderRadius: 14 },
  mainPhotoLabel: { position: 'absolute', bottom: 4, left: 4, color: '#FFF', backgroundColor: '#00000099', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, fontSize: 10, fontWeight: '700' },
  photoEmpty: { height: 140, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, gap: 8 },
  photoEmptyText: { fontSize: 13 },
  videoButtons: { flexDirection: 'row', gap: 12 },
  videoBtn: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 8, borderRadius: 16, paddingVertical: 20 },
  videoBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  videoCount: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  videoCountText: { fontSize: 14, fontWeight: '700', flex: 1 },
  videoRemove: { padding: 2 },
  skipInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  skipInfoText: { fontSize: 13, flex: 1 },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  gpsBtnText: { fontSize: 14, fontWeight: '700' },
  disclosureCard: { borderRadius: 14, borderWidth: 1, padding: 14 },
  disclosureTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  disclosureText: { flex: 1, gap: 3 },
  disclosureTitle: { fontSize: 14, fontWeight: '700' },
  disclosureSub: { fontSize: 12, lineHeight: 17 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textArea: { paddingVertical: 12, minHeight: 100 },
  listingTypeGrid: { gap: 12 },
  listingTypeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  listingTypeIcon: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  listingTypeCopy: { flex: 1, gap: 4 },
  listingTypeTitle: { fontSize: 17, fontWeight: '800' },
  listingTypeSubtitle: { fontSize: 12, lineHeight: 17 },
  selectionNote: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  selectionNoteText: { fontSize: 13, flex: 1 },
  selectedTypeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 14 },
  selectedTypeText: { fontSize: 15, fontWeight: '800' },
  selectedTypeHint: { fontSize: 12, marginLeft: 'auto' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  typeBtnText: { fontSize: 13, fontWeight: '600' },
  priceRow: { flexDirection: 'row', gap: 8 },
  currencyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  currencyText: { fontSize: 15, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 15, fontWeight: '500' },
  twoCol: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 20 },
  aiLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 4, marginBottom: 8 },
  aiButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  aiBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  aiBtnText: { fontSize: 13, fontWeight: '600' },
  aiDisclaimer: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, marginTop: 4 },
  aiDisclaimerText: { fontSize: 12, flex: 1 },
  privateNote: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
  privateNoteText: { fontSize: 13, flex: 1 },
  reviewCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  reviewLabel: { fontSize: 13 },
  reviewValue: { fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 16 },
  publishButtons: { gap: 10, marginBottom: 20 },
  publishBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16 },
  publishBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  draftBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 13, borderWidth: 1 },
  draftBtnText: { fontSize: 15, fontWeight: '600' },
  navBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  backNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, borderWidth: 1 },
  backNavText: { fontSize: 15, fontWeight: '600' },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
  nextBtnText: { fontSize: 16, fontWeight: '700' },
});
