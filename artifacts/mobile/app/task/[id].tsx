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

const toDateInput = (iso: string) => iso.split('T')[0];

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
        <View style={styles.badgeRow}>
          <View style={[styles.typeBadge, { backgroundColor: taskColor + '18' }]}>
            <Ionicons name={TASK_ICONS[task.type] || 'checkbox-outline'} size={16} color={taskColor} />
            <Text style={[styles.typeBadgeText, { color: taskColor }]}>
              {TASK_TYPE_LABELS[task.type] || task.type}
            </Text>
          </View>
          {task.completed && (
            <View style={[styles.statusBadge, { backgroundColor: '#10B981' + '18' }]}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={[styles.statusBadgeText, { color: '#10B981' }]}>Completed</Text>
            </View>
          )}
          {isOverdue && (
            <View style={[styles.statusBadge, { backgroundColor: colors.destructive + '18' }]}>
              <Ionicons name="time-outline" size={14} color={colors.destructive} /> **…**

_This response is too long to display in full._
