import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';
import { Task } from '@/types';

const TYPES: Array<{ value: Task['type']; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'call_seller', label: 'Call Seller', icon: 'call-outline' },
  { value: 'viewing', label: 'Viewing', icon: 'eye-outline' },
  { value: 'price_update', label: 'Price Update', icon: 'trending-down-outline' },
  { value: 'renew_mandate', label: 'Renew Mandate', icon: 'refresh-outline' },
  { value: 'take_photos', label: 'Take Photos', icon: 'camera-outline' },
  { value: 'other', label: 'Other', icon: 'checkbox-outline' },
];

const dateValue = () => new Date().toISOString().slice(0, 10);
const parseDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default function NewTaskScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addTask, properties } = useData();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<Task['type']>('other');
  const [dueDate, setDueDate] = useState(dateValue);
  const [propertyId, setPropertyId] = useState<string | undefined>();
  const [errors, setErrors] = useState<{ title?: string; type?: string; dueDate?: string }>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const nextErrors: typeof errors = {};
    if (!title.trim()) nextErrors.title = 'A task title is required.';
    if (!type) nextErrors.type = 'Select a task type.';
    const parsedDate = parseDate(dueDate);
    if (!parsedDate) nextErrors.dueDate = 'Enter a valid date in YYYY-MM-DD format.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !parsedDate) return;

    setSaving(true);
    try {
      const property = properties.find(item => item.id === propertyId);
      await addTask({
        title: title.trim(),
        type,
        dueDate: parsedDate.toISOString(),
        propertyId,
        propertyAddress: property ? `${property.address}, ${property.suburb}` : undefined,
        completed: false,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert('Could Not Create Task', 'Your task could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const input = (invalid?: boolean) => [styles.input, {
    color: colors.foreground, backgroundColor: colors.input, borderColor: invalid ? colors.destructive : colors.border,
  }];

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), paddingBottom: insets.bottom + 32 }]}
      bottomOffset={72}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity accessibilityLabel="Close new task" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={25} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>New Task</Text>
        <View style={styles.iconBtn} />
      </View>

      <Text style={[styles.intro, { color: colors.mutedForeground }]}>Fields marked <Text style={{ color: colors.destructive }}>*</Text> are required.</Text>
      <Text style={[styles.label, { color: colors.foreground }]}>Task title <Text style={{ color: colors.destructive }}>*</Text></Text>
      <TextInput value={title} onChangeText={value => { setTitle(value); setErrors(current => ({ ...current, title: undefined })); }}
        style={input(!!errors.title)} placeholder="e.g. Call seller to confirm viewing" placeholderTextColor={colors.mutedForeground} />
      {errors.title && <Text style={[styles.error, { color: colors.destructive }]}>{errors.title}</Text>}

      <Text style={[styles.label, { color: colors.foreground }]}>Task type <Text style={{ color: colors.destructive }}>*</Text></Text>
      <View style={styles.typeGrid}>
        {TYPES.map(option => (
          <TouchableOpacity key={option.value} onPress={() => { setType(option.value); setErrors(current => ({ ...current, type: undefined })); }}
            style={[styles.typeChip, { borderColor: type === option.value ? colors.primary : colors.border, backgroundColor: type === option.value ? colors.primary : colors.card }]}>
            <Ionicons name={option.icon} size={16} color={type === option.value ? '#FFF' : colors.mutedForeground} />
            <Text style={{ color: type === option.value ? '#FFF' : colors.foreground, fontSize: 13, fontWeight: '600' }}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {errors.type && <Text style={[styles.error, { color: colors.destructive }]}>{errors.type}</Text>}

      <Text style={[styles.label, { color: colors.foreground }]}>Due date <Text style={{ color: colors.destructive }}>*</Text></Text>
      <TextInput value={dueDate} onChangeText={value => { setDueDate(value); setErrors(current => ({ ...current, dueDate: undefined })); }}
        style={input(!!errors.dueDate)} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} keyboardType="numbers-and-punctuation" />
      {errors.dueDate && <Text style={[styles.error, { color: colors.destructive }]}>{errors.dueDate}</Text>}

      <Text style={[styles.label, { color: colors.foreground }]}>Property <Text style={[styles.optional, { color: colors.mutedForeground }]}>(optional)</Text></Text>
      <View style={styles.propertyList}>
        <TouchableOpacity onPress={() => setPropertyId(undefined)} style={[styles.propertyChip, { borderColor: !propertyId ? colors.primary : colors.border, backgroundColor: !propertyId ? colors.primary : colors.card }]}>
          <Text style={{ color: !propertyId ? '#FFF' : colors.foreground, fontWeight: '600' }}>No property</Text>
        </TouchableOpacity>
        {properties.map(property => (
          <TouchableOpacity key={property.id} onPress={() => setPropertyId(property.id)} style={[styles.propertyChip, { borderColor: propertyId === property.id ? colors.primary : colors.border, backgroundColor: propertyId === property.id ? colors.primary : colors.card }]}>
            <Text numberOfLines={1} style={{ color: propertyId === property.id ? '#FFF' : colors.foreground, fontWeight: '600' }}>{property.address}, {property.suburb}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity testID="create-task-button" disabled={saving} onPress={save} style={[styles.saveButton, { backgroundColor: saving ? colors.muted : colors.primary }]}>
        {saving ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="add-circle-outline" size={20} color="#FFF" /><Text style={styles.saveText}>Create Task</Text></>}
      </TouchableOpacity>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottomWidth: 1, marginBottom: 22 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 19, fontWeight: '800' },
  intro: { fontSize: 13, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  optional: { fontSize: 12, fontWeight: '500' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  error: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 9 },
  propertyList: { gap: 8 },
  propertyChip: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 11 },
  saveButton: { marginTop: 28, minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  saveText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});