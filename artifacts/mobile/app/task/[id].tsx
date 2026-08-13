import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';

const TASK_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  call_seller: 'call-outline',
  viewing: 'eye-outline',
  price_update: 'trending-down-outline',
  renew_mandate: 'refresh-outline',
  take_photos: 'camera-outline',
  other: 'checkbox-outline',
};

const TASK_COLORS: Record<string, string> = {
  call_seller: '#3B82F6',
  viewing: '#10B981',
  price_update: '#F59E0B',
  renew_mandate: '#8B5CF6',
  take_photos: '#EC4899',
  other: '#6B7280',
};

const TASK_TYPE_LABELS: Record<string, string> = {
  call_seller: 'Call Seller',
  viewing: 'Viewing',
  price_update: 'Price Update',
  renew_mandate: 'Renew Mandate',
  take_photos: 'Take Photos',
  other: 'Other',
};

const TASK_TYPES = ['call_seller', 'viewing', 'price_update', 'renew_mandate', 'take_photos', 'other'] as const;

/** Format ISO date string to YYYY-MM-DD for editing */
const toDateInput = (iso: string) => iso.split('T')[0];

/** Parse a YYYY-MM-DD input back to a full ISO string (noon local time) */
const fromDateInput = (val: string): string => {
  const d = new Date(val + 'T12:00:00');
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

const formatDisplayDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

export default function TaskDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tasks, updateTask, deleteTask } = useData();

  const task = tasks.find(t => t.id === id);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('');
  const [editDate, setEditDate] = useState('');

  if (!task) {
    return (
      <View style={[styles.flex, styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Task not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.goBackBtn, { backgroundColor: colors.primary }]}>
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const taskColor = TASK_COLORS[task.type] || colors.primary;
  const isOverdue = !task.completed && new Date(task.dueDate) < new Date();

  const startEditing = () => {
    setEditTitle(task.title);
    setEditType(task.type);
    setEditDate(toDateInput(task.dueDate));
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }
    setSaving(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateTask(task.id, {
      title: editTitle.trim(),
      type: editType as any,
      dueDate: fromDateInput(editDate),
    });
    setSaving(false);
    setEditing(false);
  };

  const handleReschedule = () => {
    Alert.prompt(
      'Reschedule Task',
      'Enter new due date (YYYY-MM-DD):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reschedule',
          onPress: async (value) => {
            if (!value) return;
            const newDate = fromDateInput(value.trim());
            setSaving(true);
            await updateTask(task.id, { dueDate: newDate });
            setSaving(false);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
      'plain-text',
      toDateInput(task.dueDate),
    );
  };

  const handleToggleComplete = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateTask(task.id, { completed: !task.completed });
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTask(task.id);
            router.back();
          },
        },
      ],
    );
  };

  const inputStyle = [
    styles.input,
    { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border },
  ];

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.muted }]}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Task Detail</Text>
        {!editing ? (
          <TouchableOpacity onPress={startEditing} style={[styles.iconBtn, { backgroundColor: colors.muted }]}>
            <Ionicons name="pencil-outline" size={20} color={colors.foreground} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={cancelEditing} style={[styles.iconBtn, { backgroundColor: colors.muted }]}>
            <Ionicons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type badge + status */}
        <View style={styles.badgeRow}>
          <View style={[styles.typeBadge, { backgroundColor: taskColor + '18' }]}>
            <Ionicons name={TASK_ICONS[task.type] || 'checkbox-outline'} size={16} color={taskColor} />
            <Text style={[styles.typeBadgeText, { color: taskColor }]}>
              {TASK_TYPE_LABELS[task.type] || task.type}
            </Text>
          </View>
          {task.completed && (
            <View style={[styles.completedBadge, { backgroundColor: '#10B981' + '18' }]}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={[styles.completedBadgeText, { color: '#10B981' }]}>Completed</Text>
            </View>
          )}
          {isOverdue && (
            <View style={[styles.completedBadge, { backgroundColor: colors.destructive + '18' }]}>
              <Ionicons name="time-outline" size={14} color={colors.destructive} />
              <Text style={[styles.completedBadgeText, { color: colors.destructive }]}>Overdue</Text>
            </View>
          )}
        </View>

        {editing ? (
          /* ---- EDIT MODE ---- */
          <View style={styles.editSection}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TITLE</Text>
            <TextInput
              style={inputStyle}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Task title"
              placeholderTextColor={colors.mutedForeground}
              multiline
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 14 }]}>TYPE</Text>
            <View style={styles.typeGrid}>
              {TASK_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: editType === t ? taskColor : colors.secondary,
                      borderColor: editType === t ? taskColor : colors.border,
                    },
                  ]}
                  onPress={() => { Haptics.selectionAsync(); setEditType(t); }}
                >
                  <Ionicons name={TASK_ICONS[t]} size={14} color={editType === t ? '#FFF' : colors.mutedForeground} />
                  <Text style={[styles.typeChipText, { color: editType === t ? '#FFF' : colors.foreground }]}>
                    {TASK_TYPE_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 14 }]}>DUE DATE (YYYY-MM-DD)</Text>
            <TextInput
              style={inputStyle}
              value={editDate}
              onChangeText={setEditDate}
              placeholder="2026-08-20"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: saving ? colors.muted : colors.primary }]}
              onPress={handleSaveEdit}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#FFF" />
                : <><Ionicons name="checkmark" size={18} color="#FFF" /><Text style={styles.saveBtnText}>Save Changes</Text></>
              }
            </TouchableOpacity>
          </View>
        ) : (
          /* ---- VIEW MODE ---- */
          <>
            <Text style={[styles.taskTitle, { color: colors.foreground }]}>{task.title}</Text>

            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="calendar-outline" size={16} color={colors.mutedForeground} />
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Due date</Text>
                <Text style={[styles.infoValue, { color: isOverdue ? colors.destructive : colors.foreground }]}>
                  {formatDisplayDate(task.dueDate)}
                </Text>
              </View>
              {task.propertyAddress && (
                <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                  <Ionicons name="home-outline" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Property</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{task.propertyAddress}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={16} color={colors.mutedForeground} />
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Created</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>
                  {new Date(task.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            </View>

            {task.propertyId && (
              <TouchableOpacity
                style={[styles.viewPropertyBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => router.push(`/listing/${task.propertyId}`)}
              >
                <Ionicons name="business-outline" size={18} color={colors.primary} />
                <Text style={[styles.viewPropertyText, { color: colors.primary }]}>View Property Listing</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
          </>
        )}

        {!editing && (
          /* ---- ACTIONS ---- */
          <View style={styles.actionsSection}>
            <Text style={[styles.actionsLabel, { color: colors.mutedForeground }]}>ACTIONS</Text>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleToggleComplete}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#10B981' + '18' }]}>
                <Ionicons name={task.completed ? 'arrow-undo-outline' : 'checkmark-circle-outline'} size={20} color="#10B981" />
              </View>
              <Text style={[styles.actionText, { color: colors.foreground }]}>
                {task.completed ? 'Mark as Incomplete' : 'Mark as Complete'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={startEditing}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name="pencil-outline" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.actionText, { color: colors.foreground }]}>Edit Task</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleReschedule}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#F59E0B' + '18' }]}>
                  <Ionicons name="calendar-outline" size={20} color="#F59E0B" />
                </View>
                <Text style={[styles.actionText, { color: colors.foreground }]}>Reschedule</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.destructive + '40' }]}
              onPress={handleDelete}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.destructive + '18' }]}>
                <Ionicons name="trash-outline" size={20} color={colors.destructive} />
              </View>
              <Text style={[styles.actionText, { color: colors.destructive }]}>Delete Task</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  notFoundText: { fontSize: 16, fontWeight: '600' },
  goBackBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  goBackBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, paddingTop: 20, gap: 16 },
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  typeBadgeText: { fontSize: 13, fontWeight: '700' },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  completedBadgeText: { fontSize: 12, fontWeight: '700' },
  taskTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, lineHeight: 28 },
  infoCard: {
    borderRadius: 14, borderWidth: 1, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13, width: 70 },
  infoValue: { fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  viewPropertyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  viewPropertyText: { flex: 1, fontSize: 15, fontWeight: '600' },
  actionsSection: { gap: 8, marginTop: 8 },
  actionsLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  actionIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, fontSize: 15, fontWeight: '600' },
  editSection: { gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  typeChipText: { fontSize: 13, fontWeight: '600' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 15, marginTop: 20 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
