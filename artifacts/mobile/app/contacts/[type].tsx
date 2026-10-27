import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AgentContact,
  getGetAgentContactsQueryKey,
  useCreateAgentContactReviewInvitation,
  useGetAgentContacts,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { apiBaseUrl, getStoredAccessToken } from '@/contexts/AuthContext';

type ContactKind = 'seller' | 'landlord';

async function uploadMandate(asset: ImagePicker.ImagePickerAsset, propertyId: number) {
  if (!apiBaseUrl) throw new Error('QuickProp is not connected. Check your internet connection and try again.');
  const token = await getStoredAccessToken();
  if (!token) throw new Error('Please sign in again to store this mandate.');
  const fileResponse = await fetch(asset.uri);
  const file = await fileResponse.blob();
  const contentType = asset.mimeType || file.type || 'image/jpeg';
  if (!contentType.startsWith('image/')) throw new Error('Please capture the mandate as an image.');
  if (file.size > 25 * 1024 * 1024) throw new Error('The mandate image must be under 25 MB.');

  const request = await fetch(`${apiBaseUrl}/storage/uploads/request-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: asset.fileName || `mandate-${propertyId}.${contentType.split('/')[1] || 'jpg'}`,
      size: file.size,
      contentType,
    }),
  });
  const target = await request.json().catch(() => null) as { uploadURL?: string; objectPath?: string; error?: string } | null;
  if (!request.ok || !target?.uploadURL || !target.objectPath) {
    throw new Error(target?.error || 'Could not prepare the mandate upload.');
  }
  const stored = await fetch(target.uploadURL, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!stored.ok) throw new Error('The mandate image could not be uploaded. Please try again.');

  const saved = await fetch(`${apiBaseUrl}/agent-contacts/${propertyId}/mandates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: asset.fileName || `Mandate ${propertyId}`,
      objectPath: target.objectPath,
      sizeKb: Math.max(1, Math.ceil(file.size / 1024)),
    }),
  });
  const document = await saved.json().catch(() => null) as { error?: string } | null;
  if (!saved.ok) throw new Error(document?.error || 'The mandate could not be saved to this listing.');
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ContactRecordsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string }>();
  const kind: ContactKind = params.type === 'landlord' ? 'landlord' : 'seller';
  const title = kind === 'seller' ? 'Sellers' : 'Landlords';
  const queryClient = useQueryClient();
  const { data: contacts, isLoading, isError, refetch } = useGetAgentContacts({ type: kind });
  const requestReview = useCreateAgentContactReviewInvitation();
  const [busyPropertyId, setBusyPropertyId] = useState<number | null>(null);

  const captureMandate = async (propertyId: number) => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow camera access to scan and store a mandate.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled || !result.assets[0]) return;
      setBusyPropertyId(propertyId);
      await uploadMandate(result.assets[0], propertyId);
      await queryClient.invalidateQueries({ queryKey: getGetAgentContactsQueryKey({ type: kind }) });
      Alert.alert('Mandate saved', 'The scanned mandate is now stored with this property.');
    } catch (error) {
      Alert.alert('Could not save mandate', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusyPropertyId(null);
    }
  };

  const openReviewRequest = async (propertyId: number) => {
    try {
      setBusyPropertyId(propertyId);
      const invitation = await requestReview.mutateAsync({ propertyId });
      const text = `Hi ${invitation.recipientName}, I’d appreciate it if you could leave a review about working with me on ${invitation.propertyReference} through QuickProp: ${invitation.url}`;
      const phone = invitation.phone?.replace(/\D/g, '').replace(/^00/, '');
      if (phone) {
        await Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
      } else {
        await Share.share({ message: text, url: invitation.url });
      }
    } catch (error) {
      Alert.alert('Could not create review link', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusyPropertyId(null);
    }
  };

  const openMandate = async (objectPath?: string | null) => {
    if (!objectPath || !apiBaseUrl) return;
    try {
      const token = await getStoredAccessToken();
      const response = await fetch(`${apiBaseUrl}/storage/media-url?objectPath=${encodeURIComponent(objectPath)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const result = await response.json().catch(() => null) as { url?: string } | null;
      if (!response.ok || !result?.url) throw new Error('The saved document could not be opened.');
      await Linking.openURL(result.url);
    } catch (error) {
      Alert.alert('Could not open mandate', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="arrow-back" size={21} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.heading}>
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Contacts linked to your {kind === 'seller' ? 'sale' : 'rental'} properties
          </Text>
        </View>
        <TouchableOpacity onPress={() => refetch()} style={styles.refresh} accessibilityLabel={`Refresh ${title.toLowerCase()}`}>
          <Ionicons name="refresh-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={[styles.stateText, { color: colors.mutedForeground }]}>Loading {title.toLowerCase()}…</Text></View>
      ) : isError ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Could not load contacts</Text>
          <TouchableOpacity onPress={() => refetch()}><Text style={[styles.link, { color: colors.primary }]}>Try again</Text></TouchableOpacity>
        </View>
      ) : !contacts?.length ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name={kind === 'seller' ? 'briefcase-outline' : 'home-outline'} size={32} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No {title.toLowerCase()} on file</Text>
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>Add contact details to a {kind === 'seller' ? 'sale' : 'rental'} listing to see them here.</Text>
        </View>
      ) : (
        contacts.map((contact) => (
          <ContactCard
            key={contact.id}
            contact={contact}
            kind={kind}
            colors={colors}
            busyPropertyId={busyPropertyId}
            onCaptureMandate={captureMandate}
            onRequestReview={openReviewRequest}
            onOpenMandate={openMandate}
          />
        ))
      )}
      <Text style={[styles.privacy, { color: colors.mutedForeground }]}>Contact details and mandates are private to your agency team.</Text>
    </ScrollView>
  );
}

function ContactCard({
  contact,
  kind,
  colors,
  busyPropertyId,
  onCaptureMandate,
  onRequestReview,
  onOpenMandate,
}: {
  contact: AgentContact;
  kind: ContactKind;
  colors: ReturnType<typeof useColors>;
  busyPropertyId: number | null;
  onCaptureMandate: (propertyId: number) => void;
  onRequestReview: (propertyId: number) => void;
  onOpenMandate: (objectPath?: string | null) => void;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.nameRow}>
        <View style={[styles.avatar, { backgroundColor: colors.secondary }]}><Text style={[styles.avatarText, { color: colors.primary }]}>{contact.name.charAt(0).toUpperCase()}</Text></View>
        <View style={styles.flex}>
          <Text style={[styles.name, { color: colors.foreground }]}>{contact.name}</Text>
          {contact.idNumber ? <Text style={[styles.detail, { color: colors.mutedForeground }]}>ID: {contact.idNumber}</Text> : null}
        </View>
      </View>
      {!!contact.phone && <TouchableOpacity style={styles.contactLine} onPress={() => Linking.openURL(`tel:${contact.phone}`)}><Ionicons name="call-outline" size={16} color={colors.primary} /><Text style={[styles.detail, { color: colors.foreground }]}>{contact.phone}</Text></TouchableOpacity>}
      {!!contact.email && <View style={styles.contactLine}><Ionicons name="mail-outline" size={16} color={colors.primary} /><Text style={[styles.detail, { color: colors.foreground }]}>{contact.email}</Text></View>}
      {!!contact.postalAddress && <View style={styles.contactLine}><Ionicons name="location-outline" size={16} color={colors.primary} /><Text style={[styles.detail, { color: colors.foreground }]}>{contact.postalAddress}</Text></View>}
      {!!contact.notes && <Text style={[styles.notes, { color: colors.mutedForeground }]}>{contact.notes}</Text>}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      {contact.properties.map((property) => {
        const closed = ['sold', 'rented', 'withdrawn', 'archived'].includes(property.status)
          || ['sold', 'let', 'withdrawn'].includes(property.availabilityStatus ?? '');
        const busy = busyPropertyId === property.id;
        return (
          <View key={property.id} style={[styles.property, { borderColor: colors.border }]}>
            <View style={styles.propertyHeader}>
              <View style={styles.flex}>
                <Text style={[styles.propertyTitle, { color: colors.foreground }]}>{property.title}</Text>
                <Text style={[styles.detail, { color: colors.mutedForeground }]}>{property.reference} · {property.suburb}, {property.city}</Text>
              </View>
              <Text style={[styles.status, { color: colors.primary }]}>{statusLabel(property.status)}</Text>
            </View>
            {property.documents.map((document) => (
              <TouchableOpacity key={document.id} style={styles.docRow} onPress={() => onOpenMandate(document.url)}>
                <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                <Text style={[styles.detail, { color: colors.primary }]} numberOfLines={1}>{document.name}</Text>
                <Ionicons name="open-outline" size={15} color={colors.primary} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              disabled={busy}
              style={[styles.actionButton, { backgroundColor: colors.secondary, opacity: busy ? 0.55 : 1 }]}
              onPress={() => onCaptureMandate(property.id)}
            >
              {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="scan-outline" size={17} color={colors.primary} />}
              <Text style={[styles.actionText, { color: colors.primary }]}>{busy ? 'Saving…' : 'Scan and store mandate'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!closed || busy}
              style={[styles.actionButton, { backgroundColor: colors.primary, opacity: !closed || busy ? 0.45 : 1 }]}
              onPress={() => onRequestReview(property.id)}
            >
              {busy ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="star-outline" size={17} color="#FFF" />}
              <Text style={[styles.actionText, { color: '#FFF' }]}>{busy ? 'Preparing…' : 'Request a review'}</Text>
            </TouchableOpacity>
            {!closed && <Text style={[styles.reviewHint, { color: colors.mutedForeground }]}>Available after the sale, lease, or mandate closes.</Text>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  refresh: { padding: 10 },
  state: { paddingVertical: 38, alignItems: 'center', gap: 10 },
  stateText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  empty: { borderWidth: 1, borderRadius: 20, padding: 24, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  link: { fontWeight: '700', padding: 8 },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 11 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 19, fontWeight: '800' },
  name: { fontSize: 17, fontWeight: '700' },
  detail: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
  contactLine: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  notes: { fontSize: 13, lineHeight: 18 },
  divider: { height: 1, marginTop: 3 },
  property: { borderBottomWidth: 1, paddingVertical: 10, gap: 9 },
  propertyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  propertyTitle: { fontWeight: '700', fontSize: 14, marginBottom: 2 },
  status: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4 },
  actionButton: { minHeight: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  actionText: { fontSize: 13, fontWeight: '700' },
  reviewHint: { fontSize: 11, textAlign: 'center' },
  privacy: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 2 },
});
