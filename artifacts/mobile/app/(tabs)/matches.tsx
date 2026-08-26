import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Platform, RefreshControl,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { AlertsSheet } from '@/components/AlertsSheet';
import {
  createCollaborationRequest, discoverCollaborations, listCollaborationRequests,
  updateCollaborationRequest,
} from '@/utils/collaboration';
import { openWhatsAppMessage } from '@/utils/whatsapp';
import { CollaborationListing, CollaborationRequest } from '@/types';

type Section = 'discover' | 'incoming' | 'outgoing';

function money(value: number, currency: string) {
  return `${currency} ${value.toLocaleString()}`;
}

function propertyLabel(property: CollaborationListing) {
  const kind = property.listingType === 'rent' ? 'Rental' : 'For sale';
  return `${property.bedrooms ? `${property.bedrooms}-bed ` : ''}${kind} in ${property.suburb}`;
}

export default function MatchesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { alerts, alertMatches, unseenMatchCount } = useData();
  const [section, setSection] = useState<Section>('discover');
  const [search, setSearch] = useState('');
  const [listings, setListings] = useState<CollaborationListing[]>([]);
  const [incoming, setIncoming] = useState<CollaborationRequest[]>([]);
  const [outgoing, setOutgoing] = useState<CollaborationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [requestingId, setRequestingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [discovery, incomingRequests, outgoingRequests] = await Promise.all([
        discoverCollaborations({ q: search }),
        listCollaborationRequests('incoming'),
        listCollaborationRequests('outgoing'),
      ]);
      setListings(discovery);
      setIncoming(incomingRequests);
      setOutgoing(outgoingRequests);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load Matches.';
      Alert.alert('Matches unavailable', message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeout = setTimeout(() => { load(); }, search ? 350 : 0);
    return () => clearTimeout(timeout);
  }, [load, search]);

  const outgoingByProperty = useMemo(
    () => new Map(outgoing.map(request => [request.propertyId, request])),
    [outgoing],
  );

  const submitRequest = async (property: CollaborationListing) => {
    setRequestingId(property.id);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const request = await createCollaborationRequest(
        property.id,
        `Hi, I would like to collaborate on ${property.reference}.`,
      );
      setOutgoing(current => [request, ...current]);
      Alert.alert('Request sent', 'The listing agent can now accept or decline your collaboration request.');
    } catch (error) {
      Alert.alert('Could not send request', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setRequestingId(null);
    }
  };

  const respondToRequest = async (request: CollaborationRequest, status: 'approved' | 'declined') => {
    try {
      const updated = await updateCollaborationRequest(request.id, status);
      setIncoming(current => current.map(item => item.id === updated.id ? updated : item));
      if (status === 'approved') {
        Alert.alert('Collaboration accepted', 'You can now securely start a WhatsApp conversation with the requesting agent.');
      }
    } catch (error) {
      Alert.alert('Could not update request', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const openAgentWhatsApp = async (request: CollaborationRequest, contact: 'owner' | 'requester') => {
    const name = contact === 'owner' ? request.ownerName : request.requesterName;
    const phone = contact === 'owner' ? request.ownerPhone : request.requesterPhone;
    if (!phone) {
      Alert.alert('Contact unavailable', 'This agent has not added a phone number yet.');
      return;
    }
    const ref = request.property?.reference || `listing ${request.propertyId}`;
    await openWhatsAppMessage(`Hi ${name || 'there'}, our collaboration request for ${ref} was accepted. Shall we coordinate the next steps?`);
  };

  const renderListing = ({ item }: { item: CollaborationListing }) => {
    const ownListing = String(item.agentId ?? '') === user?.id;
    const request = outgoingByProperty.get(item.id);
    const isRequesting = requestingId === item.id;
    const image = item.photos?.[0];
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {image ? <Image source={{ uri: image }} style={styles.photo} /> : (
          <View style={[styles.photo, styles.photoFallback, { backgroundColor: colors.muted }]}>
            <Ionicons name="home-outline" size={34} color={colors.primary} />
          </View>
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{propertyLabel(item)}</Text>
            {item.collaborationEnabled && !ownListing && (
              <View style={[styles.collabBadge, { backgroundColor: colors.accent + '22' }]}>
                <Ionicons name="people" size={12} color={colors.accent} />
                <Text style={[styles.collabBadgeText, { color: colors.accent }]}>Open</Text>
              </View>
            )}
          </View>
          <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.address || item.suburb} · {item.reference}
          </Text>
          <Text style={[styles.price, { color: colors.foreground }]}>{money(item.price, item.currency)}</Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {[item.bedrooms ? `${item.bedrooms} beds` : null, item.bathrooms ? `${item.bathrooms} baths` : null, ...(item.features || []).slice(0, 2)].filter(Boolean).join(' · ')}
          </Text>
          {ownListing ? (
            <View style={[styles.ownPill, { backgroundColor: colors.muted }]}>
              <Text style={[styles.ownPillText, { color: colors.mutedForeground }]}>Your listing</Text>
            </View>
          ) : request ? (
            <View style={[styles.requestStatus, { backgroundColor: request.status === 'approved' ? colors.accent + '20' : colors.muted }]}>
              <Ionicons name={request.status === 'approved' ? 'checkmark-circle-outline' : 'time-outline'} size={16} color={request.status === 'approved' ? colors.accent : colors.mutedForeground} />
              <Text style={[styles.requestStatusText, { color: request.status === 'approved' ? colors.accent : colors.mutedForeground }]}>
                {request.status === 'approved' ? 'Collaboration accepted' : request.status === 'pending' ? 'Request pending' : `Request ${request.status}`}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.primaryAction, { backgroundColor: colors.primary }]}
              onPress={() => submitRequest(item)}
              disabled={isRequesting}
            >
              {isRequesting ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="send-outline" size={16} color="#FFF" />}
              <Text style={styles.primaryActionText}>Request collaboration</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderRequest = ({ item }: { item: CollaborationRequest }) => {
    const isIncoming = section === 'incoming';
    const property = item.property;
    const approved = item.status === 'approved';
    const phone = isIncoming ? item.requesterPhone : item.ownerPhone;
    const contact = isIncoming ? item.requesterName : item.ownerName;
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.requestIcon, { backgroundColor: approved ? colors.accent + '1E' : colors.primary + '16' }]}>
          <Ionicons name={approved ? 'checkmark-circle-outline' : 'people-outline'} size={26} color={approved ? colors.accent : colors.primary} />
        </View>
        <View style={styles.requestBody}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
            {property ? propertyLabel(property) : `Property #${item.propertyId}`}
          </Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {isIncoming ? `${item.requesterName || 'An agent'} wants to collaborate` : `Request sent to ${item.ownerName || 'listing agent'}`}
          </Text>
          {item.message ? <Text style={[styles.requestMessage, { color: colors.foreground }]} numberOfLines={2}>{item.message}</Text> : null}
          {item.status === 'pending' && isIncoming ? (
            <View style={styles.responseRow}>
              <TouchableOpacity style={[styles.declineButton, { borderColor: colors.border }]} onPress={() => respondToRequest(item, 'declined')}>
                <Text style={[styles.declineText, { color: colors.foreground }]}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.acceptButton, { backgroundColor: colors.accent }]} onPress={() => respondToRequest(item, 'approved')}>
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
            </View>
          ) : approved ? (
            <TouchableOpacity
              style={[styles.whatsAppButton, { backgroundColor: '#25D366' }]}
              onPress={() => openAgentWhatsApp(item, isIncoming ? 'requester' : 'owner')}
              disabled={!phone}
            >
              <Ionicons name="logo-whatsapp" size={17} color="#FFF" />
              <Text style={styles.acceptText}>WhatsApp {contact || 'agent'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.ownPill, { backgroundColor: colors.muted }]}>
              <Text style={[styles.ownPillText, { color: colors.mutedForeground }]}>{item.status === 'pending' ? 'Awaiting a response' : `Request ${item.status}`}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const currentData = section === 'discover' ? listings : section === 'incoming' ? incoming : outgoing;
  const emptyTitle = section === 'discover' ? 'No properties found' : section === 'incoming' ? 'No incoming requests' : 'No outgoing requests';
  const emptyText = section === 'discover'
    ? 'Search every property at your agency and external listings opened for collaboration.'
    : section === 'incoming'
      ? 'Requests from other agents will appear here.'
      : 'Collaboration requests you send will appear here.';

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16), backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Matches</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Discover, collaborate, and track requests</Text>
          </View>
          <TouchableOpacity style={[styles.alertButton, { backgroundColor: colors.muted }]} onPress={() => setAlertsOpen(true)}>
            <Ionicons name="notifications-outline" size={20} color={colors.primary} />
            {(unseenMatchCount > 0 || alerts.length > 0) && <View style={[styles.countBadge, { backgroundColor: colors.accent }]}><Text style={styles.countText}>{unseenMatchCount || alerts.length}</Text></View>}
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.alertsSummary, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]} onPress={() => setAlertsOpen(true)}>
          <Ionicons name="bookmark-outline" size={17} color={colors.primary} />
          <Text style={[styles.alertsSummaryText, { color: colors.foreground }]}>
            Saved alerts · {alerts.length} criteria{unseenMatchCount ? ` · ${unseenMatchCount} new` : ''}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
        <View style={[styles.search, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Road, suburb, amenities, size, beds, price…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
            returnKeyType="search"
          />
        </View>
        <View style={styles.tabs}>
          {([
            ['discover', 'Discover'],
            ['incoming', `Requests${incoming.filter(request => request.status === 'pending').length ? ` (${incoming.filter(request => request.status === 'pending').length})` : ''}`],
            ['outgoing', 'Sent'],
          ] as [Section, string][]).map(([value, label]) => (
            <TouchableOpacity key={value} style={[styles.tab, { borderBottomColor: section === value ? colors.primary : 'transparent' }]} onPress={() => setSection(value)}>
              <Text style={[styles.tabText, { color: section === value ? colors.primary : colors.mutedForeground }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <FlatList
        data={currentData}
        keyExtractor={(item: CollaborationListing | CollaborationRequest) => String(item.id)}
        renderItem={section === 'discover' ? renderListing as any : renderRequest as any}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }, !loading && currentData.length === 0 && styles.emptyList]}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Ionicons name={section === 'discover' ? 'search-outline' : 'people-outline'} size={42} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{emptyTitle}</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{emptyText}</Text>
          </View>
        ) : null}
        showsVerticalScrollIndicator={false}
      />
      <AlertsSheet visible={alertsOpen} onClose={() => setAlertsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 4, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, marginTop: 3 },
  alertButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, position: 'relative' },
  countBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  alertsSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, borderRadius: 12 },
  alertsSummaryText: { flex: 1, fontSize: 13, fontWeight: '600' },
  search: { flexDirection: 'row', gap: 9, alignItems: 'center', borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 14 },
  tabs: { flexDirection: 'row', gap: 18 },
  tab: { paddingVertical: 10, borderBottomWidth: 2 },
  tabText: { fontSize: 13, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  emptyList: { flexGrow: 1 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', flexDirection: 'row' },
  photo: { width: 102, minHeight: 178 },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, padding: 12, gap: 6 },
  cardTitleRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800' },
  collabBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  collabBadgeText: { fontSize: 10, fontWeight: '800' },
  meta: { fontSize: 12, lineHeight: 17 },
  price: { fontSize: 15, fontWeight: '800', marginTop: 1 },
  primaryAction: { marginTop: 4, paddingVertical: 9, borderRadius: 9, alignItems: 'center', justifyContent: 'center', gap: 6, flexDirection: 'row' },
  primaryActionText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  ownPill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginTop: 4 },
  ownPillText: { fontSize: 11, fontWeight: '700' },
  requestStatus: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginTop: 4 },
  requestStatusText: { fontSize: 11, fontWeight: '700' },
  requestIcon: { width: 62, alignItems: 'center', justifyContent: 'center' },
  requestBody: { flex: 1, padding: 13, gap: 7 },
  requestMessage: { fontSize: 12, lineHeight: 17 },
  responseRow: { flexDirection: 'row', gap: 8, marginTop: 3 },
  declineButton: { flex: 1, borderWidth: 1, borderRadius: 9, alignItems: 'center', paddingVertical: 8 },
  declineText: { fontSize: 12, fontWeight: '800' },
  acceptButton: { flex: 1, borderRadius: 9, alignItems: 'center', paddingVertical: 8 },
  acceptText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  whatsAppButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, marginTop: 3 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
});