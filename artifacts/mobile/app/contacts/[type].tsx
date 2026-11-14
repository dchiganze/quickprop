import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AgentContact,
  getGetPropertyQueryKey,
  getGetAgentContactsQueryKey,
  getListPropertiesQueryKey,
  useCreateAgentContact,
  useCreateAgentContactReviewInvitation,
  useGetAgentContacts,
  useUpdateAgentContact,
  useUpdateProperty,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { apiBaseUrl, getStoredAccessToken, useAuth } from '@/contexts/AuthContext';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

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
  const { user, loading: authLoading } = useAuth();
  const remoteAgentId = user?.id && /^\d+$/.test(user.id) ? user.id : null;
  const queryClient = useQueryClient();
  const { data: contacts, isLoading, isError, refetch } = useGetAgentContacts(
    { type: kind },
    {
      query: {
        enabled: !authLoading && remoteAgentId !== null,
        queryKey: [...getGetAgentContactsQueryKey({ type: kind }), remoteAgentId ?? 'unauthenticated'],
      },
    },
  );
  const createContact = useCreateAgentContact();
  const requestReview = useCreateAgentContactReviewInvitation();
  const updateAgentContact = useUpdateAgentContact();
  const updateProperty = useUpdateProperty();
  const [busyPropertyId, setBusyPropertyId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [createError, setCreateError] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [emailRequestPropertyId, setEmailRequestPropertyId] = useState<number | null>(null);
  const [emailRequestAddress, setEmailRequestAddress] = useState('');
  const [emailRequestError, setEmailRequestError] = useState('');

  const saveStandaloneContact = async () => {
    const name = contactName.trim();
    const phone = contactPhone.trim();
    const email = contactEmail.trim();
    if (!name || !phone) {
      setCreateError('Enter a name and phone number.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 7) {
      setCreateError('Enter a complete phone number.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCreateError('Enter a valid email address.');
      return;
    }
    setSavingContact(true);
    setCreateError('');
    try {
      await createContact.mutateAsync({ data: { type: kind, name, phone, email: email || undefined } });
      await queryClient.invalidateQueries({ queryKey: getGetAgentContactsQueryKey({ type: kind }) });
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setCreateOpen(false);
      Alert.alert('Contact added', `${name} is now listed under ${title.toLowerCase()}.`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'The contact could not be saved.');
    } finally {
      setSavingContact(false);
    }
  };

  const saveContactDetails = async (contact: AgentContact, name: string, phone: string, email: string) => {
    const property = contact.properties[0];
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const phoneDigits = trimmedPhone.replace(/\D/g, '').length;
    if (!trimmedName) {
      throw new Error('Enter a contact name.');
    }
    if ((contact.standalone && phoneDigits < 7) || (phoneDigits > 0 && phoneDigits < 7)) {
      throw new Error('Enter a complete phone number or leave it blank.');
    }
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      throw new Error('Enter a valid email address or leave it blank.');
    }
    if (contact.standalone) {
      await updateAgentContact.mutateAsync({
        contactId: Math.abs(contact.id),
        data: { name: trimmedName, phone: trimmedPhone, email: trimmedEmail || null },
      });
    } else if (property) {
      await updateProperty.mutateAsync({
        id: property.id,
        data: {
          sellerName: trimmedName,
          sellerPhone: trimmedPhone,
          sellerEmail: trimmedEmail,
        },
      });
    } else {
      throw new Error('This contact is not linked to a property.');
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetAgentContactsQueryKey({ type: 'seller' }) }),
      queryClient.invalidateQueries({ queryKey: getGetAgentContactsQueryKey({ type: 'landlord' }) }),
      ...(property ? [
        queryClient.invalidateQueries({ queryKey: getGetPropertyQueryKey(property.id) }),
        queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() }),
      ] : []),
    ]);
  };

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

  const openReviewRequest = async (
    propertyId: number,
    channel: 'whatsapp' | 'email',
    recipientEmail?: string | null,
  ) => {
    if (channel === 'email' && !recipientEmail?.trim()) {
      setEmailRequestAddress('');
      setEmailRequestError('');
      setEmailRequestPropertyId(propertyId);
      return;
    }
    try {
      setBusyPropertyId(propertyId);
      const invitation = await requestReview.mutateAsync({ propertyId });
      const text = `Hi ${invitation.recipientName}, I’d appreciate it if you could leave a review about working with me on ${invitation.propertyTitle} (${invitation.propertyReference}) through QuickProp: ${invitation.url}`;
      if (channel === 'email') {
        const subject = `QuickProp review request — ${invitation.propertyReference}`;
        const body = `${text}\n\n${invitation.propertyTitle}`;
        await Linking.openURL(`mailto:${encodeURIComponent(recipientEmail!)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
      } else {
        const phone = invitation.phone?.replace(/\D/g, '').replace(/^00/, '');
        if (phone) {
          try {
            await Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
          } catch {
            await Share.share({ message: text, url: invitation.url });
          }
        } else {
          await Share.share({ message: text, url: invitation.url });
        }
      }
    } catch (error) {
      Alert.alert('Could not create review link', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusyPropertyId(null);
    }
  };

  const submitEmailReview = () => {
    const propertyId = emailRequestPropertyId;
    const email = emailRequestAddress.trim();
    if (!propertyId) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailRequestError('Enter a valid email address.');
      return;
    }
    setEmailRequestPropertyId(null);
    void openReviewRequest(propertyId, 'email', email);
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
    <>
    <KeyboardAwareScrollViewCompat
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="arrow-back" size={21} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.heading}>
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => { setCreateError(''); setCreateOpen(true); }}
            style={[styles.headerAction, { backgroundColor: colors.primary }]}
            accessibilityLabel={`Add ${kind}`}
          >
            <Ionicons name="add" size={21} color={colors.primaryForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => refetch()} style={styles.headerAction} accessibilityLabel={`Refresh ${title.toLowerCase()}`}>
            <Ionicons name="refresh-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
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
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>Add a standalone contact here or enter contact details on a {kind === 'seller' ? 'sale' : 'rental'} listing.</Text>
          <View style={[styles.reviewSection, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <View style={styles.reviewSectionHeader}>
              <View style={[styles.reviewSectionIcon, { backgroundColor: colors.card }]}>
                <Ionicons name="star-outline" size={17} color={colors.primary} />
              </View>
              <Text style={[styles.reviewSectionTitle, { color: colors.foreground }]}>Request a review</Text>
            </View>
            <Text style={[styles.reviewSectionDescription, { color: colors.mutedForeground }]}>
              Review requests are available when a {kind} is linked to a {kind === 'seller' ? 'sale' : 'rental'} listing. Once submitted, the review will appear on the QuickProp online marketplace to help build your online presence and trust.
            </Text>
          </View>
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
            onSaveContactDetails={saveContactDetails}
          />
        ))
      )}
      <Text style={[styles.privacy, { color: colors.mutedForeground }]}>Standalone contacts are visible only to your account.</Text>
    </KeyboardAwareScrollViewCompat>
    <Modal
      visible={createOpen}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => setCreateOpen(false)}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
        <KeyboardAwareScrollViewCompat
          style={styles.modalScroll}
          contentContainerStyle={[styles.modalScrollContent, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]}
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.flex}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>New {kind} contact</Text>
                <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>Standalone contact · no listing required</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateOpen(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>NAME</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
              value={contactName}
              onChangeText={setContactName}
              placeholder={kind === 'seller' ? 'Seller name' : 'Landlord name'}
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
              returnKeyType="next"
              accessibilityLabel={`${title} contact name`}
            />
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>PHONE NUMBER</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
              value={contactPhone}
              onChangeText={setContactPhone}
              placeholder="Phone number"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              returnKeyType="done"
              accessibilityLabel={`${title} contact phone number`}
            />
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>EMAIL (OPTIONAL)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
              value={contactEmail}
              onChangeText={setContactEmail}
              placeholder="name@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={`${title} contact email address`}
            />
            {!!createError && <Text style={[styles.errorText, { color: colors.destructive }]}>{createError}</Text>}
            <TouchableOpacity
              onPress={() => void saveStandaloneContact()}
              disabled={savingContact}
              style={[styles.saveButton, { backgroundColor: colors.primary, opacity: savingContact ? 0.6 : 1 }]}
            >
              {savingContact ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.saveButtonText, { color: colors.primaryForeground }]}>Save contact</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
    <Modal
      visible={emailRequestPropertyId !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setEmailRequestPropertyId(null)}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
        <KeyboardAwareScrollViewCompat
          style={styles.modalScroll}
          contentContainerStyle={[styles.modalScrollContent, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]}
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.flex}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Email review request</Text>
                <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>Enter the seller or landlord’s email address.</Text>
              </View>
              <TouchableOpacity onPress={() => setEmailRequestPropertyId(null)} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
              value={emailRequestAddress}
              onChangeText={(value) => {
                setEmailRequestAddress(value);
                setEmailRequestError('');
              }}
              placeholder="name@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="done"
              accessibilityLabel="Review request recipient email"
            />
            {!!emailRequestError && <Text style={[styles.errorText, { color: colors.destructive }]}>{emailRequestError}</Text>}
            <TouchableOpacity
              onPress={submitEmailReview}
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.saveButtonText, { color: colors.primaryForeground }]}>Continue to email</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
    </>
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
  onSaveContactDetails,
}: {
  contact: AgentContact;
  kind: ContactKind;
  colors: ReturnType<typeof useColors>;
  busyPropertyId: number | null;
  onCaptureMandate: (propertyId: number) => void;
  onRequestReview: (propertyId: number, channel: 'whatsapp' | 'email', recipientEmail?: string | null) => void;
  onOpenMandate: (objectPath?: string | null) => void;
  onSaveContactDetails: (contact: AgentContact, name: string, phone: string, email: string) => Promise<void>;
}) {
  const [editingDetails, setEditingDetails] = useState(false);
  const [nameDraft, setNameDraft] = useState(contact.name);
  const [phoneDraft, setPhoneDraft] = useState(contact.phone ?? '');
  const [emailDraft, setEmailDraft] = useState(contact.email ?? '');
  const [savingDetails, setSavingDetails] = useState(false);
  const canEditContact = contact.standalone || contact.properties.length > 0;

  const saveDetails = async () => {
    setSavingDetails(true);
    try {
      await onSaveContactDetails(contact, nameDraft, phoneDraft, emailDraft);
      setEditingDetails(false);
      Alert.alert('Contact updated', 'The name, phone number, and email have been saved.');
    } catch (error) {
      Alert.alert('Could not save contact', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSavingDetails(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.nameRow}>
        <View style={[styles.avatar, { backgroundColor: colors.secondary }]}><Text style={[styles.avatarText, { color: colors.primary }]}>{contact.name.charAt(0).toUpperCase()}</Text></View>
        <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {contact.name}
            </Text>
        </View>
          {canEditContact ? (
            <TouchableOpacity
              style={[styles.contactEditButton, { backgroundColor: colors.secondary }]}
              onPress={() => {
                setNameDraft(contact.name);
                setPhoneDraft(contact.phone ?? '');
                setEmailDraft(contact.email ?? '');
                setEditingDetails(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${contact.name}, phone number, and email`}
              testID={`${kind}-edit-contact-${contact.id}`}
            >
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text style={[styles.contactEditText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
          ) : null}
      </View>
        <View style={styles.contactDetailsRow}>
          <TouchableOpacity
            style={styles.contactMetaItem}
            onPress={() => contact.phone && void Linking.openURL(`tel:${contact.phone}`)}
            disabled={!contact.phone}
            accessibilityRole={contact.phone ? 'button' : undefined}
            accessibilityLabel={contact.phone ? `Call ${contact.name}` : undefined}
          >
            <Ionicons name="call-outline" size={15} color={colors.primary} />
            <Text style={[styles.detail, { color: contact.phone ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>
              {contact.phone || 'Phone not provided'}
            </Text>
          </TouchableOpacity>
          <View style={styles.contactMetaItem}>
            <Ionicons name="mail-outline" size={15} color={colors.primary} />
            <Text style={[styles.detail, { color: contact.email ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>
              {contact.email || 'Email not provided'}
            </Text>
          </View>
        </View>
        {contact.idNumber ? <Text style={[styles.detail, { color: colors.mutedForeground }]}>ID: {contact.idNumber}</Text> : null}
        {contact.standalone ? <Text style={[styles.standalone, { color: colors.mutedForeground }]}>Standalone contact</Text> : null}
      {!!contact.postalAddress && <View style={styles.contactLine}><Ionicons name="location-outline" size={16} color={colors.primary} /><Text style={[styles.detail, { color: colors.foreground }]}>{contact.postalAddress}</Text></View>}
        {editingDetails && canEditContact ? (
          <View style={styles.contactEditor}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Full name"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={120}
              returnKeyType="next"
              accessibilityLabel="Seller or landlord full name"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
              value={phoneDraft}
              onChangeText={setPhoneDraft}
              placeholder="Phone number"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="default"
              selectTextOnFocus
              accessibilityLabel="Seller or landlord phone number"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
              value={emailDraft}
              onChangeText={setEmailDraft}
              placeholder="Email address"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Seller or landlord email address"
            />
            <View style={styles.reviewActions}>
              <TouchableOpacity
                disabled={savingDetails}
                onPress={() => void saveDetails()}
                style={[styles.actionButton, styles.reviewAction, { backgroundColor: colors.primary, opacity: savingDetails ? 0.6 : 1 }]}
              >
                {savingDetails ? <ActivityIndicator size="small" color="#FFF" /> : null}
                <Text style={[styles.actionText, { color: '#FFF' }]}>Save details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={savingDetails}
                onPress={() => setEditingDetails(false)}
                style={[styles.actionButton, styles.reviewAction, { backgroundColor: colors.secondary }]}
              >
                <Text style={[styles.actionText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      {!!contact.notes && <Text style={[styles.notes, { color: colors.mutedForeground }]}>{contact.notes}</Text>}

      {contact.properties.length > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
      {contact.properties.map((property) => {
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
            <View style={[styles.reviewSection, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <View style={styles.reviewSectionHeader}>
                <View style={[styles.reviewSectionIcon, { backgroundColor: colors.card }]}>
                  <Ionicons name="star-outline" size={17} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.reviewSectionTitle, { color: colors.foreground }]}>Request a review to boost your online profile on Quickprop.co.zw</Text>
                </View>
              </View>
              <View style={styles.reviewActions}>
                <TouchableOpacity
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Request a review from this ${kind} by WhatsApp`}
                  testID={`${kind}-request-review-whatsapp-${property.id}`}
                  style={[styles.actionButton, styles.reviewAction, { backgroundColor: colors.primary, opacity: busy ? 0.55 : 1 }]}
                  onPress={() => onRequestReview(property.id, 'whatsapp', contact.phone)}
                >
                  {busy ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="logo-whatsapp" size={17} color="#FFF" />}
                  <Text style={[styles.actionText, { color: '#FFF' }]}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Request a review from this ${kind} by email`}
                  testID={`${kind}-request-review-email-${property.id}`}
                  style={[styles.actionButton, styles.reviewAction, { backgroundColor: colors.card, opacity: busy ? 0.45 : 1 }]}
                  onPress={() => onRequestReview(property.id, 'email', contact.email)}
                >
                  {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="mail-outline" size={17} color={colors.primary} />}
                  <Text style={[styles.actionText, { color: colors.primary }]}>Email</Text>
                </TouchableOpacity>
              </View>
            </View>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerAction: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
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
  contactEditButton: { minHeight: 36, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10 },
  contactEditText: { fontSize: 12, fontWeight: '700' },
  contactDetailsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactMetaItem: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  contactLine: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  notes: { fontSize: 13, lineHeight: 18 },
  standalone: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  divider: { height: 1, marginTop: 3 },
  property: { borderBottomWidth: 1, paddingVertical: 10, gap: 9 },
  propertyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  propertyTitle: { fontWeight: '700', fontSize: 14, marginBottom: 2 },
  status: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4 },
  reviewSection: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 9, marginTop: 3 },
  reviewSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  reviewSectionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  reviewSectionTitle: { fontSize: 14, fontWeight: '800' },
  reviewSectionDescription: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  actionButton: { minHeight: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  reviewActions: { flexDirection: 'row', gap: 8 },
  reviewAction: { flex: 1 },
  actionText: { fontSize: 13, fontWeight: '700' },
  reviewHint: { fontSize: 11, textAlign: 'center' },
  privacy: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 2 },
  modalBackdrop: { flex: 1, justifyContent: 'center' },
  modalScroll: { flex: 1 },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { borderWidth: 1, borderRadius: 22, padding: 20, gap: 10 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 8 },
  modalTitle: { fontSize: 22, fontWeight: '800' },
  modalSubtitle: { fontSize: 13, marginTop: 4 },
  inputLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginTop: 4 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, fontSize: 15 },
  contactEditor: { gap: 8, borderWidth: 1, borderColor: '#DCE3E8', borderRadius: 14, padding: 10 },
  errorText: { fontSize: 13, lineHeight: 18 },
  saveButton: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  saveButtonText: { fontSize: 15, fontWeight: '700' },
});
