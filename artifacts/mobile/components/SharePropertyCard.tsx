import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { Property } from '@/types';
import { getPrimaryListingPhoto } from '@/utils/listingPhoto';
import colors from '@/constants/colors';

const CARD_WIDTH = 360;
const CARD_HEIGHT = 450;
const PHOTO_HEIGHT = 328;

export interface SharePropertyCardHandle {
  capture: () => Promise<string>;
}

interface SharePropertyCardProps {
  property: Property;
  catalogueUrl: string;
}

function titleCase(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function propertyTypeLabel(type: Property['type']): string {
  if (type === 'sale') return 'For Sale';
  if (type === 'rent') return 'To Rent';
  return titleCase(type);
}

function formatPrice(property: Property): string {
  if (!Number.isFinite(property.price) || property.price <= 0 || !property.currency) return '';
  const amount = property.price >= 1_000_000
    ? `${(property.price / 1_000_000).toFixed(1)}M`
    : property.price.toLocaleString();
  return `${property.currency} ${amount}${property.type === 'rent' ? '/month' : ''}`;
}

export function buildShareCardDescription(property: Property): string {
  const details: string[] = [];
  const bedrooms = Number.isFinite(property.bedrooms) && property.bedrooms! > 0
    ? `${property.bedrooms} bedroom${property.bedrooms === 1 ? '' : 's'}`
    : '';
  const bathrooms = Number.isFinite(property.bathrooms) && property.bathrooms! > 0
    ? `${property.bathrooms} bathroom${property.bathrooms === 1 ? '' : 's'}`
    : '';
  const type = propertyTypeLabel(property.type).toLowerCase();
  const location = property.suburb?.trim();
  const price = formatPrice(property);

  if (bedrooms) details.push(bedrooms);
  if (bathrooms) details.push(bathrooms);
  details.push(type);
  if (location) details.push(`in ${location}`);
  if (price) details.push(`· ${price}`);

  const summary = details.join(' ').replace(/\s+·/g, ' ·').trim();
  const description = property.description?.replace(/\s+/g, ' ').trim();
  const features = property.features?.filter(Boolean).slice(0, 2);
  const featureSentence = features?.length ? `Includes ${features.join(' and ')}.` : '';

  if (description) {
    return `${summary}. ${description}${description.endsWith('.') ? '' : '.'}`;
  }
  if (featureSentence) return `${summary}. ${featureSentence}`;
  return summary;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export const SharePropertyCard = forwardRef<SharePropertyCardHandle, SharePropertyCardProps>(
  function SharePropertyCard({ property, catalogueUrl }, ref) {
    const viewShotRef = useRef<ViewShot>(null);
    const photoUri = getPrimaryListingPhoto(property);
    const [imageFailed, setImageFailed] = useState(false);
    const readyRef = useRef(!photoUri);
    const waitersRef = useRef<Array<() => void>>([]);

    const markReady = () => {
      readyRef.current = true;
      const waiters = waitersRef.current.splice(0);
      waiters.forEach(resolve => resolve());
    };

    useEffect(() => {
      readyRef.current = !photoUri;
      setImageFailed(false);
      if (!photoUri) markReady();
    }, [photoUri]);

    useImperativeHandle(ref, () => ({
      capture: async () => {
        if (!readyRef.current) {
          await new Promise<void>(resolve => waitersRef.current.push(resolve));
        }
        await wait(100);
        const capture = viewShotRef.current?.capture;
        if (!capture) throw new Error('Unable to prepare the property image.');
        return capture.call(viewShotRef.current);
      },
    }), []);

    const displayUrl = catalogueUrl.replace(/^https?:\/\//i, '');
    const description = buildShareCardDescription(property);
    const price = formatPrice(property);
    const stats = [
      property.bedrooms !== undefined && property.bedrooms > 0 ? `${property.bedrooms} beds` : '',
      property.bathrooms !== undefined && property.bathrooms > 0 ? `${property.bathrooms} baths` : '',
      property.garages !== undefined && property.garages > 0 ? `${property.garages} garages` : '',
    ].filter(Boolean);

    return (
      <ViewShot
        ref={viewShotRef}
        style={styles.card}
        options={{ format: 'jpg', quality: 0.92, width: 1080, height: 1350 }}
      >
        <View style={styles.photoSection}>
          {photoUri && !imageFailed ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.photo}
              resizeMode="cover"
              onLoad={markReady}
              onError={() => {
                setImageFailed(true);
                markReady();
              }}
            />
          ) : (
            <View style={styles.placeholder}>
              <Image source={require('../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
              <Text style={styles.placeholderLabel}>Property photo unavailable</Text>
            </View>
          )}
        </View>

        <View style={styles.detailsSection}>
          <View style={styles.detailsHeader}>
            <Text style={styles.typeLabel} numberOfLines={1}>{propertyTypeLabel(property.type)}</Text>
            <Text style={styles.reference} numberOfLines={1}>{property.referenceNumber}</Text>
          </View>
          {!!price && <Text style={styles.price} numberOfLines={1}>{price}</Text>}
          {!!property.suburb && <Text style={styles.location} numberOfLines={1}>{property.suburb}</Text>}
          {!!stats.length && <Text style={styles.stats} numberOfLines={1}>{stats.join('  ·  ')}</Text>}
          {!!description && (
            <Text style={styles.description} numberOfLines={2} ellipsizeMode="tail">
              {description}
            </Text>
          )}
          <View style={styles.catalogueRow}>
            <Text style={styles.catalogueLabel}>View my full catalogue</Text>
            <Text style={styles.catalogueUrl} numberOfLines={2} ellipsizeMode="middle">{displayUrl}</Text>
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
  photoSection: {
    width: CARD_WIDTH,
    height: PHOTO_HEIGHT,
    backgroundColor: colors.light.muted,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  logo: {
    width: 160,
    height: 48,
  },
  placeholderLabel: {
    color: colors.light.mutedForeground,
    fontSize: 11,
    fontWeight: '600',
  },
  detailsSection: {
    flex: 1,
    backgroundColor: colors.light.card,
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 10,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  typeLabel: {
    flex: 1,
    color: colors.light.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  reference: {
    color: colors.light.mutedForeground,
    fontSize: 9,
    fontWeight: '700',
  },
  price: {
    color: colors.light.foreground,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  location: {
    color: colors.light.mutedForeground,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  stats: {
    color: colors.light.foreground,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 3,
  },
  description: {
    color: colors.light.foreground,
    fontSize: 9,
    lineHeight: 12,
    marginTop: 4,
  },
  catalogueRow: {
    borderTopColor: colors.light.border,
    borderTopWidth: 1,
    marginTop: 'auto',
    paddingTop: 5,
  },
  catalogueLabel: {
    color: colors.light.accent,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  catalogueUrl: {
    color: colors.light.primary,
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 10,
    marginTop: 1,
  },
});
