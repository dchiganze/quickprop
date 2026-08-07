import React, { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Stack, useNavigationContainerRef } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';
import { useColors } from '@/hooks/useColors';
import { SplashScreenView } from '@/components/SplashScreenView';
import * as Sentry from '@sentry/react-native';

import appJson from '../app.json';

const { version, ios } = appJson.expo;

Sentry.init({
  dsn: 'https://1fc020ce60fd94baa36191fe6da10811@o4511161660669952.ingest.de.sentry.io/4511839292358736',
  release: `${version}+${ios.buildNumber}`,
  tracesSampleRate: 1.0,
  enableNative: true,
});

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const colors = useColors();
  const navRef = useNavigationContainerRef();
  const didReset = useRef(false);

  useEffect(() => {
    if (loading || !user || didReset.current) return;
    didReset.current = true;
    // Wait one tick for the navigator to mount and restore any persisted state,
    // then hard-reset the stack to just (tabs). This prevents any previously
    // open screen (e.g. notifications) from being restored on cold launch.
    const t = setTimeout(() => {
      if (navRef.isReady()) {
        navRef.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: '(tabs)' }],
          })
        );
      }
    }, 0);
    return () => clearTimeout(t);
  }, [loading, user]);

  if (loading) {
    return <SplashScreenView />;
  }

  if (user) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="new-listing"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="listing/[id]" />
        <Stack.Screen name="lead/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="settings" />
      </Stack>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="invite" />
    </Stack>
  );
}

function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
              <DataProvider>
                <RootLayoutNav />
              </DataProvider>
            </AuthProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);