import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';
import { Property } from '@/types';

const STATUS_COLORS: Record<Property['status'], string> = {
  published: '#10B981', draft: '#F59E0B', archived: '#64748B', sold: '#EF4444', rented: '#8B5CF6', pending: '#3B82F6',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[sStyles.section, { borderColor: colors.border }]}>
      <Text style={[sStyles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      {children}
    </View>
  );
}
const sStyles = StyleSheet.create({
  section: { borderTopWidth: 1, paddingTop: 20, marginBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
});

export default function ListingDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { properties, updateProperty } = useData();
  const property = properties.find(p => p.id === id);

  if (!property) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.foreground }}>Property not found.</Text>
      </View>
    );
  }

  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Share.share({
      title: `${property.referenceNumber} — ${property.address}`,
      message: `${property.address}, ${property.suburb}\n${property.currency} ${property.price.toLocaleString()}\n${property.bedrooms} bed • ${property.bathrooms} bath\n\nRef: ${property.referenceNumber}`,
    });
  };

  const handleMarkSold = () => {
    Alert.alert('Mark as Sold', 'Are you sure you want to mark this property as sold?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Sold', style: 'destructive',
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          updateProperty(property.id, { status: 'sold' });
          router.back();
        },
      },
    ]);
  };

  const price = property.price >= 1000000
    ? `${property.currency} ${(property.price / 1000000).toFixed(2)}M`
    : `${property.currency} ${property.price.toLocaleString()}`;
  const priceDisplay = property.type === 'rent' ? `${price}/mo` : price;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 12), backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.topRef, { color: colors.mutedForeground }]}>{property.referenceNumber}</Text>
        <View style={styles.topActions}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.primary }]}>
            <Ionicons name="create-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        {/* Gallery placeholder */}
        <View style={[styles.gallery, { backgroundColor: colors.muted }]}>
          <Ionicons name="images-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.galleryHint, { color: colors.mutedForeground }]}>No photos added</Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[property.status] }]}>
            <Text style={styles.statusText}>{property.status.charAt(0).toUpperCase() + property.status.slice(1)}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Price & Address */}
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.primary }]}>{priceDisplay}</Text>
            {property.negotiable && <View style={[styles.negBadge, { backgroundColor: colors.accent + '20' }]}><Text style={[styles.negText, { color: colors.accent }]}>Negotiable</Text></View>}
          </View>
          <Text style={[styles.address, { color: colors.foreground }]}>{property.address}</Text>
          <Text style={[styles.suburb, { color: colors.mutedForeground }]}>{property.suburb}</Text>

          {/* Key stats */}
          {(property.bedrooms !== undefined || property.bathrooms !== undefined || property.garages !== undefined) && (
            <View style={[styles.statsRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              {property.bedrooms !== undefined && (
                <View style={styles.statItem}>
                  <Ionicons name="bed-outline" size={20} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{property.bedrooms}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Beds</Text>
                </View>
              )}
              {property.bathrooms !== undefined && (
                <View style={styles.statItem}>
                  <Ionicons name="water-outline" size={20} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{property.bathrooms}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Baths</Text>
                </View>
              )}
              {property.garages !== undefined && property.garages > 0 && (
                <View style={styles.statItem}>
                  <Ionicons name="car-outline" size={20} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{property.garages}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Garages</Text>
                </View>
              )}
              {property.landSize !== undefined && property.landSize > 0 && (
                <View style={styles.statItem}>
                  <Ionicons name="resize-outline" size={20} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{property.landSize}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>m² Land</Text>
                </View>
              )}
              {property.floorArea !== undefined && property.floorArea > 0 && (
                <View style={styles.statItem}>
                  <Ionicons name="expand-outline" size={20} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{property.floorArea}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>m² Floor</Text>
                </View>
              )}
            </View>
          )}

          {/* Description */}
          {property.description && (
            <Section title="DESCRIPTION">
              <Text style={[styles.description, { color: colors.foreground }]}>{property.description}</Text>
            </Section>
          )}

          {/* Features */}
          {property.features.length > 0 && (
            <Section title="FEATURES">
              <View style={styles.features}>
                {property.features.map(f => (
                  <View key={f} style={[styles.featureChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                    <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* Financial */}
          {(property.levies !== undefined || property.rates !== undefined) && (
            <Section title="FINANCIAL">
              <View style={styles.financialRow}>
                {property.rates !== undefined && property.rates > 0 && (
                  <View style={[styles.financialItem, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[styles.financialLabel, { color: colors.mutedForeground }]}>Rates</Text>
                    <Text style={[styles.financialValue, { color: colors.foreground }]}>{property.currency} {property.rates}/mo</Text>
                  </View>
                )}
                {property.levies !== undefined && property.levies > 0 && (
                  <View style={[styles.financialItem, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[styles.financialLabel, { color: colors.mutedForeground }]}>Levies</Text>
                    <Text style={[styles.financialValue, { color: colors.foreground }]}>{property.currency} {property.levies}/mo</Text>
                  </View>
                )}
              </View>
            </Section>
          )}

          {/* Seller Notes (private) */}
          <Section title="SELLER DETAILS — PRIVATE">
            <View style={[styles.sellerCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <View style={styles.sellerRow}>
                <Ionicons name="person-outline" size={15} color={colors.primary} />
                <Text style={[styles.sellerValue, { color: colors.foreground }]}>{property.seller.name}</Text>
              </View>
              <View style={styles.sellerRow}>
                <Ionicons name="call-outline" size={15} color={colors.primary} />
                <Text style={[styles.sellerValue, { color: colors.foreground }]}>{property.seller.phone}</Text>
              </View>
              <View style={styles.sellerRow}>
                <Ionicons name="mail-outline" size={15} color={colors.primary} />
                <Text style={[styles.sellerValue, { color: colors.foreground }]}>{property.seller.email}</Text>
              </View>
              <View style={styles.sellerRow}>
                <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                <Text style={[styles.sellerValue, { color: colors.foreground }]}>
                  {property.seller.mandateType.charAt(0).toUpperCase() + property.seller.mandateType.slice(1)} mandate • Expires {new Date(property.seller.mandateExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              {!!property.seller.notes && (
                <View style={[styles.notesBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.notesText, { color: colors.foreground }]}>{property.seller.notes}</Text>
                </View>
              )}
            </View>
          </Section>

          {/* Property type row */}
          <Section title="PROPERTY INFO">
            <View style={styles.infoGrid}>
              <View style={[styles.infoItem, { backgroundColor: colors.muted }]}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Type</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{property.type.charAt(0).toUpperCase() + property.type.slice(1)}</Text>
              </View>
              <View style={[styles.infoItem, { backgroundColor: colors.muted }]}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Currency</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{property.currency}</Text>
              </View>
              <View style={[styles.infoItem, { backgroundColor: colors.muted }]}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Reference</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{property.referenceNumber}</Text>
              </View>
              <View style={[styles.infoItem, { backgroundColor: colors.muted }]}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Listed</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{new Date(property.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</Text>
              </View>
            </View>
          </Section>
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: colors.secondary }]} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color={colors.primary} />
          <Text style={[styles.bottomBtnText, { color: colors.primary }]}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: colors.secondary }]} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
          <Ionicons name="document-text-outline" size={18} color={colors.primary} />
          <Text style={[styles.bottomBtnText, { color: colors.primary }]}>Brochure</Text>
        </TouchableOpacity>
        {property.status === 'published' && (
          <TouchableOpacity style={[styles.bottomBtn, { backgroundColor: colors.destructive + '15' }]} onPress={handleMarkSold}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.destructive} />
            <Text style={[styles.bottomBtnText, { color: colors.destructive }]}>Sold</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.bottomBtnPrimary, { backgroundColor: colors.primary }]}>
          <Ionicons name="create-outline" size={18} color="#FFF" />
          <Text style={styles.bottomBtnPrimaryText}>Edit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  topRef: { flex: 1, fontSize: 13, fontWeight: '600' },
  topActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  content: { paddingBottom: 40 },
  gallery: { height: 240, alignItems: 'center', justifyContent: 'center', gap: 8 },
  galleryHint: { fontSize: 14 },
  statusBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingTop: 20, gap: 0 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  price: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  negBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  negText: { fontSize: 12, fontWeight: '700' },
  address: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  suburb: { fontSize: 14, marginBottom: 16 },
  statsRow: { flexDirection: 'row', borderRadius: 14, padding: 14, gap: 16, borderWidth: 1, marginBottom: 20, flexWrap: 'wrap' },
  statItem: { alignItems: 'center', gap: 4, minWidth: 50 },
  statValue: { fontSize: 17, fontWeight: '800' },
  statLabel: { fontSize: 11 },
  description: { fontSize: 15, lineHeight: 24 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  featureText: { fontSize: 13, fontWeight: '500' },
  financialRow: { flexDirection: 'row', gap: 10 },
  financialItem: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, gap: 4 },
  financialLabel: { fontSize: 11, fontWeight: '600' },
  financialValue: { fontSize: 15, fontWeight: '700' },
  sellerCard: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 10 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sellerValue: { fontSize: 14, fontWeight: '500', flex: 1 },
  notesBox: { marginTop: 4, padding: 10, borderRadius: 10, borderWidth: 1 },
  notesText: { fontSize: 13, lineHeight: 20 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoItem: { flex: 1, minWidth: '45%', borderRadius: 12, padding: 12, gap: 4 },
  infoLabel: { fontSize: 11, fontWeight: '600' },
  infoValue: { fontSize: 14, fontWeight: '700' },
  bottomBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  bottomBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, paddingVertical: 11 },
  bottomBtnText: { fontSize: 13, fontWeight: '600' },
  bottomBtnPrimary: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, paddingVertical: 11 },
  bottomBtnPrimaryText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});
