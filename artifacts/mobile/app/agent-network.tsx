import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getListAgentNetworkMatchesQueryKey,
  getListAgentNetworkSubmissionsQueryKey,
  requestStorageUploadUrl,
  useCancelAgentNetworkSubmission,
  useConfirmAgentNetworkSubmission,
  useCreateAgentNetworkSubmission,
  useListAgentNetworkMatches,
  useListAgentNetworkSubmissions,
  useRespondToAgentNetworkMatch,
  useUpdateAgentNetworkListingSharing,
} from '@workspace/api-client-react';
import type {
  AgentNetworkMatch,
  AgentNetworkSubmission,
  ConfirmAgentNetworkSubmissionInput,
  CreateAgentNetworkSubmissionInput,
  StorageUploadRequestInput,
} from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';

type AnyRecord = Record<string, unknown>;
type ExtractionItem = AnyRecord & {
  intent?: string;
  recordType?: string;
  recordId?: number;
  reviewStatus?: string;
  confidence?: number;
  clarificationQuestion?: string;
  property?: AnyRecord;
  buyerRequirement?: AnyRecord;
  networkEnabled?: boolean;
};
type ScreenSection = 'message' | 'matches';
type PickedFile = DocumentPicker.DocumentPickerAsset;

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set([
  'aac', 'csv', 'docx', 'jpeg', 'jpg', 'm4a', 'mp3', 'ogg',
  'pdf', 'png', 'txt', 'wav', 'webm', 'xls', 'xlsx',
]);
const AUDIO_EXTENSIONS = new Set(['aac', 'm4a', 'mp3', 'ogg', 'wav', 'webm']);
const REVIEW_TEMPLATES: Record<'property' | 'buyer_requirement', AnyRecord> = {
  property: {
    title: '', description: '', propertyType: '', listingType: 'sale', price: '',
    currency: 'USD', suburb: '', city: '', bedrooms: undefined, bathrooms: undefined,
    parking: undefined, landSize: undefined, buildingSize: undefined, features: [], photos: [],
  },
  buyer_requirement: {
    buyerName: '', phone: '', email: '', propertyType: '', listingType: 'sale',
    budgetMin: undefined, budgetMax: undefined, currency: 'USD', areas: [],
    bedroomsMin: undefined, bedroomsMax: undefined, requiredFeatures: [],
    preferredFeatures: [], otherPreferences: [], financing: '', urgency: '',
  },
};
const NUMERIC_FIELDS = new Set([
  'price', 'bedrooms', 'bathrooms', 'parking', 'landSize', 'buildingSize',
  'budgetMin', 'budgetMax', 'bedroomsMin', 'bedroomsMax',
]);
const ARRAY_FIELDS = new Set([
  'features', 'photos', 'areas', 'requiredFeatures', 'preferredFeatures', 'otherPreferences',
]);

const asRecord = (value: unknown): AnyRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};

const itemsFor = (submission: AgentNetworkSubmission): ExtractionItem[] => {
  const extraction = asRecord(submission.extraction);
  return Array.isArray(extraction.items)
    ? extraction.items.map((item) => asRecord(item) as ExtractionItem)
    : [];
};

const humanize = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
const money = (value: unknown, currency?: unknown) =>
  value == null || value === '' ? 'Price not stated' : `${String(currency || 'USD')} ${Number(value).toLocaleString()}`;

function extension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function contentTypeFor(file: PickedFile) {
  if (file.mimeType) return file.mimeType;
  const ext = extension(file.name);
  const mimeTypes: Record<string, string> = {
    aac: 'audio/aac', csv: 'text/csv',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    jpeg: 'image/jpeg', jpg: 'image/jpeg', m4a: 'audio/mp4', mp3: 'audio/mpeg',
    ogg: 'audio/ogg', pdf: 'application/pdf', png: 'image/png', txt: 'text/plain',
    wav: 'audio/wav', webm: 'audio/webm', xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeTypes[ext] ?? 'application/octet-stream';
}

function renderFieldValue(value: unknown) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function editedFieldValue(key: string, value: string): unknown {
  if (NUMERIC_FIELDS.has(key)) {
    if (!value.trim()) return undefined;
    const number = Number(value.replace(/[,\s]/g, ''));
    return Number.isFinite(number) ? number : value;
  }
  if (ARRAY_FIELDS.has(key)) {
    if (key === 'photos') {
      return value.split(',').map((part) => Number(part.trim())).filter(Number.isInteger);
    }
    return value.split(',').map((part) => part.trim()).filter(Boolean);
  }
  return value.trim() || undefined;
}

function fileBytes(asset: PickedFile): number {
  if (typeof asset.size === 'number') return asset.size;
  try { return new File(asset.uri).size; } catch { return 0; }
}

async function uploadPickedFile(asset: PickedFile) {
  const file = new File(asset.uri);
  const size = fileBytes(asset);
  if (size < 1) throw new Error(`Could not read ${asset.name}.`);
  const contentType = contentTypeFor(asset);
  const target = await requestStorageUploadUrl({
    name: asset.name,
    size,
    contentType,
  } satisfies StorageUploadRequestInput);
  const upload = await expoFetch(target.uploadURL, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!upload.ok) throw new Error(`${asset.name} could not be uploaded.`);
  return {
    fileName: asset.name,
    contentType,
    sizeBytes: size,
    storagePath: target.objectPath,
  };
}

function StatusPill({ label, color, background }: { label: string; color: string; background: string }) {
  return <View style={[styles.statusPill, { backgroundColor: background }]}><Text style={[styles.statusText, { color }]}>{label}</Text></View>;
}

function SectionToggle({
  section, onChange, colors,
}: {
  section: ScreenSection;
  onChange: (value: ScreenSection) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return <View style={[styles.sectionToggle, { backgroundColor: colors.muted }]}>
    {([
      ['message', 'New message', 'chatbox-ellipses-outline'],
      ['matches', 'Matches', 'git-compare-outline'],
    ] as const).map(([value, label, icon]) => (
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: section === value }}
        key={value}
        onPress={() => onChange(value)}
        style={[
          styles.sectionOption,
          section === value && { backgroundColor: colors.card, shadowColor: colors.foreground },
        ]}
        testID={`agent-network-tab-${value}`}
      >
        <Ionicons name={icon} size={16} color={section === value ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.sectionOptionText, { color: section === value ? colors.foreground : colors.mutedForeground }]}>{label}</Text>
      </Pressable>
    ))}
  </View>;
}

function ComposeCard({
  message, onMessageChange, files, onPickFiles, onRemoveFile, onSubmit, busy, error, colors,
}: {
  message: string;
  onMessageChange: (value: string) => void;
  files: PickedFile[];
  onPickFiles: () => void;
  onRemoveFile: (index: number) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string;
  colors: ReturnType<typeof useColors>;
}) {
  const totalBytes = files.reduce((sum, file) => sum + fileBytes(file), 0);
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={styles.cardHeader}>
      <View style={[styles.iconTile, { backgroundColor: colors.primary + '14' }]}>
        <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Send a listing or buyer request</Text>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>QuickProp extracts a private review draft. Nothing is saved until you confirm.</Text>
      </View>
    </View>
    <TextInput
      accessibilityLabel="Message text"
      data-testid="input-network-message"
      multiline
      maxLength={12000}
      onChangeText={onMessageChange}
      placeholder="Type or paste a listing or buyer requirement…"
      placeholderTextColor={colors.mutedForeground}
      style={[styles.messageInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
      textAlignVertical="top"
      value={message}
    />
    <Text style={[styles.helper, styles.characterCount, { color: colors.mutedForeground }]}>{message.length.toLocaleString()} / 12,000</Text>
    <View style={styles.fileRow}>
      <TouchableOpacity
        accessibilityRole="button"
        data-testid="button-pick-network-files"
        onPress={onPickFiles}
        style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.background }]}
      >
        <Ionicons name="attach-outline" size={19} color={colors.primary} />
        <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Attach files</Text>
      </TouchableOpacity>
      <Text style={[styles.helper, styles.fileLimit, { color: colors.mutedForeground }]}>{files.length}/{MAX_FILES} · {(totalBytes / 1024 / 1024).toFixed(1)} MB</Text>
    </View>
    <Text style={[styles.helper, { color: colors.mutedForeground }]}>Audio voice notes, spreadsheets, photos, text, Word and PDF · 25 MB total</Text>
    {files.map((file, index) => (
      <View key={`${file.name}-${file.size}-${index}`} style={[styles.attachment, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Ionicons name={AUDIO_EXTENSIONS.has(extension(file.name)) ? 'mic-outline' : 'document-outline'} size={17} color={colors.primary} />
        <Text numberOfLines={1} style={[styles.attachmentName, { color: colors.foreground }]}>{file.name}</Text>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>{(fileBytes(file) / 1024 / 1024).toFixed(1)} MB</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${file.name}`} onPress={() => onRemoveFile(index)} testID={`button-remove-attachment-${index}`}>
          <Ionicons name="close-circle-outline" size={21} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    ))}
    {error ? <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
    <TouchableOpacity
      accessibilityRole="button"
      data-testid="button-create-network-submission"
      disabled={busy || (!message.trim() && !files.length)}
      onPress={onSubmit}
      style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: busy || (!message.trim() && !files.length) ? 0.55 : 1 }]}
    >
      {busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Ionicons name="paper-plane-outline" size={18} color={colors.primaryForeground} />}
      <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{busy ? 'Preparing secure review…' : 'Send for AI review'}</Text>
    </TouchableOpacity>
    <Text style={[styles.finePrint, { color: colors.mutedForeground }]}>Development simulator only. No WhatsApp messages are sent or received.</Text>
  </View>;
}

function ReviewSubmission({
  submission, busy, onConfirm, onCancel, onShare, colors, drafts, shareSelections, onDraftFieldChange, onShareChange,
}: {
  submission: AgentNetworkSubmission;
  busy: boolean;
  onConfirm: (submission: AgentNetworkSubmission, itemIndex: number, recordType: 'property' | 'buyer_requirement', data: AnyRecord, share: boolean) => void;
  onCancel: (submission: AgentNetworkSubmission) => void;
  onShare: (recordId: number, enabled: boolean) => void;
  colors: ReturnType<typeof useColors>;
  drafts: Record<string, AnyRecord>;
  shareSelections: Record<string, boolean>;
  onDraftFieldChange: (key: string, field: string, value: unknown) => void;
  onShareChange: (key: string, value: boolean) => void;
}) {
  const [kindOverrides, setKindOverrides] = useState<Record<number, 'property' | 'buyer_requirement'>>({});
  const items = itemsFor(submission);
  const sourceError = typeof asRecord(submission.extraction).error === 'string'
    ? String(asRecord(submission.extraction).error)
    : '';
  const canCancel = submission.status === 'needs_review' || submission.status === 'failed';
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} testID={`submission-${submission.id}`}>
    <View style={styles.submissionHeader}>
      <View style={styles.flex}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Message #{submission.id}</Text>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>{new Date(submission.createdAt).toLocaleString()} · {submission.attachments?.length ?? 0} files</Text>
      </View>
      <StatusPill
        label={humanize(submission.status)}
        color={submission.status === 'failed' ? colors.destructive : submission.status === 'needs_review' ? colors.warning : colors.primary}
        background={submission.status === 'failed' ? colors.destructive + '18' : submission.status === 'needs_review' ? colors.warning + '20' : colors.primary + '14'}
      />
    </View>
    {submission.sourceText ? <Text style={[styles.sourceText, { backgroundColor: colors.muted, color: colors.foreground }]}>{submission.sourceText}</Text> : null}
    {submission.status === 'failed' ? <Text style={[styles.errorText, { color: colors.destructive }]}>{sourceError || 'Extraction failed. Your source is preserved; try again after checking the file and connection.'}</Text> : null}
    {items.length ? items.map((item, index) => {
      const extractedType = item.recordType === 'property' || item.recordType === 'buyer_requirement'
        ? item.recordType
        : item.intent === 'property' || item.intent === 'buyer_requirement' ? item.intent : null;
      const recordType = kindOverrides[index] ?? extractedType;
      const original = extractedType === 'property' ? asRecord(item.property) : extractedType === 'buyer_requirement' ? asRecord(item.buyerRequirement) : {};
      const key = `${submission.id}-${index}`;
      const data = recordType
        ? { ...REVIEW_TEMPLATES[recordType], ...original, ...drafts[key] }
        : {};
      const confirmed = item.reviewStatus === 'confirmed' || Boolean(item.recordId);
      const skipped = item.reviewStatus === 'skipped';
      const confidence = Number(item.confidence ?? 0);
      const confidenceLabel = `${Math.round(confidence <= 1 ? confidence * 100 : confidence)}% confidence`;
      return <ReviewItem
        key={`${submission.id}-${index}`}
        item={item}
        itemIndex={index}
        recordType={recordType}
        data={data}
        confirmed={confirmed}
        skipped={skipped}
        confidenceLabel={confidenceLabel}
        busy={busy}
        colors={colors}
        share={shareSelections[key] ?? false}
        onFieldChange={(field, value) => onDraftFieldChange(key, field, value)}
        onShareChange={(value) => onShareChange(key, value)}
        onClassify={(kind) => setKindOverrides((current) => ({ ...current, [index]: kind }))}
        onConfirm={(reviewed, share) => recordType && onConfirm(submission, index, recordType, reviewed, share)}
        onShare={() => item.recordId && onShare(item.recordId, item.networkEnabled !== true)}
      />;
    }) : submission.status === 'processing' || submission.status === 'queued'
      ? <View style={styles.processing}><ActivityIndicator color={colors.primary} /><Text style={[styles.helper, { color: colors.mutedForeground }]}>Reading your message…</Text></View>
      : submission.status !== 'failed'
        ? <Text style={[styles.helper, { color: colors.mutedForeground }]}>No extracted items to review.</Text>
        : null}
    {canCancel ? <TouchableOpacity disabled={busy} onPress={() => onCancel(submission)} style={styles.cancelButton} testID={`button-cancel-submission-${submission.id}`}>
      <Ionicons name="close-circle-outline" size={17} color={colors.destructive} /><Text style={[styles.cancelText, { color: colors.destructive }]}>Cancel unreviewed items</Text>
    </TouchableOpacity> : null}
  </View>;
}

function ReviewItem({
  item, itemIndex, recordType, data, confirmed, skipped, confidenceLabel, busy, colors,
  share, onFieldChange, onShareChange, onClassify, onConfirm, onShare,
}: {
  item: ExtractionItem;
  itemIndex: number;
  recordType: 'property' | 'buyer_requirement' | null;
  data: AnyRecord;
  confirmed: boolean;
  skipped: boolean;
  confidenceLabel: string;
  busy: boolean;
  colors: ReturnType<typeof useColors>;
  share: boolean;
  onFieldChange: (key: string, value: unknown) => void;
  onShareChange: (value: boolean) => void;
  onClassify: (type: 'property' | 'buyer_requirement') => void;
  onConfirm: (data: AnyRecord, share: boolean) => void;
  onShare: () => void;
}) {
  const [error, setError] = useState('');
  const canReview = !confirmed && !skipped && recordType !== null;
  const update = (key: string, text: string) => {
    const value = editedFieldValue(key, text);
    onFieldChange(key, value);
  };
  const validate = () => {
    const fields = recordType === 'property'
      ? ['title', 'propertyType', 'listingType', 'price', 'suburb', 'city']
      : ['propertyType', 'listingType', 'areas'];
    const missing = fields.filter((field) => data[field] == null || data[field] === '' || (Array.isArray(data[field]) && !(data[field] as unknown[]).length));
    if (missing.length) {
      setError(`Complete ${missing.map(humanize).join(', ')} before saving.`);
      return;
    }
    if (recordType === 'property' && Number(data.price) <= 0) {
      setError('Enter a price greater than zero.');
      return;
    }
    if (recordType === 'buyer_requirement' && data.budgetMin != null && data.budgetMax != null && Number(data.budgetMin) > Number(data.budgetMax)) {
      setError('The minimum budget cannot be greater than the maximum.');
      return;
    }
    setError('');
    onConfirm(data, share);
  };
  return <View style={[styles.reviewItem, { borderColor: colors.border, backgroundColor: colors.background }]} testID={`extraction-item-${itemIndex}`}>
    <View style={styles.submissionHeader}>
      <View style={styles.flex}>
        <Text style={[styles.itemTitle, { color: colors.foreground }]}>{recordType === 'property' ? 'Property listing' : recordType === 'buyer_requirement' ? 'Buyer requirement' : 'Needs clarification'}</Text>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>{confidenceLabel}</Text>
      </View>
      <StatusPill
        label={confirmed ? `Saved${item.recordId ? ` · #${item.recordId}` : ''}` : skipped ? 'Skipped' : 'Review'}
        color={confirmed ? colors.success : skipped ? colors.mutedForeground : colors.warning}
        background={confirmed ? colors.success + '18' : skipped ? colors.muted : colors.warning + '20'}
      />
    </View>
    {item.clarificationQuestion ? <Text style={[styles.clarification, { backgroundColor: colors.warning + '16', color: colors.foreground }]}>{item.clarificationQuestion}</Text> : null}
    {!recordType && !confirmed && !skipped ? <View style={styles.classifyButtons}>
      <Text style={[styles.helper, { color: colors.mutedForeground }]}>Choose what this message contains:</Text>
      <TouchableOpacity onPress={() => onClassify('property')} style={[styles.classifyButton, { borderColor: colors.border, backgroundColor: colors.card }]} testID={`button-classify-property-${itemIndex}`}>
        <Ionicons name="home-outline" size={17} color={colors.primary} /><Text style={[styles.confirmText, { color: colors.foreground }]}>Property</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onClassify('buyer_requirement')} style={[styles.classifyButton, { borderColor: colors.border, backgroundColor: colors.card }]} testID={`button-classify-requirement-${itemIndex}`}>
        <Ionicons name="person-outline" size={17} color={colors.primary} /><Text style={[styles.confirmText, { color: colors.foreground }]}>Buyer request</Text>
      </TouchableOpacity>
    </View> : null}
    {recordType && Object.keys(data).map((key) => {
      const text = renderFieldValue(data[key]);
      if (key === 'listingType') {
        return <View key={key} style={styles.fieldWrap}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{recordType === 'property' ? 'Listing type' : 'Buyer wants'}</Text>
          <View style={styles.listingTypeRow}>
            {(['sale', 'rent'] as const).map((value) => {
              const selected = data.listingType === value;
              return <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={value}
                onPress={() => onFieldChange('listingType', value)}
                style={[styles.listingTypeOption, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '12' : colors.card }]}
                testID={`button-listing-type-${itemIndex}-${value}`}
              >
                <Text style={[styles.listingTypeText, { color: selected ? colors.primary : colors.foreground }]}>{value === 'sale' ? 'For sale' : 'For rent'}</Text>
              </TouchableOpacity>;
            })}
          </View>
        </View>;
      }
      const multiline = key === 'description' || ARRAY_FIELDS.has(key) || text.length > 72;
      return <View key={key} style={styles.fieldWrap}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{humanize(key)}</Text>
        <TextInput
          accessibilityLabel={humanize(key)}
          editable={canReview}
          keyboardType={NUMERIC_FIELDS.has(key) ? 'decimal-pad' : 'default'}
          multiline={multiline}
          onChangeText={(value) => update(key, value)}
          placeholder={`Enter ${humanize(key).toLowerCase()}`}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.fieldInput,
            multiline && styles.multilineField,
            { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
          ]}
          textAlignVertical={multiline ? 'top' : 'center'}
          value={text}
        />
      </View>;
    })}
    {canReview && recordType === 'property' ? <View style={[styles.shareRow, { borderColor: colors.border, backgroundColor: colors.primary + '0A' }]}>
      <View style={styles.flex}>
        <Text style={[styles.itemTitle, { color: colors.foreground }]}>Share privately for matches</Text>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>Only opted-in listings are matched. This does not publish the listing.</Text>
      </View>
      <Switch
        accessibilityLabel="Share listing privately for matches"
        onValueChange={onShareChange}
        testID={`switch-network-sharing-${itemIndex}`}
        trackColor={{ false: colors.border, true: colors.primary + '90' }}
        thumbColor={share ? colors.primary : colors.card}
        value={share}
      />
    </View> : null}
    {error ? <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
    {canReview ? <TouchableOpacity disabled={busy} onPress={validate} style={[styles.confirmButton, { backgroundColor: colors.primary, opacity: busy ? 0.55 : 1 }]} testID={`button-confirm-item-${itemIndex}`}>
      {busy ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Ionicons name="checkmark-circle-outline" size={18} color={colors.primaryForeground} />}
      <Text style={[styles.confirmText, { color: colors.primaryForeground }]}>Confirm and save</Text>
    </TouchableOpacity> : confirmed && recordType === 'property' && item.recordId ? <TouchableOpacity onPress={onShare} style={styles.networkToggle} testID={`button-share-listing-${item.recordId}`}>
      <Ionicons name={item.networkEnabled ? 'eye-off-outline' : 'eye-outline'} size={17} color={colors.primary} />
      <Text style={[styles.networkToggleText, { color: colors.primary }]}>{item.networkEnabled ? 'Remove from private network' : 'Opt into private network'}</Text>
    </TouchableOpacity> : null}
  </View>;
}

function MatchRow({
  match, busy, onRespond, colors,
}: {
  match: AgentNetworkMatch;
  busy: boolean;
  onRespond: (match: AgentNetworkMatch, interested: boolean) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const released = match.contactReleased === true;
  const listing = match.listing;
  const req = match.requirementSummary;
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} testID={`network-match-${match.id}`}>
    <View style={styles.matchHeader}>
      <StatusPill label={`${match.category} · ${match.matchPercent}%`} color={colors.primary} background={colors.primary + '14'} />
      <Text style={[styles.helper, { color: colors.mutedForeground }]}>{humanize(match.status)}</Text>
    </View>
    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{listing?.title || 'Private listing'}</Text>
    <Text style={[styles.helper, { color: colors.mutedForeground }]}>
      {[listing?.suburb, listing?.city, listing?.propertyType, listing?.bedrooms != null ? `${listing.bedrooms} beds` : null].filter(Boolean).join(' · ')}
    </Text>
    <Text style={[styles.matchPrice, { color: colors.primary }]}>{money(listing?.price, listing?.currency)}</Text>
    <View style={[styles.requirementBox, { backgroundColor: colors.muted }]}>
      <Text style={[styles.itemTitle, { color: colors.foreground }]}>Buyer request</Text>
      <Text style={[styles.helper, { color: colors.mutedForeground }]}>
        {[req?.propertyType, req?.listingType, ...(req?.areas ?? [])].filter(Boolean).join(' · ') || 'Requirement details not supplied'}
      </Text>
      <Text style={[styles.helper, { color: colors.mutedForeground }]}>
        {money(req?.budgetMin, req?.currency)} – {money(req?.budgetMax, req?.currency)}
      </Text>
    </View>
    <View style={styles.whyBox}>
      <Ionicons name="checkmark-circle-outline" size={17} color={colors.success} />
      <Text style={[styles.helper, styles.flex, { color: colors.foreground }]}>{(match.reasons || []).slice(0, 3).join(' · ') || 'Matched on the submitted preferences.'}</Text>
    </View>
    <View style={[styles.privacyBox, { backgroundColor: released ? colors.success + '16' : colors.primary + '0D', borderColor: colors.border }]}>
      <Ionicons name={released ? 'lock-open-outline' : 'lock-closed-outline'} size={17} color={released ? colors.success : colors.primary} />
      <View style={styles.flex}>
        <Text style={[styles.itemTitle, { color: colors.foreground }]}>{released ? 'Both agents agreed' : 'Contacts are private'}</Text>
        {released ? <>
          {match.otherAgent ? <Text style={[styles.helper, { color: colors.foreground }]}>{match.otherAgent.name || match.otherAgent.agencyName || 'Agent'}{match.otherAgent.agencyName ? ` · ${match.otherAgent.agencyName}` : ''}{match.otherAgent.phone ? ` · ${match.otherAgent.phone}` : ''}{match.otherAgent.email ? ` · ${match.otherAgent.email}` : ''}</Text> : null}
          {match.buyerContact ? <Text style={[styles.helper, { color: colors.foreground }]}>{match.buyerContact.name || 'Buyer'}{match.buyerContact.phone ? ` · ${match.buyerContact.phone}` : ''}{match.buyerContact.email ? ` · ${match.buyerContact.email}` : ''}</Text> : null}
        </> : <Text style={[styles.helper, { color: colors.mutedForeground }]}>The other agent and buyer details appear only after both agents express interest.</Text>}
      </View>
    </View>
    {!released && match.status === 'open' ? <View style={styles.matchActions}>
      <TouchableOpacity disabled={busy} onPress={() => onRespond(match, true)} style={[styles.confirmButton, styles.flex, { backgroundColor: colors.primary, opacity: busy ? 0.55 : 1 }]} testID={`button-interest-${match.id}`}>
        <Ionicons name="thumbs-up-outline" size={17} color={colors.primaryForeground} /><Text style={[styles.confirmText, { color: colors.primaryForeground }]}>Interested</Text>
      </TouchableOpacity>
      <TouchableOpacity disabled={busy} onPress={() => onRespond(match, false)} style={[styles.declineButton, { borderColor: colors.border, opacity: busy ? 0.55 : 1 }]} testID={`button-decline-${match.id}`}>
        <Text style={[styles.declineText, { color: colors.foreground }]}>Decline</Text>
      </TouchableOpacity>
    </View> : null}
  </View>;
}

export default function AgentNetworkScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<ScreenSection>('message');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [composeError, setComposeError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, AnyRecord>>({});
  const [shareSelections, setShareSelections] = useState<Record<string, boolean>>({});
  const submissionsKey = useMemo(() => getListAgentNetworkSubmissionsQueryKey(), []);
  const matchesKey = useMemo(() => getListAgentNetworkMatchesQueryKey(), []);
  const submissionsQuery = useListAgentNetworkSubmissions();
  const matchesQuery = useListAgentNetworkMatches();
  const createSubmission = useCreateAgentNetworkSubmission();
  const confirmSubmission = useConfirmAgentNetworkSubmission();
  const cancelSubmission = useCancelAgentNetworkSubmission();
  const respondToMatch = useRespondToAgentNetworkMatch();
  const updateListingSharing = useUpdateAgentNetworkListingSharing();
  const submissions = submissionsQuery.data as AgentNetworkSubmission[] | undefined;
  const matches = matchesQuery.data as AgentNetworkMatch[] | undefined;
  const pendingItems = useMemo(
    () => submissions?.reduce((count, submission) => count + itemsFor(submission).filter((item) => item.reviewStatus === 'needs_review').length, 0) ?? 0,
    [submissions],
  );

  useFocusEffect(useCallback(() => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: submissionsKey }),
      queryClient.invalidateQueries({ queryKey: matchesKey }),
    ]);
  }, [queryClient, submissionsKey, matchesKey]));

  const pickFiles = async () => {
    setComposeError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return;
      const next = result.assets;
      const invalid = next.find((asset) => !SUPPORTED_EXTENSIONS.has(extension(asset.name)));
      if (invalid) { setComposeError(`${invalid.name} is not a supported file type.`); return; }
      const merged = [...files, ...next.filter((asset) => !files.some((file) => file.name === asset.name && file.size === asset.size))];
      if (merged.length > MAX_FILES) { setComposeError(`Choose up to ${MAX_FILES} files per message.`); return; }
      const total = merged.reduce((sum, file) => sum + fileBytes(file), 0);
      if (total > MAX_TOTAL_BYTES) { setComposeError('The combined file size must be 25 MB or less.'); return; }
      const oversizedAudio = merged.find((file) => AUDIO_EXTENSIONS.has(extension(file.name)) && fileBytes(file) > MAX_AUDIO_BYTES);
      if (oversizedAudio) { setComposeError(`${oversizedAudio.name} exceeds the 8 MB voice-note limit.`); return; }
      setFiles(merged);
    } catch (error) {
      setComposeError(error instanceof Error ? error.message : 'Could not open your files.');
    }
  };

  const submit = async () => {
    if (!message.trim() && !files.length) {
      setComposeError('Type a message or attach a file first.');
      return;
    }
    setBusy(true);
    setComposeError('');
    try {
      const attachments = [];
      for (const file of files) attachments.push(await uploadPickedFile(file));
      const payload: CreateAgentNetworkSubmissionInput = {
        message: message.trim() || undefined,
        attachments,
      };
      await createSubmission.mutateAsync({ data: payload });
      setMessage('');
      setFiles([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: submissionsKey }),
        queryClient.invalidateQueries({ queryKey: matchesKey }),
      ]);
      Alert.alert('Review draft ready', 'Check the extracted details below and confirm them before saving.');
    } catch (error) {
      setComposeError(error instanceof Error ? error.message : 'Could not send this message. Your text and files remain selected.');
    } finally {
      setBusy(false);
    }
  };

  const confirmItem = async (
    submission: AgentNetworkSubmission,
    itemIndex: number,
    recordType: 'property' | 'buyer_requirement',
    data: AnyRecord,
    share: boolean,
  ) => {
    setBusy(true);
    try {
      const input: ConfirmAgentNetworkSubmissionInput = {
        itemIndex,
        recordType,
        data,
        shareWithNetwork: recordType === 'property' ? share : false,
      };
      await confirmSubmission.mutateAsync({ id: submission.id, data: input });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: submissionsKey }),
        queryClient.invalidateQueries({ queryKey: matchesKey }),
      ]);
      const key = `${submission.id}-${itemIndex}`;
      setReviewDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
      setShareSelections((current) => { const next = { ...current }; delete next[key]; return next; });
      Alert.alert('Saved', share ? 'The listing is saved as a draft and shared privately for matching.' : 'The reviewed details have been saved.');
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Your review is still available. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const cancelDraft = (submission: AgentNetworkSubmission) => Alert.alert(
    'Cancel unreviewed items?',
    'Any items you already confirmed will remain saved. Other extracted items will be skipped.',
    [
      { text: 'Keep reviewing', style: 'cancel' },
      { text: 'Cancel items', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          await cancelSubmission.mutateAsync({ id: submission.id });
          await queryClient.invalidateQueries({ queryKey: submissionsKey });
        } catch (error) {
          Alert.alert('Could not cancel', error instanceof Error ? error.message : 'Please try again.');
        } finally {
          setBusy(false);
        }
      } },
    ],
  );

  const updateSharing = async (recordId: number, enabled: boolean) => {
    try {
      await updateListingSharing.mutateAsync({ id: recordId, data: { enabled } });
      await queryClient.invalidateQueries({ queryKey: submissionsKey });
      await queryClient.invalidateQueries({ queryKey: matchesKey });
    } catch (error) {
      Alert.alert('Could not update sharing', error instanceof Error ? error.message : 'Check your connection and try again.');
    }
  };

  const respond = async (match: AgentNetworkMatch, interested: boolean) => {
    try {
      const updated = await respondToMatch.mutateAsync({ id: match.id, data: { interested } });
      await queryClient.invalidateQueries({ queryKey: matchesKey });
      Alert.alert(
        updated.contactReleased ? 'Both agents agreed' : interested ? 'Interest recorded' : 'Match declined',
        updated.contactReleased
          ? 'The approved contact details are now available.'
          : interested
            ? 'The other agent must also agree before contact details are shown.'
            : 'No contact details were shared.',
      );
    } catch (error) {
      Alert.alert('Could not update match', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const topPadding = insets.top + (Platform.OS === 'web' ? 67 : 8);
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <View style={[styles.header, { paddingTop: topPadding, borderBottomColor: colors.border }]}>
      <View style={styles.headerTop}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton} testID="button-agent-network-back">
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.flex}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Agent Network</Text>
          <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>Private listings and buyer matches</Text>
        </View>
        <View style={[styles.privateBadge, { backgroundColor: colors.primary + '12' }]}>
          <Ionicons name="lock-closed-outline" size={15} color={colors.primary} />
        </View>
      </View>
      <SectionToggle section={section} onChange={setSection} colors={colors} />
    </View>
    <KeyboardAwareScrollViewCompat
      bottomOffset={28}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 32 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
    >
      {section === 'message' ? <>
        <ComposeCard
          message={message}
          onMessageChange={setMessage}
          files={files}
          onPickFiles={() => void pickFiles()}
          onRemoveFile={(index) => setFiles((current) => current.filter((_, i) => i !== index))}
          onSubmit={() => void submit()}
          busy={busy}
          error={composeError}
          colors={colors}
        />
        <View style={styles.listHeading}>
          <View style={styles.flex}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your review queue</Text>
            <Text style={[styles.helper, { color: colors.mutedForeground }]}>{pendingItems} item{pendingItems === 1 ? '' : 's'} awaiting confirmation</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh review queue" disabled={submissionsQuery.isFetching} onPress={() => void submissionsQuery.refetch()} testID="button-refresh-agent-network">
            {submissionsQuery.isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh-outline" size={20} color={colors.primary} />}
          </TouchableOpacity>
        </View>
        {submissionsQuery.isLoading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : submissionsQuery.isError
          ? <Text style={[styles.errorText, { color: colors.destructive }]}>Your review queue could not be loaded. Check your connection and refresh.</Text>
          : !submissions?.length ? <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="chatbox-ellipses-outline" size={26} color={colors.mutedForeground} />
            <Text style={[styles.itemTitle, { color: colors.foreground }]}>No messages yet</Text>
            <Text style={[styles.helper, { color: colors.mutedForeground }]}>A listing or buyer request you send will appear here for review.</Text>
          </View>
          : submissions.map((submission) => <ReviewSubmission
            key={submission.id}
            submission={submission}
            busy={busy}
            onConfirm={confirmItem}
            onCancel={cancelDraft}
            onShare={(id, enabled) => void updateSharing(id, enabled)}
            colors={colors}
            drafts={reviewDrafts}
            shareSelections={shareSelections}
            onDraftFieldChange={(key, field, value) => setReviewDrafts((current) => ({
              ...current,
              [key]: { ...current[key], [field]: value },
            }))}
            onShareChange={(key, value) => setShareSelections((current) => ({ ...current, [key]: value }))}
          />)}
      </> : <>
        <View style={styles.listHeading}>
          <View style={styles.flex}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Potential matches</Text>
            <Text style={[styles.helper, { color: colors.mutedForeground }]}>Private until both agents express interest</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh matches" disabled={matchesQuery.isFetching} onPress={() => void matchesQuery.refetch()} testID="button-refresh-network-matches">
            {matchesQuery.isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh-outline" size={20} color={colors.primary} />}
          </TouchableOpacity>
        </View>
        <View style={[styles.privacyNotice, { backgroundColor: colors.primary + '0D', borderColor: colors.primary + '20' }]}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          <Text style={[styles.helper, styles.flex, { color: colors.foreground }]}>Buyer names, phone numbers and email addresses stay hidden until both agents agree.</Text>
        </View>
        {matchesQuery.isLoading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : matchesQuery.isError
          ? <Text style={[styles.errorText, { color: colors.destructive }]}>Matches could not be loaded. Check your connection and refresh.</Text>
          : !matches?.length ? <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="git-compare-outline" size={26} color={colors.mutedForeground} />
            <Text style={[styles.itemTitle, { color: colors.foreground }]}>No matches yet</Text>
            <Text style={[styles.helper, { color: colors.mutedForeground }]}>Confirm a buyer request or privately share a listing to find a match.</Text>
          </View>
          : matches.map((match) => <MatchRow
            key={match.id}
            match={match}
            busy={respondToMatch.isPending}
            onRespond={(row, interested) => void respond(row, interested)}
            colors={colors}
          />)}
      </>}
    </KeyboardAwareScrollViewCompat>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  scroll: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 14 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: 23, fontWeight: '800', letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 12, marginTop: 2 },
  privateBadge: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sectionToggle: { flexDirection: 'row', padding: 4, borderRadius: 12, gap: 4 },
  sectionOption: { flex: 1, minHeight: 40, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8 },
  sectionOptionText: { fontSize: 12, fontWeight: '700' },
  content: { paddingHorizontal: 14, paddingTop: 14, gap: 13 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  iconTile: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  helper: { fontSize: 12, lineHeight: 17 },
  messageInput: { minHeight: 114, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, lineHeight: 22 },
  characterCount: { textAlign: 'right', marginTop: -7 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  secondaryButton: { minHeight: 42, paddingHorizontal: 12, borderWidth: 1, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryButtonText: { fontSize: 13, fontWeight: '700' },
  fileLimit: { flex: 1, textAlign: 'right' },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8 },
  attachmentName: { flex: 1, fontSize: 12, fontWeight: '600' },
  primaryButton: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, paddingHorizontal: 12 },
  primaryButtonText: { fontSize: 14, fontWeight: '800' },
  finePrint: { fontSize: 10, lineHeight: 15, textAlign: 'center' },
  errorText: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  listHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, marginTop: 3 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  emptyCard: { minHeight: 138, borderWidth: 1, borderRadius: 15, padding: 18, alignItems: 'center', justifyContent: 'center', gap: 7 },
  loader: { marginVertical: 30 },
  submissionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  statusPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5, alignSelf: 'flex-start' },
  statusText: { fontSize: 10, fontWeight: '800' },
  sourceText: { borderRadius: 10, padding: 10, fontSize: 12, lineHeight: 18 },
  reviewItem: { borderWidth: 1, borderRadius: 12, padding: 11, gap: 10 },
  itemTitle: { fontSize: 13, fontWeight: '800' },
  clarification: { borderRadius: 9, padding: 9, fontSize: 12, lineHeight: 17 },
  classifyButtons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  classifyButton: { minHeight: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldWrap: { gap: 5 },
  fieldLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.45 },
  fieldInput: { minHeight: 42, borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  multilineField: { minHeight: 70 },
  shareRow: { borderWidth: 1, borderRadius: 11, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  confirmButton: { minHeight: 42, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 10 },
  confirmText: { fontSize: 12, fontWeight: '800' },
  networkToggle: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 2 },
  networkToggleText: { fontSize: 12, fontWeight: '700' },
  cancelButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7 },
  cancelText: { fontSize: 12, fontWeight: '700' },
  processing: { alignItems: 'center', gap: 8, paddingVertical: 14 },
  matchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  matchPrice: { fontSize: 17, fontWeight: '900' },
  requirementBox: { borderRadius: 11, padding: 11, gap: 4 },
  whyBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  privacyBox: { borderWidth: 1, borderRadius: 11, padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  privacyNotice: { borderWidth: 1, borderRadius: 12, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  matchActions: { flexDirection: 'row', gap: 8 },
  listingTypeRow: { flexDirection: 'row', gap: 8 },
  listingTypeOption: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  listingTypeText: { fontSize: 12, fontWeight: '700' },
  declineButton: { minHeight: 42, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  declineText: { fontSize: 12, fontWeight: '800' },
});
