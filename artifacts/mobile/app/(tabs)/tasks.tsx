import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';
import { NavigationFlags } from '@/utils/navigationFlags';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'due', label: 'Due' },
  { key: 'viewing', label: 'Viewings' },
  { key: 'call_seller', label: 'Calls' },
  { key: 'price_update', label: 'Price Updates' },
  { key: 'renew_mandate', label: 'Mandates' },
];

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

export default function TasksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tasks } = useData();

// Read filter from route params (set by dashboard stat cards).
  // _t is a timestamp that changes on every tap so useEffect fires even when
  // the filter value itself hasn't changed.
  const { filter: paramFilter, dateScope: paramDateScope, _t, title: paramTitle } = useLocalSearchParams<{ filter?: string; dateScope?: string; _t?: string; title?: string }>();
  const [activeFilter, setActiveFilter] = useState(paramFilter || 'all');
  const [dateScope, setDateScope] = useState<'today' | undefined>(paramDateScope === 'today' ? 'today' : undefined);
  const [screenTitle, setScreenTitle] = useState(paramTitle || 'Tasks');
  const lastAppliedT = useRef<string | undefined>(undefined);
  
  useEffect(() => {
    // _t changes on every dashboard tap, including when this tab is already mounted.
    if (_t !== undefined && _t !== lastAppliedT.current) {
      lastAppliedT.current = _t;
      setActiveFilter(paramFilter || 'all');
      setDateScope(paramDateScope === 'today' ? 'today' : undefined);
      setScreenTitle(paramTitle || 'Tasks');
    }
  }, [paramFilter, paramDateScope, _t]);

  // A focus event covers tab reuse/navigation actions that do not remount TasksScreen.
  useFocusEffect(useCallback(() => {
    if (NavigationFlags.tasksFilter !== null) {
      setActiveFilter(NavigationFlags.tasksFilter);
      setDateScope(NavigationFlags.tasksDateScope ?? undefined);
      setScreenTitle(NavigationFlags.tasksTitle ?? 'Tasks');
      lastAppliedT.current = _t;
      NavigationFlags.tasksFilter = null;
      NavigationFlags.tasksDateScope = null;
      NavigationFlags.tasksTitle = null;
    }
  }, [_t]));

  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const pending = tasks.filter(t => !t.completed);

  const filtered = activeFilter === 'due'
    ? pending.filter(t => new Date(t.dueDate) <= endOfToday)
    : activeFilter === 'viewing' && dateScope === 'today'
      ? pending.filter(t => t.type === 'viewing' && new Date(t.dueDate).toDateString() === now.toDateString())
      : activeFilter === 'all'
        ? pending
        : pending.filter(t => t.type === activeFilter);

  // Sort each section descending by date (most recent first)
  const desc = (a: any, b: any) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
  const overdue  = filtered.filter(t => new Date(t.dueDate) < now).sort(desc);
  const upcoming = filtered.filter(t => new Date(t.dueDate) >= now).sort(desc);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const TaskRow = ({ task, isOverdue }: { task: any; isOverdue: boolean }) => {
    const taskColor = TASK_COLORS[task.type] || colors.primary;
    return (
      <TouchableOpacity
        style={[styles.taskCard, { backgroundColor: colors.card, borderColor: isOverdue ? colors.destructive + '40' : colors.border }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          
          router.push(`/task/${task.id}`);
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.taskIconWrap, { backgroundColor: taskColor + '18' }]}>
          <Ionicons name={TASK_ICONS[task.type] || 'checkbox-outline'} size={20} color={taskColor} />
        </View>
        <View style={styles.taskBody}>
          <Text style={[styles.taskTitle, { color: colors.foreground }]} numberOfLines={2}>{task.title}</Text>
          {task.propertyAddress && (
            <Text style={[styles.taskSub, { color: colors.mutedForeground }]} numberOfLines={1}>{task.propertyAddress}</Text>
          )}
          <View style={styles.taskMeta}>
            <Ionicons name="time-outline" size={12} color={isOverdue ? colors.destructive : colors.mutedForeground} />
            <Text style={[styles.taskDate, { color: isOverdue ? colors.destructive : colors.mutedForeground }]}>
              {isOverdue ? `Overdue · ${formatDate(task.dueDate)}` : formatDate(task.dueDate)}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
                <Text style={[styles.title, { color: colors.foreground }]}>{screenTitle}</Text>
        <TouchableOpacity
          testID="new-task-button"
          accessibilityLabel="Create new task"
          onPress={() => router.push('/task/new')}
          style={[styles.newTaskBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={styles.newTaskText}>New Task</Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={[styles.summaryRow]}>
        <View style={[styles.summaryCard, { backgroundColor: colors.destructive + '12', borderColor: colors.destructive + '30' }]}>
          <Text style={[styles.summaryNum, { color: colors.destructive }]}>{overdue.length}</Text>
          <Text style={[styles.summaryLabel, { color: colors.destructive }]}>Overdue</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
          <Text style={[styles.summaryNum, { color: colors.primary }]}>{upcoming.length}</Text>
          <Text style={[styles.summaryLabel, { color: colors.primary }]}>Upcoming</Text>
        </View>
      </View>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterPill, { backgroundColor: activeFilter === f.key ? colors.primary : colors.card, borderColor: activeFilter === f.key ? colors.primary : colors.border }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setActiveFilter(f.key); setDateScope(undefined); setScreenTitle('Tasks'); }}
          >
            <Text style={[styles.filterLabel, { color: activeFilter === f.key ? '#FFF' : colors.foreground }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Overdue */}
      {overdue.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.destructive }]}>Overdue</Text>
          {overdue.map(t => <TaskRow key={t.id} task={t} isOverdue />)}
        </>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Upcoming</Text>
          {upcoming.map(t => <TaskRow key={t.id} task={t} isOverdue={false} />)}
        </>
      )}

      {filtered.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No tasks here</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  newTaskBtn: { height: 36, borderRadius: 18, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  newTaskText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center' },
  summaryNum: { fontSize: 28, fontWeight: '800', marginBottom: 2 },
  summaryLabel: { fontSize: 12, fontWeight: '600' },
  filterScroll: { marginHorizontal: -16, marginBottom: 18 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterLabel: { fontSize: 13, fontWeight: '600' },
  sectionLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },
  taskCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  taskIconWrap: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  taskBody: { flex: 1 },
  taskTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  taskSub: { fontSize: 12, marginBottom: 4 },
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  taskDate: { fontSize: 11, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500' },
});