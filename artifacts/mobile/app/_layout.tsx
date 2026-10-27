import React, { useEffect } from 'react';
import { Appearance, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';
import { ConnectivityProvider } from '@/contexts/ConnectivityContext';
import { useColors } from '@/hooks/useColors';
import { SplashScreenView } from '@/components/SplashScreenView';
import * as Sentry from '@sentry/react-native';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { apiOrigin, getStoredAccessToken } from '@/contexts/AuthContext';
import * as Notifications from 'expo-notifications';
import { NavigationFlags } from '@/utils/navigationFlags';
import '@/utils/pushNotifications';

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

// Generated API calls are used by DataContext. Configure them once for Expo so
// every request targets the production API and carries the secure bearer token.
setBaseUrl(apiOrigin);
setAuthTokenGetter(getStoredAccessToken);

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const colors = useColors();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string; propertyId?: number | string } | undefined;
      if (data?.type === 'viewing_reminder') {
        router.push('/viewings');
        return;
      }
      if (data?.propertyId) {
        router.push(`/listing/${data.propertyId}` as never);
        return;
      }
      NavigationFlags.notificationsFromDashboard = true;
      router.push('/notifications');
    });
    return () => subscription.remove();
  }, []);

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
        <Stack.Screen name="task/[id]" />
        <Stack.Screen
          name="task/new"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="lead/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="viewings" />
        <Stack.Screen name="housekeeping" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="brochure" />
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
    // Restore user's dark mode preference
    AsyncStorage.getItem('@qp_dark_mode').then(val => {
      if (val !== null) {
        Appearance.setColorScheme(val === 'true' ? 'dark' : 'light');
      }
    });
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ConnectivityProvider>
            <AuthProvider>
              <DataProvider>
                <RootLayoutNav />
              </DataProvider>
            </AuthProvider>
          </ConnectivityProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
