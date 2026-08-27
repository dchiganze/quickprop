import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useData } from '@/contexts/DataContext';

type BannerState = 'offline' | 'online' | null;

const BANNER_HEIGHT = 40;

export function SyncStatusBanner() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { cloudSyncEnabled, cloudSyncState } = useData();
  const [bannerState, setBannerState] = useState<BannerState>(null);
  const wasOffline = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translateY = useRef(new Animated.Value(BANNER_HEIGHT)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;

  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const slideIn = () => {
    translateY.stopAnimation();
    Animated.timing(translateY, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  };

  const swapMessage = (nextState: Exclude<BannerState, null>) => {
    Animated.timing(textOpacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setBannerState(nextState);
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

  useEffect(() => {
    clearHideTimer();

    if (!cloudSyncEnabled) {
      wasOffline.current = false;
      translateY.stopAnimation();
      translateY.setValue(BANNER_HEIGHT);
      setBannerState(null);
      return;
    }

    if (cloudSyncState === 'offline') {
      wasOffline.current = true;
      if (bannerState !== 'offline') {
        textOpacity.setValue(1);
        setBannerState('offline');
      }
      slideIn();
      return;
    }

    if (cloudSyncState === 'synced' && wasOffline.current) {
      wasOffline.current = false;
      swapMessage('online');
      hideTimer.current = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: BANNER_HEIGHT,
          duration: 260,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setBannerState(null);
        });
      }, 2600);
    }
  }, [cloudSyncEnabled, cloudSyncState]);

  useEffect(() => () => {
    clearHideTimer();
  }, []);

  if (!bannerState) return null;

  const isOffline = bannerState === 'offline';
  const label = isOffline ? "You're offline" : "You're back online";

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        styles.banner,
        {
          bottom: 56 + insets.bottom,
          backgroundColor: colors.info,
          transform: [{ translateY }],
        },
      ]}
    >
      <Animated.Text style={[styles.text, { opacity: textOpacity }]}>{label}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    minHeight: BANNER_HEIGHT,
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