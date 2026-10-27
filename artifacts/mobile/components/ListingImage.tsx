import React, { useEffect, useRef, useState } from 'react';
import { Image, type ImageProps } from 'react-native';
import { useGetStoredMediaUrl } from '@workspace/api-client-react';
import { apiBaseUrl, useAuth } from '@/contexts/AuthContext';
import { getStoredMediaObjectPath } from '@/utils/listingPhoto';

type Props = Omit<ImageProps, 'source'> & { uri: string };

// Keep durable paths in the listing/offline cache; signed URLs belong only in
// the short-lived query cache and must be refreshed before they expire.
export function ListingImage({ uri, ...props }: Props) {
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const retried = useRef(false);
  const currentUri = useRef(uri);
  currentUri.current = uri;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    retried.current = false;
    setAttempt(0);
  }, [uri]);
  const objectPath = getStoredMediaObjectPath(uri);
  const resolveStoredMedia = Boolean(objectPath && apiBaseUrl);
  const media = useGetStoredMediaUrl(
    { objectPath: objectPath ?? '' },
    {
      query: {
        queryKey: ['stored-listing-media', apiBaseUrl, user?.id, objectPath],
        enabled: resolveStoredMedia,
        staleTime: 10 * 60 * 1000,
        refetchInterval: 10 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        retry: 1,
      },
    },
  );
  const resolvedUri = resolveStoredMedia ? media.data?.url : uri;
  const onErrorRef = useRef(props.onError);
  onErrorRef.current = props.onError;
  useEffect(() => {
    if (resolveStoredMedia && media.isError && !media.data) {
      onErrorRef.current?.({
        nativeEvent: { error: 'Unable to authorize this image. Please retry.' },
      } as Parameters<NonNullable<ImageProps['onError']>>[0]);
    }
  }, [resolveStoredMedia, media.isError, media.data]);

  return <Image
    {...props}
    key={`${uri}:${attempt}`}
    source={resolvedUri ? { uri: resolvedUri, ...(attempt ? { cache: 'reload' as const } : {}) } : undefined}
    onError={async event => {
      // A successfully resolved URL can still fail during the native download
      // (including a cached URL expiring while the app was backgrounded).
      // Refresh authorization and remount once; never retry indefinitely.
      if (!retried.current && resolveStoredMedia) {
        retried.current = true;
        const result = await media.refetch();
        if (!mounted.current || currentUri.current !== uri) return;
        if (!result.isError && result.data?.url) {
          setAttempt(value => value + 1);
          return;
        }
      }
      if (mounted.current) onErrorRef.current?.(event);
    }}
  />;
}
