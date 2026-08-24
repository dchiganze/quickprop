import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useColors } from '@/hooks/useColors';

type InviteState = 'loading' | 'property-ready' | 'invite-ready' | 'catalogue-ready' | 'invalid';

export default function InviteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { properties } = useData();
  const params = useLocalSearchParams<{
    propertyId?: string | string[];
    property?: string | string[];
    id?: string | string[];
    ref?: string | string[];
    invite?: string | string[];
    token?: string | string[];
    catalogue?: string | string[];
    agentId?: string | string[];
  }>();
  const [state, setState] = useState<InviteState>('loading');

  const value = (input?: string | string[]) => Array.isArray(input) ? input[0] : input;
  const target = useMemo(() => ({
    propertyId: value(params.propertyId) || value(params.property) || value(params.id),
    reference: value(params.ref),
    inviteToken: value(params.invite) || value(params.token),
    catalogue: value(params.catalogue),
    agentId: value(params.agentId),
  }), [params]);
  const resolvedPropertyId = target.propertyId
    || properties.find(property => property.referenceNumber === target.reference)?.id;

  useEffect(() => {
    const nextState: InviteState = resolvedPropertyId || target.reference
      ? 'property-ready'
      : target.inviteToken
        ? 'invite-ready'
        : target.catalogue
          ? 'catalogue-ready'
          : 'invalid';
    const timer = setTimeout(() => setState(nextState), 250);
    return () => clearTimeout(timer);
  }, [resolvedPropertyId, target]);

  const continueToTarget = () => {
    if (state === 'property-ready' && resolvedPropertyId && user) {
      router.replace({ pathname: '/listing/[id]', params: { id: resolvedPropertyId } });
      return;
    }
    if (state === 'property-ready' && user) {
      router.replace('/(tabs)/listings');
      return;
    }
    if (state === 'catalogue-ready' && user) {
      router.replace('/(tabs)/share');
      return;
    }
    // Invitations need the account service to validate the token after sign-in.
    // Preserve no token locally; the URL remains the source of truth.
    router.replace('/login');
  };

  const isLoading = state === 'loading';
  const copy = state === 'property-ready'
    ? user
      ? ['Property link received', 'Opening the property in your portfolio.']
      : ['Property link received', `Sign in to view${target.reference ? ` listing ${target.reference}` : ' this listing'}.`]
    : state === 'invite-ready'
      ? ['You’re invited to QuickProp Agent', 'Sign in to continue with this invitation.']
      : state === 'catalogue-ready'
        ? ['Catalogue link received', user ? 'Open the sharing hub to view your catalogue.' : 'Sign in to access this catalogue.']
        : ['This link is incomplete', 'Ask the sender to share a new QuickProp Agent link.'];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 24), paddingBottom: insets.bottom + 24 }]}>
      <View style={[styles.icon, { backgroundColor: state === 'invalid' ? colors.muted : colors.primary + '18' }]}>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : <Ionicons name={state === 'invalid' ? 'link-outline' : 'checkmark-circle-outline'} size={42} color={state === 'invalid' ? colors.mutedForeground : colors.primary} />}
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{isLoading ? 'Opening QuickProp Agent…' : copy[0]}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{isLoading ? 'Checking your shared link.' : copy[1]}</Text>
      {!isLoading && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: state === 'invalid' ? colors.muted : colors.primary }]}
          onPress={state === 'invalid' ? () => router.replace('/login') : continueToTarget}
        >
          <Text style={[styles.buttonText, { color: state === 'invalid' ? colors.foreground : '#fff' }]}>{state === 'invalid' ? 'Go to sign in' : user && state === 'property-ready' ? resolvedPropertyId ? 'Open property' : 'Browse listings' : 'Continue to sign in'}</Text>
          <Ionicons name="arrow-forward" size={18} color={state === 'invalid' ? colors.foreground : '#fff'} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10, maxWidth: 310 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 220, paddingVertical: 15, paddingHorizontal: 20, borderRadius: 14, marginTop: 30 },
  buttonText: { fontSize: 15, fontWeight: '700' },
});