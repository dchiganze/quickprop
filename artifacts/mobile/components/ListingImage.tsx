import React from 'react';
import { Image, type ImageProps } from 'react-native';
import { useGetStoredMediaUrl } from '@workspace/api-client-react';
import { apiBaseUrl, useAuth } from '@/contexts/AuthContext';
import { getStoredMediaObjectPath } from '@/utils/listingPhoto';

type Props = Omit<ImageProps, 'source'> & { uri: string };

// Keep durable paths in the listing/offline cache; signed URLs belong only in
// the short-lived query cache and must be refreshed before they expire.
export function ListingImage({ uri, ...props }: Props) {
  const { user } = useAuth();
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
  const resolvedUri = resolveStoredMedia
    ? media.data?.url ?? (media.isError ? uri : undefined)
    : uri;

  return <Image {...props} source={resolvedUri ? { uri: resolvedUri } : undefined} />;
}
