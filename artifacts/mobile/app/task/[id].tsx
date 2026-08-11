import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';
import { Task } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_TYPES: { key: Task['type']; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'viewing',       label: 'Viewing',       icon: 'eye-outline',           color: '#10B981' },
  { key: 'call_seller',   label: 'Call Seller',   icon: 'call-outline',          color: '#3B82F6' },
  { key: 'price_update',  label: 'Price Update',  icon: 'trending-down-outline', color: '#F59E0B' },
  { key: 'renew_mandate', label: 'Renew Mandate', icon: 'refresh-outline',       color: '#8B5CF6' },
  { key: 'take_photos',   label: 'Take Photos',   icon: 'camera-outline',        color: '#EC4899' },
  { key: 'other',         label: 'Other',         icon: 'checkbox-outline',      color: '#6B7280' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Date spinner ─────────────────────────────────────────────────────────────

function DateSpinner({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const colors = useColors();

  const adjust = (field: 'day' | 'month' | 'year', delta: number) => {
    const d = new Date(date);
    if (field === 'day')   d.setDate(d.getDate() + delta);
    if (field === 'month') d.setMonth(d.getMonth() + delta);
    if (field === 'year')  d.setFullYear(d.getFullYear() + delta);
    onChange(d);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const Segment = ({ field, label }: { field: 'day' | 'month' | 'year'; label: string }) => (
    <View style={spin.segment}>
      <TouchableOpacity onPress={() => adjust(field, 1)} style={spin.arrow} hitSlop={{ top: 8, bottom: 4, left: 12, right: 12 }}>
        <Ionicons name="chevron-up" size={22} color={colors.primary} />
      </TouchableOpacity>
      <Text style={[spin.value, { color: colors.foreground }]}>{label}</Text>
      <TouchableOpacity onPress={() => adjust(field, -1)} style={spin.arrow} hitSlop={{ top: 4, bottom: 8, left: 12, right: 12 }}>
        <Ionicons name="chevron-down" size={22} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[spin.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Segment field="day"   label={String(date.getDate()).padStart(2, '0')} />
      <View style={[spin.div, { backgroundColor: colors.border }]} />
      <Segment field="month" label={MONTHS[date.getMonth()]} />
      <View style={[spin.div, { backgroundColor: colors.border }]} />
      <Segment field="year"  label={String(date.getFullYear())} />
    </View>
  );
}

const spin = StyleSheet.create({
  container: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  segment:   { flex: 1, alignItems: 'center', paddingVertical: 6 },
  arrow:     { padding: 8 },
  value:     { fontSize: 20, fontWeight: '700', marginVertical: 4, letterSpacing: -0.3 },
  div:       { width: 1 },
});

// ─── Root screen (handles task-not-found before hooks in EditForm) ────────────

export default function TaskEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tasks } = useData();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const task = tasks.find(t => t.id === id);

  if (!task) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
        <Text style={[s.notFound, { color: colors.mutedForeground }]}>Task not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={[s.backLink, { borderColor: colors.border }]}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <EditForm task={task} />;
}

// ─── Edit form (hooks safe — task is guaranteed to exist) ─────────────────────

function EditForm({ task }: { task: Task }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { updateTask } = useData();

  const [title,     setTitle]     = useState(task.title);
  const [type,      setType]      = useState<Task['type']>(task.type);
  const [dueDate,   setDueDate]   = useState(new Date(task.dueDate));
  const [address,   setAddress]   = useState(task.propertyAddress ?? '');
  const [completed, setCompleted] = useState(task.completed);
  const [saving,    setSaving]    = useState(false);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }
    setSaving(true);
    try {
      await updateTask(task.id, {
        title:           title.trim(),
        type,
        dueDate:         dueDate.toISOString(),
        propertyAddress: address.trim() || undefined,
        completed,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save task. Please try again.');
      setSaving(false);
    }
  };

  const selectedType = TASK_TYPES.find(t => t.key === type)!;

  return (
    <ScrollView
      style={[s.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Edit Task</Text>
        <TouchableOpacity
          onPress={save}
          disabled={saving}
          style={[s.saveBtn, { backgroundColor: saving ? colors.mutedForeground : colors.primary }]}
        >
          <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      {/* Completed toggle */}
      <TouchableOpacity
        style={[s.completeRow, {
          backgroundColor: completed ? '#10B98114' : colors.card,
          borderColor:     completed ? '#10B981'   : colors.border,
        }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          setCompleted(c => !c);
        }}
      >
        <Ionicons
          name={completed ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={completed ? '#10B981' : colors.mutedForeground}
        />
        <Text style={[s.completeLabel, { color: completed ? '#10B981' : colors.foreground }]}>
          {completed ? 'Completed — tap to reopen' : 'Mark as complete'}
        </Text>
      </TouchableOpacity>

      {/* Type */}
      <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>TYPE</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.typeScroll}
        contentContainerStyle={s.typeContent}
      >
        {TASK_TYPES.map(t => {
          const active = type === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[s.typePill, {
                backgroundColor: active ? t.color + '1A' : colors.card,
                borderColor:     active ? t.color        : colors.border,
              }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setType(t.key);
              }}
            >
              <Ionicons name={t.icon} size={14} color={active ? t.color : colors.mutedForeground} />
              <Text style={[s.typePillLabel, { color: active ? t.color : colors.foreground }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Title */}
      <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>TITLE</Text>
      <TextInput
        style={[s.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        value={title}
        onChangeText={setTitle}
        placeholder="Task title"
        placeholderTextColor={colors.mutedForeground}
        multiline
      />

      {/* Due date */}
      <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>DUE DATE</Text>
      <DateSpinner date={dueDate} onChange={setDueDate} />

      {/* Property address */}
      <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>PROPERTY ADDRESS (optional)</Text>
      <TextInput
        style={[s.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        value={address}
        onChangeText={setAddress}
        placeholder="e.g. 14 Acacia Avenue, Harare"
        placeholderTextColor={colors.mutedForeground}
      />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex:          { flex: 1 },
  centered:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFound:      { fontSize: 16, fontWeight: '500' },
  backLink:      { marginTop: 8, borderWidth: 1, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  content:       { paddingHorizontal: 16 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  saveBtn:       { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20 },
  saveBtnText:   { color: '#FFF', fontSize: 14, fontWeight: '700' },
  completeRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 8 },
  completeLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  fieldLabel:    { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 22, marginBottom: 10 },
  typeScroll:    { marginHorizontal: -16 },
  typeContent:   { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  typePill:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  typePillLabel: { fontSize: 13, fontWeight: '600' },
  textInput:     { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 50 },
});
