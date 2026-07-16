import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';
import { Lead, LEAD_STAGES } from '@/types';

const STAGES: Lead['stage'][] = ['new', 'contacted', 'viewing_booked', 'offer', 'negotiation', 'completed', 'lost'];

export default function LeadDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { leads, updateLead } = useData();
  const lead = leads.find(l => l.id === id);
  const [notes, setNotes] = useState(lead?.notes ?? '');
  const [saving, setSaving] = useState(false);

  if (!lead) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.foreground }}>Lead not found.</Text>
      </View>
    );
  }

  const stageInfo = LEAD_STAGES[lead.stage];
  const stageIndex = STAGES.indexOf(lead.stage);

  const handleStageChange = async (stage: Lead['stage']) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateLead(lead.id, { stage });
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateLead(lead.id, { notes });
    setSaving(false);
  };

  const handleMarkLost = () => {
    Alert.alert('Mark as Lost', 'Mark this lead as lost?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark Lost', style: 'destructive', onPress: () => handleStageChange('lost') },
    ]);
  };

  const initials = lead.buyerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 12), backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.foreground }]}>Lead Details</Text>
        <View style={[styles.stagePill, { backgroundColor: stageInfo.color + '20' }]}>
          <Text style={[styles.stagePillText, { color: stageInfo.color }]}>{stageInfo.label}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Buyer card */}
        <View style={[styles.buyerCard, { backgroundColor: colors.primary }]}>
          <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.buyerInfo}>
            <Text style={styles.buyerName}>{lead.buyerName}</Text>
            <Text style={styles.buyerEmail}>{lead.buyerEmail}</Text>
            <Text style={styles.buyerPhone}>{lead.buyerPhone}</Text>
          </View>
          <View style={styles.buyerActions}>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="call" size={18} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="chatbubble" size={18} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="mail" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Property link */}
        <View style={[styles.propertyLink, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="business-outline" size={18} color={colors.primary} />
          <Text style={[styles.propertyAddr, { color: colors.foreground }]} numberOfLines={1}>{lead.propertyAddress}</Text>
          <TouchableOpacity onPress={() => router.push(`/listing/${lead.propertyId}`)}>
            <Ionicons name="arrow-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Stage Pipeline */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PIPELINE STAGE</Text>
        <View style={[styles.pipelineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {STAGES.filter(s => s !== 'lost').map((stage, i) => {
            const info = LEAD_STAGES[stage];
            const isActive = lead.stage === stage;
            const isPast = STAGES.indexOf(lead.stage) > i && lead.stage !== 'lost';
            return (
              <TouchableOpacity
                key={stage}
                style={[
                  styles.pipelineStep,
                  i < STAGES.filter(s => s !== 'lost').length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
                onPress={() => handleStageChange(stage)}
              >
                <View style={[styles.stepDot, { backgroundColor: isActive ? info.color : isPast ? info.color + '40' : colors.muted, borderColor: isActive ? info.color : colors.border }]}>
                  {isPast && <Ionicons name="checkmark" size={12} color={info.color} />}
                  {isActive && <View style={styles.stepDotInner} />}
                </View>
                <Text style={[styles.stepLabel, { color: isActive ? info.color : colors.foreground, fontWeight: isActive ? '700' : '500' }]}>
                  {info.label}
                </Text>
                {isActive && <View style={[styles.activeBadge, { backgroundColor: info.color + '20' }]}><Text style={[styles.activeBadgeText, { color: info.color }]}>Current</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Notes */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NOTES</Text>
        <View style={[styles.notesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.notesInput, { color: colors.foreground }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes about this lead..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: saving ? colors.primary + '60' : colors.primary }]}
            onPress={handleSaveNotes}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Notes'}</Text>
          </TouchableOpacity>
        </View>

        {/* Follow Up */}
        {lead.followUpDate && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>FOLLOW UP</Text>
            <View style={[styles.followUpCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="calendar-outline" size={20} color={colors.accent} />
              <Text style={[styles.followUpDate, { color: colors.foreground }]}>
                {new Date(lead.followUpDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
          </>
        )}

        {/* Lead info */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DETAILS</Text>
        <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Created</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>{new Date(lead.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
          </View>
          <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Email</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>{lead.buyerEmail}</Text>
          </View>
          <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Phone</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>{lead.buyerPhone}</Text>
          </View>
        </View>

        {lead.stage !== 'lost' && (
          <TouchableOpacity style={[styles.lostBtn, { borderColor: colors.destructive }]} onPress={handleMarkLost}>
            <Ionicons name="close-circle-outline" size={18} color={colors.destructive} />
            <Text style={[styles.lostBtnText, { color: colors.destructive }]}>Mark as Lost</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  topTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  stagePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  stagePillText: { fontSize: 12, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 0 },
  buyerCard: {
    borderRadius: 18, padding: 18, marginBottom: 12,
    ...Platform.select({ ios: { shadowColor: '#1A3C6E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 }, android: { elevation: 5 } }),
  },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  buyerInfo: { gap: 3, marginBottom: 14 },
  buyerName: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  buyerEmail: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  buyerPhone: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  buyerActions: { flexDirection: 'row', gap: 10 },
  contactBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  propertyLink: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 20 },
  propertyAddr: { flex: 1, fontSize: 14, fontWeight: '600' },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  pipelineCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  pipelineStep: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  stepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  stepLabel: { flex: 1, fontSize: 15 },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  activeBadgeText: { fontSize: 11, fontWeight: '700' },
  notesCard: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 10, marginBottom: 20 },
  notesInput: { fontSize: 15, minHeight: 100, lineHeight: 22 },
  saveBtn: { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  followUpCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 20 },
  followUpDate: { fontSize: 15, fontWeight: '600', flex: 1 },
  detailCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  detailLabel: { fontSize: 13, fontWeight: '500' },
  detailValue: { fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 20 },
  lostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 14, paddingVertical: 13, marginBottom: 20 },
  lostBtnText: { fontSize: 15, fontWeight: '700' },
});
