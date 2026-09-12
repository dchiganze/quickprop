import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { Property } from '@/types';
import colors from '@/constants/colors';
import { catalogueShareLinks } from '@/utils/shareLinks';
import { formatSharePrice } from '@/utils/shareContent';

export interface ShareCatalogueCardHandle {
  capture: () => Promise<string>;
}

interface ShareCatalogueCardProps {
  properties: Property[];
  mode: 'agent' | 'company';
  agentName?: string;
}

const CARD_WIDTH = 360;
const CARD_HEIGHT = 450;

export const ShareCatalogueCard = forwardRef<ShareCatalogueCardHandle, ShareCatalogueCardProps>(
  function ShareCatalogueCard({ properties, mode, agentName }, ref) {
    const viewShotRef = useRef<ViewShot>(null);
    const shareUrl = catalogueShareLinks(mode === 'agent' ? undefined : undefined).webUrl;
    const forSale = properties.filter(property => property.type === 'sale').length;
    const forRent = properties.filter(property => property.type === 'rent').length;
    const title = mode === 'agent' ? `${agentName?.split(' ')[0] ?? 'My'}'s Listings` : 'Property Catalogue';

    useImperativeHandle(ref, () => ({
      capture: async () => {
        const capture = viewShotRef.current?.capture;
        if (!capture) throw new Error('Unable to prepare the catalogue image.');
        return capture.call(viewShotRef.current);
      },
    }), []);

    return (
      <ViewShot
        ref={viewShotRef}
        style={styles.card}
        options={{ format: 'jpg', quality: 0.92, width: 1080, height: 1350 }}
      >
        <View style={styles.topBar} />
        <View style={styles.content}>
          <Text style={styles.brand}>QUICKPROP</Text>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Text style={styles.subtitle}>Your trusted Harare estate agency</Text>

          <View style={styles.summary}>
            <View>
              <Text style={styles.count}>{properties.length}</Text>
              <Text style={styles.countLabel}>{properties.length === 1 ? 'property' : 'properties'}</Text>
            </View>
            <View style={styles.summaryStats}>
              <Text style={styles.saleCount}>{forSale} for sale</Text>
              <Text style={styles.rentCount}>{forRent} to rent</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>FEATURED LISTINGS</Text>
          {properties.slice(0, 5).map(property => (
            <View key={property.id} style={styles.propertyRow}>
              <View style={styles.propertyCopy}>
                <Text style={styles.propertyName} numberOfLines={1}>
                  {property.bedrooms ? `${property.bedrooms}-bed ` : ''}{property.suburb}
                </Text>
                <Text style={styles.propertyType}>{property.type === 'sale' ? 'For Sale' : 'To Rent'}</Text>
              </View>
              <Text style={styles.propertyPrice} numberOfLines={1}>{formatSharePrice(property)}</Text>
            </View>
          ))}

          <View style={styles.footer}>
            <Text style={styles.footerLabel}>SEE FULL DETAILS ON QUICKPROP</Text>
            <Text style={styles.footerUrl} numberOfLines={1}>{shareUrl.replace(/^https?:\/\//i, '')}</Text>
          </View>
        </View>
      </ViewShot>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: colors.light.card,
  },
  topBar: {
    height: 8,
    backgroundColor: colors.light.accent,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 16,
  },
  brand: {
    color: colors.light.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: colors.light.foreground,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 14,
  },
  subtitle: {
    color: colors.light.mutedForeground,
    fontSize: 11,
    marginTop: 4,
  },
  summary: {
    backgroundColor: colors.light.muted,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  count: {
    color: colors.light.foreground,
    fontSize: 27,
    fontWeight: '800',
  },
  countLabel: {
    color: colors.light.mutedForeground,
    fontSize: 10,
    fontWeight: '600',
    marginTop: -2,
  },
  summaryStats: {
    justifyContent: 'center',
    gap: 4,
  },
  saleCount: {
    color: colors.light.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  rentCount: {
    color: colors.light.info,
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.light.foreground,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 6,
  },
  propertyRow: {
    alignItems: 'center',
    borderTopColor: colors.light.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  propertyCopy: {
    flex: 1,
    marginRight: 8,
  },
  propertyName: {
    color: colors.light.foreground,
    fontSize: 11,
    fontWeight: '700',
  },
  propertyType: {
    color: colors.light.mutedForeground,
    fontSize: 9,
    marginTop: 2,
  },
  propertyPrice: {
    color: colors.light.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  footer: {
    borderTopColor: colors.light.border,
    borderTopWidth: 1,
    marginTop: 'auto',
    paddingTop: 8,
  },
  footerLabel: {
    color: colors.light.accent,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  footerUrl: {
    color: colors.light.primary,
    fontSize: 8,
    fontWeight: '700',
    marginTop: 2,
  },
});