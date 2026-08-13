import React, { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ShareHubSheet } from '@/components/ShareHubSheet';
import { AlertsSheet } from '@/components/AlertsSheet';

export default function TabLayout() {
  const colors = useColors();
  const isIOS = Platform.OS === 'ios';
  const insets = useSafeAreaInsets();
  const [shareOpen, setShareOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: isIOS ? 'transparent' : colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            elevation: 0,
            paddingBottom: insets.bottom,
            height: 56 + insets.bottom,
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView
                intensity={100}
                tint="systemChromeMaterial"
                style={StyleSheet.absoluteFill}
              />
            ) : null,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="listings"
          options={{
            title: 'Listings',
            tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="leads"
          options={{
            title: 'Alerts',
            tabBarIcon: ({ color }) => <Ionicons name="notifications-outline" size={22} color={color} />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setAlertsOpen(true);
            },
          }}
        />
        <Tabs.Screen
          name="share"
          options={{
            title: 'Share',
            tabBarIcon: ({ color }) => <Feather name="share-2" size={22} color={color} />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setShareOpen(true);
            },
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
          }}
        />
        <Tabs.Screen name="matches" options={{ href: null }} />
        <Tabs.Screen name="tasks" options={{ href: null }} />
      </Tabs>

      <ShareHubSheet visible={shareOpen} onClose={() => setShareOpen(false)} />
      <AlertsSheet visible={alertsOpen} onClose={() => setAlertsOpen(false)} />
    </>
  );
}
