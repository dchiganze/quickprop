import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';

type BannerState = 'offline' | 'online' | null;

export function SyncStatusBanner() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { cloudSyncState } = useData();
  const [bannerState, setBannerState] = useState<BannerState>(null);
  const wasOffline = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }

    if (cloudSyncState === 'offline') {
      wasOffline.current = true;
      setBannerState('offline');
      return;
    }

    if (cloudSyncState === 'synced' && wasOffline.current) {
      wasOffline.current = false;
      setBannerState('online');
      hideTimer.current = setTimeout(() => setBannerState(null), 4200);
    }
  }, [cloudSyncState]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  if (!bannerState) return null;

  const isOffline = bannerState === 'offline';
  const label = isOffline ? "You're offline" : "You're back online";

  return (
    <View
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        styles.banner,
        {
          bottom: 56 + insets.bottom,
          backgroundColor: isOffline ? colors.destructive : colors.primary,
        },
      ]}
    >
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 100,
    elevation: 10,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});