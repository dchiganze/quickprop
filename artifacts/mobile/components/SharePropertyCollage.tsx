import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { Property } from '@/types';
import { getPrimaryListingPhoto } from '@/utils/listingPhoto';

const COLLAGE_WIDTH = 360;
const COLLAGE_HEIGHT = 360;
const TOP_HEIGHT = 238;
const TILE_GAP = 4;
const LOWER_TILE_HEIGHT = COLLAGE_HEIGHT - TOP_HEIGHT - TILE_GAP;

export interface SharePropertyCollageHandle {
  capture: () => Promise<string>;
}

interface SharePropertyCollageProps {
  property: Property;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function getCollagePhotos(property: Property): Array<string | undefined> {
  const uploadedPhotos = property.photos?.filter(photo => typeof photo === 'string' && photo.trim().length > 0) ?? [];
  const primaryPhoto = getPrimaryListingPhoto(property);
  const firstPhoto = uploadedPhotos[0] ?? primaryPhoto;

  return [
    firstPhoto,
    uploadedPhotos[1] ?? firstPhoto,
    uploadedPhotos[2] ?? uploadedPhotos[1] ?? firstPhoto,
  ];
}

function PhotoTile({
  uri,
  style,
  onReady,
}: {
  uri?: string;
  style: StyleProp<ImageStyle>;
  onReady: (uri?: string) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    if (!uri) onReady();
  }, [onReady, uri]);

  if (!uri || imageFailed) {
    return <View style={[styles.tile, styles.placeholder, style as StyleProp<ViewStyle>]} />;
  }

  return (
    <Image
      source={{ uri }}
      style={[styles.tile, style]}
      resizeMode="cover"
      onLoad={() => onReady(uri)}
      onError={() => {
        setImageFailed(true);
        onReady(uri);
      }}
    />
  );
}

export const SharePropertyCollage = forwardRef<SharePropertyCollageHandle, SharePropertyCollageProps>(
  function SharePropertyCollage({ property }, ref) {
    const viewShotRef = useRef<ViewShot>(null);
    const photoUris = useMemo(() => getCollagePhotos(property), [property]);
    const photoKey = photoUris.join('|');
    const pendingPhotosRef = useRef<Set<string>>(new Set());
    const readyRef = useRef(false);
    const waitersRef = useRef<Array<() => void>>([]);

    const resolveWaiters = useCallback(() => {
      const waiters = waitersRef.current.splice(0);
      waiters.forEach(resolve => resolve());
    }, []);

    const markReady = useCallback((uri?: string) => {
      if (uri) pendingPhotosRef.current.delete(uri);
      if (pendingPhotosRef.current.size === 0) {
        readyRef.current = true;
        resolveWaiters();
      }
    }, [resolveWaiters]);

    useEffect(() => {
      pendingPhotosRef.current = new Set(photoUris.filter((uri): uri is string => Boolean(uri)));
      readyRef.current = pendingPhotosRef.current.size === 0;
      if (readyRef.current) resolveWaiters();
    }, [photoKey, photoUris, resolveWaiters]);

    useImperativeHandle(ref, () => ({
      capture: async () => {
        await Promise.all(
          photoUris
            .filter((uri): uri is string => Boolean(uri))
            .map(uri => Image.prefetch(uri).catch(() => false)),
        );
        await wait(100);

        if (!readyRef.current) {
          await Promise.race([
            new Promise<void>(resolve => waitersRef.current.push(resolve)),
            wait(3000),
          ]);
        }

        const capture = viewShotRef.current?.capture;
        if (!capture) throw new Error('Unable to prepare the property collage.');
        return capture.call(viewShotRef.current);
      },
    }), [photoUris]);

    return (
      <ViewShot
        ref={viewShotRef}
        style={styles.collage}
        options={{ format: 'jpg', quality: 0.92, width: 1080, height: 1080 }}
      >
        <PhotoTile uri={photoUris[0]} style={styles.topPhoto} onReady={markReady} />
        <View style={styles.lowerRow}>
          <PhotoTile uri={photoUris[1]} style={styles.lowerPhoto} onReady={markReady} />
          <PhotoTile uri={photoUris[2]} style={styles.lowerPhoto} onReady={markReady} />
        </View>
      </ViewShot>
    );
  },
);

const styles = StyleSheet.create({
  collage: {
    width: COLLAGE_WIDTH,
    height: COLLAGE_HEIGHT,
    backgroundColor: '#FFFFFF',
    gap: TILE_GAP,
  },
  tile: {
    backgroundColor: '#E5E7EB',
  },
  placeholder: {
    backgroundColor: '#E5E7EB',
  },
  topPhoto: {
    width: COLLAGE_WIDTH,
    height: TOP_HEIGHT,
  },
  lowerRow: {
    flexDirection: 'row',
    gap: TILE_GAP,
    width: COLLAGE_WIDTH,
    height: LOWER_TILE_HEIGHT,
  },
  lowerPhoto: {
    width: (COLLAGE_WIDTH - TILE_GAP) / 2,
    height: LOWER_TILE_HEIGHT,
  },
});