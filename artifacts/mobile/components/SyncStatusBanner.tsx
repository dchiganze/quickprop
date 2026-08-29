import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from '@/contexts/ConnectivityContext';

type BannerState = 'offline' | 'online' | null;

export const SYNC_STATUS_BANNER_HEIGHT = 32;

interface SyncStatusBannerProps {
  onVisibilityChange?: (visible: boolean) => void;
}

export function SyncStatusBanner({ onVisibilityChange }: SyncStatusBannerProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isOnline, isOffline: networkIsOffline } = useNetworkStatus();
  const [bannerState, setBannerState] = useState<BannerState>(null);
  const [offlineBackgroundVisible, setOfflineBackgroundVisible] = useState(true);
  const wasOffline = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offlineFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translateY = useRef(new Animated.Value(SYNC_STATUS_BANNER_HEIGHT)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const bannerHeight = SYNC_STATUS_BANNER_HEIGHT + insets.bottom;

  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const clearOfflineFadeTimer = () => {
    if (offlineFadeTimer.current) {
      clearTimeout(offlineFadeTimer.current);
      offlineFadeTimer.current = null;
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

  const swapMessage = (
    nextState: Exclude<BannerState, null>,
    onShown?: () => void,
  ) => {
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
      }).start(onShown);
    });
  };

  useEffect(() => {
    onVisibilityChange?.(Boolean(bannerState));
  }, [bannerState, onVisibilityChange]);

  useEffect(() => {
    if (!bannerState) {
      translateY.setValue(bannerHeight);
    }
  }, [bannerHeight, bannerState, translateY]);

  useEffect(() => {
    clearHideTimer();

    const cloudSyncEnabled = Boolean(user?.id && /^\d+$/.test(user.id));
    if (!cloudSyncEnabled) {
      wasOffline.current = false;
      clearOfflineFadeTimer();
      setOfflineBackgroundVisible(true);
      translateY.stopAnimation();
      translateY.setValue(bannerHeight);
      setBannerState(null);
      return;
    }

    if (networkIsOffline) {
      wasOffline.current = true;
      if (bannerState !== 'offline') {
        textOpacity.setValue(1);
        setOfflineBackgroundVisible(true);
        setBannerState('offline');
      }
      if (!offlineFadeTimer.current) {
        offlineFadeTimer.current = setTimeout(() => {
          offlineFadeTimer.current = null;
          setOfflineBackgroundVisible(false);
        }, 5000);
      }
      slideIn();
      return;
    }

    if (isOnline && wasOffline.current) {
      wasOffline.current = false;
      clearOfflineFadeTimer();
      setOfflineBackgroundVisible(true);
      swapMessage('online', () => {
        hideTimer.current = setTimeout(() => {
          Animated.timing(translateY, {
            toValue: bannerHeight,
            duration: 260,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) setBannerState(null);
          });
        }, 5000);
      });
    }
  }, [bannerHeight, bannerState, user?.id, networkIsOffline, isOnline]);

  useEffect(() => () => {
    clearHideTimer();
    clearOfflineFadeTimer();
  }, []);

  if (!bannerState) return null;

  const isOfflineBanner = bannerState === 'offline';
  const label = isOfflineBanner ? "You're offline" : "You're back online";

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        styles.banner,
        {
          bottom: 0,
          height: bannerHeight,
          paddingBottom: insets.bottom,
          backgroundColor: isOfflineBanner && !offlineBackgroundVisible
            ? colors.background
            : colors.info,
          transform: [{ translateY }],
        },
      ]}
    >
      <Animated.Text style={[styles.text, { color: colors.statusText, opacity: textOpacity }]}>
        {label}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 0,
    zIndex: 100,
    elevation: 10,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
});