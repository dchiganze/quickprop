import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Property } from '@/types';

interface Props {
  property: Property;
  onPress: () => void;
}

const STATUS_COLORS: Record<Property['status'], string> = {
  published: '#10B981',
  draft: '#F59E0B',
  archived: '#64748B',
  sold: '#EF4444',
  rented: '#8B5CF6',
  pending: '#3B82F6',
};

const STATUS_LABELS: Record<Property['status'], string> = {
  published: 'Live',
  draft: 'Draft',
  archived: 'Archived',
  sold: 'Sold',
  rented: 'Rented',
  pending: 'Pending',
};

function formatPrice(price: number, currency: string, type: Property['type']) {
  const formatted = price >= 1000000
    ? `${currency} ${(price / 1000000).toFixed(1)}M`
    : `${currency} ${(price / 1000).toFixed(0)}k`;
  return type === 'rent' ? `${formatted}/mo` : formatted;
}

export function PropertyCard({ property, onPress }: Props) {
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.foreground }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Photo placeholder / thumbnail */}
      <View style={[styles.imageContainer, { backgroundColor: colors.muted }]}>
        <Image
          source={property.photos[0] ? { uri: property.photos[0] } : require('../assets/images/logo.png')}
          style={styles.mainImage}
          resizeMode={property.photos[0] ? 'cover' : 'contain'}
        />
        {!property.photos[0] && (
          <View style={[styles.fallbackOverlay, { backgroundColor: colors.muted + 'CC' }]}>
            <Ionicons name="home-outline" size={32} color={colors.mutedForeground} />
            <Text style={[styles.fallbackText, { color: colors.mutedForeground }]}>Photo coming soon</Text>
          </View>
        )}
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[property.status] }]}>
          <Text style={styles.statusText}>{STATUS_LABELS[property.status]}</Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.typeText}>{property.type.charAt(0).toUpperCase() + property.type.slice(1)}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={[styles.price, { color: colors.primary }]}>
          {formatPrice(property.price, property.currency, property.type)}
          {property.negotiable && <Text style={[styles.neg, { color: colors.accent }]}> • Neg</Text>}
        </Text>
        <Text style={[styles.address, { color: colors.foreground }]} numberOfLines={1}>
          {property.address}
        </Text>
        <Text style={[styles.suburb, { color: colors.mutedForeground }]}>{property.suburb}</Text>

        {(property.bedrooms !== undefined || property.bathrooms !== undefined) && (
          <View style={styles.stats}>
            {property.bedrooms !== undefined && (
              <View style={styles.stat}>
                <Ionicons name="bed-outline" size={14} color={colors.mutedForeground} />
                <Text style={[styles.statText, { color: colors.mutedForeground }]}>{property.bedrooms}</Text>
              </View>
            )}
            {property.bathrooms !== undefined && (
              <View style={styles.stat}>
                <Ionicons name="water-outline" size={14} color={colors.mutedForeground} />
                <Text style={[styles.statText, { color: colors.mutedForeground }]}>{property.bathrooms}</Text>
              </View>
            )}
            {property.garages !== undefined && property.garages > 0 && (
              <View style={styles.stat}>
                <Ionicons name="car-outline" size={14} color={colors.mutedForeground} />
                <Text style={[styles.statText, { color: colors.mutedForeground }]}>{property.garages}</Text>
              </View>
            )}
            {property.landSize !== undefined && property.landSize > 0 && (
              <View style={styles.stat}>
                <Ionicons name="resize-outline" size={14} color={colors.mutedForeground} />
                <Text style={[styles.statText, { color: colors.mutedForeground }]}>{property.landSize}m²</Text>
              </View>
            )}
          </View>
        )}

        <Text style={[styles.ref, { color: colors.mutedForeground }]}>{property.referenceNumber}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  imageContainer: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mainImage: { width: '100%', height: '100%' },
  fallbackOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 4 },
  fallbackText: { fontSize: 11, fontWeight: '600' },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  typeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  body: { padding: 14 },
  price: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  neg: { fontSize: 14, fontWeight: '600' },
  address: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  suburb: { fontSize: 13, marginBottom: 8 },
  stats: { flexDirection: 'row', gap: 14, marginBottom: 8 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13 },
  ref: { fontSize: 11, fontWeight: '500' },
});
