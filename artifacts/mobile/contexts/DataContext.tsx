import React, { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Property, Lead, BuyerMatch, Task, PropertyAlert } from '@/types';
import { registerDataReset } from './dataReset';
import { useNetworkStatus } from './ConnectivityContext';
import { apiBaseUrl, apiOrigin, getStoredAccessToken, useAuth } from './AuthContext';
import {
  createProperty, createTask, createViewing, deleteAgentSearchAlert, deleteProperty as deleteRemoteProperty,
  deleteTask as deleteRemoteTask, deleteViewing as deleteRemoteViewing,
  listAgentSearchAlerts, listProperties, listTasks, listViewings,
  markAgentSearchAlertMatchesSeen, markPropertySold as markRemotePropertySold, upsertAgentSearchAlert,
  updateProperty as updateRemoteProperty,
  updateTask as updateRemoteTask, updateViewing as updateRemoteViewing,
  type AgentSearchAlert as ApiAgentSearchAlert,
  type AgentSearchAlertInput,
  type Property as ApiProperty, type PropertyInput, type PropertyUpdate,
  type MarkPropertySoldInput, type PropertySaleConfirmationRequestResult,
  type Task as ApiTask, type TaskInput, type TaskUpdate,
  type Viewing as ApiViewing, type ViewingInput, type ViewingUpdate,
} from '@workspace/api-client-react';

export interface AlertMatch {
  alert: PropertyAlert;
  properties: Property[];
}

export type CloudSyncState = 'offline' | 'syncing' | 'synced' | 'pending' | 'error';

interface DataContextType {
  properties: Property[];
  leads: Lead[];
  buyerMatches: BuyerMatch[];
  tasks: Task[];
  viewings: ApiViewing[];
  alerts: PropertyAlert[];
  alertMatches: AlertMatch[];
  unseenMatchCount: number;
  isLoading: boolean;
  cloudSyncEnabled: boolean;
  cloudSyncState: CloudSyncState;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  pendingSyncCount: number;
  syncNow: () => Promise<void>;
  addProperty: (p: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Property>;
  updateProperty: (id: string, updates: Partial<Property>) => Promise<void>;
  recordPropertySale: (id: string, input: MarkPropertySoldInput) => Promise<PropertySaleConfirmationRequestResult>;
  deleteProperty: (id: string) => Promise<void>;
  addLead: (l: Omit<Lead, 'id' | 'createdAt'>) => Promise<Lead>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  addTask: (t: Omit<Task, 'id' | 'createdAt'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addViewing: (viewing: ViewingInput) => Promise<void>;
  updateViewing: (id: string, updates: ViewingUpdate) => Promise<void>;
  deleteViewing: (id: string) => Promise<void>;
  addAlert: (a: Omit<PropertyAlert, 'id' | 'createdAt' | 'seenPropertyIds'>) => Promise<void>;
  deleteAlert: (id: string) => Promise<void>;
  dismissAlertMatches: (alertId: string, propertyIds: string[]) => Promise<void>;
}

const PROPS_KEY = '@qp_properties';
const LEADS_KEY = '@qp_leads';
const MATCHES_KEY = '@qp_matches';
const TASKS_KEY = '@qp_tasks';
const ALERTS_KEY = '@qp_alerts';
const VIEWINGS_KEY = '@qp_viewings';
const PENDING_SYNC_KEY = '@qp_pending_sync';

type PendingSyncMetadata = {
  retryCount?: number;
  retryAt?: number;
};

type PendingSync = PendingSyncMetadata & (
  | { kind: 'property-create'; localId: string; property: Property }
  | { kind: 'property-update'; localId: string; updates: Partial<Property> }
  | { kind: 'property-delete'; localId: string }
  | { kind: 'task-create'; localId: string; task: Task }
  | { kind: 'task-update'; localId: string; updates: Partial<Task> }
  | { kind: 'task-delete'; localId: string }
  | { kind: 'viewing-create'; localId: string; mutationKey: string; viewing: ViewingInput }
  | { kind: 'viewing-update'; localId: string; updates: ViewingUpdate }
  | { kind: 'viewing-delete'; localId: string }
  | { kind: 'alert-delete'; localId: string }
);

export function propertyMatchesAlert(p: Property, alert: PropertyAlert): boolean {
  if (alert.type && p.type !== alert.type) return false;
  if (alert.suburb && !p.suburb.toLowerCase().includes(alert.suburb.toLowerCase())) return false;
  if (alert.minBedrooms && (p.bedrooms ?? 0) < alert.minBedrooms) return false;
  if (alert.maxPrice && p.price > alert.maxPrice) return false;
  if (alert.currency && p.currency !== alert.currency) return false;
  if (alert.features.length > 0) {
    const hasAll = alert.features.every(f =>
      p.features.some(pf => pf.toLowerCase().includes(f.toLowerCase()))
    );
    if (!hasAll) return false;
  }
  return true;
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const now = () => new Date().toISOString();
const parseStoredArray = <T,>(raw: string | null, fallback: T[]): T[] => {
  if (!raw) return fallback;
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value as T[] : fallback;
  } catch {
    return fallback;
  }
};

const isServerId = (id: string) => /^\d+$/.test(id);
const remoteEnabled = (userId?: string) => Boolean(apiBaseUrl && apiOrigin && userId && isServerId(userId));

function syncErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Unable to reach QuickProp cloud. Your changes are saved on this device and will retry automatically.';
}

function isConnectivityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return error instanceof TypeError || /network request failed|network error|failed to fetch|offline|timed out|timeout|connection reset|internet disconnected/.test(message);
}

function isApiNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && 'status' in error
    && (error as { status?: unknown }).status === 404;
}

function mobileStatus(status: string): Property['status'] {
  if (status === 'public' || status === 'coming_soon' || status === 'under_offer') return 'published';
  if (status === 'internal_only' || status === 'private_listing') return 'pending';
  if (status === 'withdrawn') return 'archived';
  return ['draft', 'archived', 'sold', 'rented'].includes(status) ? status as Property['status'] : 'draft';
}

function serverStatus(status: Property['status']): string {
  if (status === 'published') return 'public';
  if (status === 'pending') return 'internal_only';
  return status;
}

export function parsePrivateContactNotes(value?: string | null) {
  const remaining: string[] = [];
  let name = '';
  let phone = '';
  let email = '';

  for (const line of (value ?? '').split(/\r?\n/).map(item => item.trim()).filter(Boolean)) {
    const contactField = line.match(/^(seller|landlord)\s*:\s*(.*)$/i);
    const phoneField = line.match(/^phone\s*:\s*(.*)$/i);
    const emailField = line.match(/^email\s*:\s*(.*)$/i);
    if (contactField) {
      const candidate = contactField[2].trim();
      if (!/seller details available in quickprop office/i.test(candidate)) name = candidate;
    } else if (phoneField) {
      phone = phoneField[1].trim();
    } else if (emailField) {
      email = emailField[1].trim();
    } else {
      remaining.push(line);
    }
  }

  return { name, phone, email, notes: remaining.join('\n') };
}

function toMobileProperty(property: ApiProperty): Property {
  const type: Property['type'] = property.propertyType === 'commercial' || property.propertyType === 'stand' || property.propertyType === 'farm'
    ? property.propertyType
    : property.listingType === 'rent' ? 'rent' : 'sale';
  const privateContact = parsePrivateContactNotes(property.privateNotes);
  return {
    id: String(property.id),
    referenceNumber: property.reference,
    title: property.title,
    type,
    propertyType: property.propertyType,
    listingType: property.listingType === 'rent' ? 'rent' : 'sale',
    status: mobileStatus(property.status),
    address: property.address ?? '',
    showAddress: property.addressVisible,
    suburb: property.suburb,
    city: property.city,
    price: property.price,
    salePrice: property.salePrice ?? undefined,
    soldAt: property.soldAt ?? null,
    currency: property.currency,
    negotiable: property.negotiable ?? false,
    bedrooms: property.bedrooms ?? undefined,
    bathrooms: property.bathrooms ?? undefined,
    garages: property.parking ?? undefined,
    landSize: property.landSize ?? undefined,
    floorArea: property.buildingSize ?? undefined,
    levies: property.levies ?? undefined,
    rates: property.rates ?? undefined,
    features: property.features ?? [],
    description: property.description ?? '',
    photos: property.photos ?? [],
    proposedViewingTimes: property.proposedViewingTimes ?? [],
    videoUrl: property.videoUrl ?? undefined,
    collaborationEnabled: property.collaborationEnabled ?? false,
    seller: {
      name: privateContact.name,
      phone: privateContact.phone,
      email: privateContact.email,
      mandateExpiry: property.mandateExpiry ?? '',
      mandateType: property.mandateType === 'open' ? 'open' : 'sole',
      notes: privateContact.notes,
    },
    agentId: String(property.agentId ?? ''),
    createdAt: property.createdAt ?? now(),
    updatedAt: property.updatedAt ?? property.createdAt ?? now(),
    freshnessStatus: property.freshnessStatus as Property['freshnessStatus'],
    availabilityStatus: property.availabilityStatus as Property['availabilityStatus'],
    lastConfirmedAt: property.lastAvailabilityConfirmedAt,
    nextConfirmationAt: property.nextConfirmationAt,
    freshnessScore: property.freshnessScore,
    qualityScore: property.qualityScore,
    coordinates: property.latitude != null && property.longitude != null
      ? { lat: property.latitude, lng: property.longitude }
      : undefined,
  };
}

function toServerProperty(property: Property, userId: string): PropertyInput {
  const propertyType = property.propertyType ?? (
    property.type === 'commercial' || property.type === 'stand' || property.type === 'farm' || property.type === 'mine'
      ? property.type
      : 'house'
  );
  const listingType = property.listingType ?? (property.type === 'rent' ? 'rent' : 'sale');
  return {
    title: property.title || property.address || `${property.bedrooms ?? ''} bedroom ${propertyType}`.trim(),
    description: property.description,
    propertyType,
    listingType,
    status: serverStatus(property.status),
    pipelineStage: property.status === 'published' ? 'published' : property.status === 'pending' ? 'ready' : property.status,
    price: property.price,
    salePrice: property.salePrice,
    currency: property.currency,
    suburb: property.suburb,
    city: property.city || 'Harare',
    address: property.address || undefined,
    addressVisible: Boolean(property.showAddress),
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parking: property.garages,
    landSize: property.landSize,
    buildingSize: property.floorArea,
    negotiable: property.negotiable,
    levies: property.levies,
    rates: property.rates,
    features: property.features,
    photos: property.photos,
    proposedViewingTimes: property.proposedViewingTimes ?? [],
    videoUrl: property.videoUrl,
    coverImage: property.photos[0],
    latitude: property.coordinates?.lat,
    longitude: property.coordinates?.lng,
    collaborationEnabled: property.collaborationEnabled ?? false,
    agentId: Number(userId),
    sellerName: property.seller.name || undefined,
    sellerPhone: property.seller.phone || undefined,
    sellerEmail: property.seller.email || undefined,
    sellerNotes: property.seller.notes || undefined,
    mandateType: property.seller.mandateType === 'open' ? 'open' : 'sole',
    mandateExpiry: property.seller.mandateExpiry || undefined,
  };
}

function toServerTask(task: Task, userId: string, propertyId?: string): TaskInput {
  return {
    title: task.title,
    type: task.type === 'price_update' ? 'price_review' : task.type,
    dueDate: task.dueDate,
    propertyId: propertyId && isServerId(propertyId) ? Number(propertyId) : undefined,
    assigneeId: Number(userId),
  };
}

function toMobileTask(task: ApiTask, properties: Property[]): Task {
  const property = task.propertyId ? properties.find(p => p.id === String(task.propertyId)) : undefined;
  const supportedTypes = ['call_seller', 'viewing', 'price_update', 'renew_mandate', 'take_photos', 'other'];
  const type = task.type === 'price_review' ? 'price_update' : task.type;
  return {
    id: String(task.id),
    title: task.title,
    type: supportedTypes.includes(type ?? '') ? type as Task['type'] : 'other',
    dueDate: task.dueDate ?? now(),
    propertyId: task.propertyId ? String(task.propertyId) : undefined,
    propertyAddress: property?.address,
    completed: task.status === 'done',
    createdAt: task.createdAt,
  };
}

function toAgentSearchAlertInput(alert: PropertyAlert): AgentSearchAlertInput {
  return {
    name: alert.name,
    type: alert.type ?? null,
    suburb: alert.suburb ?? null,
    minBedrooms: alert.minBedrooms ?? null,
    maxPrice: alert.maxPrice ?? null,
    currency: alert.currency ?? null,
    features: alert.features,
  };
}

function toMobileSearchAlert(alert: ApiAgentSearchAlert, agentId: string): PropertyAlert {
  return {
    id: alert.id,
    agentId,
    name: alert.name,
    type: (alert.type ?? undefined) as PropertyAlert['type'],
    suburb: alert.suburb ?? undefined,
    minBedrooms: alert.minBedrooms ?? undefined,
    maxPrice: alert.maxPrice ?? undefined,
    currency: alert.currency ?? undefined,
    features: alert.features,
    createdAt: alert.createdAt,
    seenPropertyIds: alert.seenPropertyIds,
  };
}

async function uploadOneMedia(uri: string, mediaKind: 'image' | 'video'): Promise<string> {
  if (!apiBaseUrl || !apiOrigin || /^https?:\/\//.test(uri)) return uri;
  const source = await fetch(uri);
  const blob = await source.blob();
  const fileName = uri.split('/').pop()?.split('?')[0] || (mediaKind === 'video' ? 'listing-video.mp4' : 'listing-photo.jpg');
  const lowerFileName = fileName.toLowerCase();
  const contentType = blob.type || (
    mediaKind === 'video'
      ? lowerFileName.endsWith('.mov') ? 'video/quicktime' : lowerFileName.endsWith('.webm') ? 'video/webm' : 'video/mp4'
      : lowerFileName.endsWith('.png') ? 'image/png' : 'image/jpeg'
  );
  const token = await getStoredAccessToken();
  const request = await fetch(`${apiBaseUrl}/storage/uploads/request-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ name: fileName, size: blob.size, contentType }),
  });
  if (!request.ok) throw new Error(`Could not prepare ${mediaKind} upload.`);
  const { uploadURL, objectPath } = await request.json() as { uploadURL: string; objectPath: string };
  const upload = await fetch(uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
  if (!upload.ok) throw new Error(`Could not upload ${mediaKind}.`);
  return `${apiOrigin}/api/storage${objectPath}`;
}

async function uploadPropertyMedia(property: Property): Promise<Property> {
  const photos = await Promise.all(property.photos.map(uri => uploadOneMedia(uri, 'image')));
  const videoUrl = property.videoUrl ? await uploadOneMedia(property.videoUrl, 'video') : undefined;
  return { ...property, photos, videoUrl };
}

const LEGACY_DEMO_PROPERTY_IDS = new Set([
  'prop-001',
  'prop-002',
  'prop-003',
  'prop-004',
  'prop-005',
  'prop-006',
]);

function isLegacyDemoPropertyOperation(operation: PendingSync): boolean {
  if (operation.kind === 'property-create') {
    return LEGACY_DEMO_PROPERTY_IDS.has(operation.localId)
      || LEGACY_DEMO_PROPERTY_IDS.has(operation.property.id);
  }
  return (operation.kind === 'property-update' || operation.kind === 'property-delete')
    && LEGACY_DEMO_PROPERTY_IDS.has(operation.localId);
}

const MOCK_LEADS: Lead[] = [
  {
    id: 'lead-001', propertyId: 'prop-001', propertyAddress: '14 Acacia Avenue, Borrowdale',
    buyerName: 'David Mupfumi', buyerPhone: '+263 77 888 9999', buyerEmail: 'd.mupfumi@email.com',
    stage: 'viewing_booked', notes: 'Very interested. Cash buyer. Wants to view Saturday morning.',
    followUpDate: new Date(Date.now() + 86400000 * 2).toISOString(), createdAt: '2024-12-14T10:00:00Z',
  },
  {
    id: 'lead-002', propertyId: 'prop-002', propertyAddress: '7 Jacaranda Close, Highlands',
    buyerName: 'Grace Chirau', buyerPhone: '+263 71 777 8888', buyerEmail: 'g.chirau@gmail.com',
    stage: 'contacted', notes: 'Diaspora buyer. Financing through Standard Chartered. Needs full documentation.',
    followUpDate: new Date(Date.now() + 86400000).toISOString(), createdAt: '2024-12-16T14:00:00Z',
  },
  {
    id: 'lead-003', propertyId: 'prop-003', propertyAddress: '22 Palm Drive, Greendale',
    buyerName: 'Emmanuel Sithole', buyerPhone: '+263 73 666 7777', buyerEmail: 'e.sithole@corp.com',
    stage: 'offer', notes: 'Offered $270k. Seller counter-offered $280k. Negotiation ongoing.',
    followUpDate: new Date(Date.now() + 86400000 * 3).toISOString(), createdAt: '2024-12-10T09:00:00Z',
  },
  {
    id: 'lead-004', propertyId: 'prop-004', propertyAddress: '5B Mount Pleasant Heights',
    buyerName: 'Amara Okonkwo', buyerPhone: '+263 77 555 4444', buyerEmail: 'a.okonkwo@ngomain.org',
    stage: 'new', notes: 'NGO worker relocating from Zambia. Needs by end of January.',
    createdAt: '2024-12-20T11:00:00Z',
  },
];

const MOCK_MATCHES: BuyerMatch[] = [
  {
    id: 'match-001', propertyId: 'prop-001', propertyAddress: '14 Acacia Avenue, Borrowdale',
    buyerName: 'Thomas Mpofu', matchPercentage: 94, budget: 450000, preferredLocation: 'Borrowdale',
    financeType: 'cash', urgency: 'immediate', preferences: ['4+ bedrooms', 'Pool', 'Solar', 'Borehole'],
    responded: false,
  },
  {
    id: 'match-002', propertyId: 'prop-002', propertyAddress: '7 Jacaranda Close, Highlands',
    buyerName: 'Chido Zvinavashe', matchPercentage: 87, budget: 380000, preferredLocation: 'Highlands',
    financeType: 'diaspora', urgency: 'within_month', preferences: ['3+ bedrooms', 'Modern kitchen', 'Fibre'],
    responded: false,
  },
  {
    id: 'match-003', propertyId: 'prop-003', propertyAddress: '22 Palm Drive, Greendale',
    buyerName: 'Faith Mutasa', matchPercentage: 82, budget: 300000, preferredLocation: 'Greendale',
    financeType: 'mortgage', urgency: 'within_month', preferences: ['Family home', 'Pool', 'Quiet area'],
    responded: true,
  },
  {
    id: 'match-004', propertyId: 'prop-001', propertyAddress: '14 Acacia Avenue, Borrowdale',
    buyerName: 'Victor Chigamba', matchPercentage: 78, budget: 420000, preferredLocation: 'Borrowdale',
    financeType: 'cash', urgency: 'flexible', preferences: ['4 bedrooms', 'Electric fence', 'Generator'],
    responded: false,
  },
];

const MOCK_TASKS: Task[] = [
  {
    id: 'task-001', title: 'Call Robert re: Borrowdale mandate renewal', type: 'call_seller',
    dueDate: new Date().toISOString(), propertyId: 'prop-001', propertyAddress: '14 Acacia Avenue',
    completed: false, createdAt: '2024-12-18T09:00:00Z',
  },
  {
    id: 'task-002', title: 'Viewing with David Mupfumi - 14 Acacia Ave', type: 'viewing',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(), propertyId: 'prop-001',
    propertyAddress: '14 Acacia Avenue', completed: false, createdAt: '2024-12-19T10:00:00Z',
  },
  {
    id: 'task-003', title: 'Update price for Greendale listing', type: 'price_update',
    dueDate: new Date().toISOString(), propertyId: 'prop-003', propertyAddress: '22 Palm Drive',
    completed: false, createdAt: '2024-12-20T08:00:00Z',
  },
  {
    id: 'task-004', title: 'Take additional photos - Highlands property', type: 'take_photos',
    dueDate: new Date(Date.now() - 86400000).toISOString(), propertyId: 'prop-002',
    propertyAddress: '7 Jacaranda Close', completed: false, createdAt: '2024-12-15T09:00:00Z',
  },
  {
    id: 'task-005', title: 'Renew sole mandate - Avondale Commercial', type: 'renew_mandate',
    dueDate: new Date(Date.now() + 86400000 * 7).toISOString(), propertyId: 'prop-005',
    propertyAddress: '103 Samora Machel Ave', completed: false, createdAt: '2024-12-20T11:00:00Z',
  },
];

const DataContext = createContext<DataContextType>({} as DataContextType);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isOnline, isOffline } = useNetworkStatus();
  const cloudSyncEnabled = remoteEnabled(user?.id);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [buyerMatches, setBuyerMatches] = useState<BuyerMatch[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewings, setViewings] = useState<ApiViewing[]>([]);
  const [alerts, setAlerts] = useState<PropertyAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cloudSyncState, setCloudSyncState] = useState<CloudSyncState>('offline');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  // Collections are ref-backed so asynchronous mutations never use a render's
  // stale snapshot. Versions prevent a late hydration from replacing a
  // collection changed while its AsyncStorage read was in flight.
  const propertiesRef = useRef<Property[]>([]);
  const leadsRef = useRef<Lead[]>([]);
  const buyerMatchesRef = useRef<BuyerMatch[]>([]);
  const tasksRef = useRef<Task[]>([]);
  const viewingsRef = useRef<ApiViewing[]>([]);
  const alertsRef = useRef<PropertyAlert[]>([]);
  const resetGenerationRef = useRef(0);
  const propertiesVersionRef = useRef(0);
  const leadsVersionRef = useRef(0);
  const buyerMatchesVersionRef = useRef(0);
  const tasksVersionRef = useRef(0);
  const alertsVersionRef = useRef(0);
  const pendingSyncRef = useRef<PendingSync[]>([]);
  const syncedPropertyResultsRef = useRef(new Map<string, Property>());
  const flushingRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncNowRef = useRef<() => Promise<void>>(() => Promise.resolve());

  useEffect(() => registerDataReset(() => {
    // Invalidate a pending hydration before clearing every in-memory collection.
    // This prevents late AsyncStorage reads from repopulating deleted data.
    resetGenerationRef.current += 1;
    propertiesRef.current = [];
    leadsRef.current = [];
    buyerMatchesRef.current = [];
    tasksRef.current = [];
    viewingsRef.current = [];
    pendingSyncRef.current = [];
    syncedPropertyResultsRef.current.clear();
    alertsRef.current = [];
    propertiesVersionRef.current += 1;
    leadsVersionRef.current += 1;
    buyerMatchesVersionRef.current += 1;
    tasksVersionRef.current += 1;
    alertsVersionRef.current += 1;
    setProperties([]);
    setLeads([]);
    setBuyerMatches([]);
    setTasks([]);
    setViewings([]);
    setAlerts([]);
    setIsLoading(false);
    setCloudSyncState('offline');
    setLastSyncedAt(null);
    setLastSyncError(null);
  }), []);

  useEffect(() => {
    const load = async () => {
      const generation = resetGenerationRef.current;
      const collectionVersions = {
        properties: propertiesVersionRef.current,
        leads: leadsVersionRef.current,
        buyerMatches: buyerMatchesVersionRef.current,
        tasks: tasksVersionRef.current,
        alerts: alertsVersionRef.current,
      };
      try {
        const [ps, ls, ms, ts, as_, vs, pending] = await Promise.all([
          AsyncStorage.getItem(PROPS_KEY),
          AsyncStorage.getItem(LEADS_KEY),
          AsyncStorage.getItem(MATCHES_KEY),
          AsyncStorage.getItem(TASKS_KEY),
          AsyncStorage.getItem(ALERTS_KEY),
          AsyncStorage.getItem(VIEWINGS_KEY),
          AsyncStorage.getItem(PENDING_SYNC_KEY),
        ]);
        if (generation !== resetGenerationRef.current) return;
        const storedProperties = parseStoredArray<Property>(ps, []);
        const loadedProperties = storedProperties.filter(
          property => !LEGACY_DEMO_PROPERTY_IDS.has(property.id),
        );
        const loadedLeads = parseStoredArray(ls, MOCK_LEADS);
        const loadedBuyerMatches = parseStoredArray(ms, MOCK_MATCHES);
        const loadedTasks = parseStoredArray(ts, MOCK_TASKS);
        const loadedAlerts = parseStoredArray(as_, []);
        const loadedViewings = parseStoredArray<ApiViewing>(vs, []);
        const parsedPending = parseStoredArray<PendingSync>(pending, []);
        // Queues written before viewing creates had an explicit mutation key
        // need one before replay. Persist the migration first so a restart
        // cannot make multiple legacy operations share a fallback key.
        const migratedPending = parsedPending.filter(
          operation => !isLegacyDemoPropertyOperation(operation),
        ).map((operation) => {
          if (operation.kind !== 'viewing-create' || typeof (operation as { mutationKey?: unknown }).mutationKey === 'string') {
            return operation;
          }
          return { ...operation, mutationKey: uid() };
        });
        pendingSyncRef.current = migratedPending;
        if (
          migratedPending.length !== parsedPending.length
          || migratedPending.some((operation, index) => operation !== parsedPending[index])
        ) {
          await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(migratedPending));
        }

        if (
          generation === resetGenerationRef.current &&
          propertiesVersionRef.current === collectionVersions.properties
        ) {
          propertiesRef.current = loadedProperties;
          setProperties(loadedProperties);
          if (!ps || loadedProperties.length !== storedProperties.length) {
            await AsyncStorage.setItem(PROPS_KEY, JSON.stringify(propertiesRef.current));
          }
        }
        viewingsRef.current = loadedViewings;
        setViewings(loadedViewings);
        if (!vs) await AsyncStorage.setItem(VIEWINGS_KEY, JSON.stringify(loadedViewings));
        if (
          generation === resetGenerationRef.current &&
          leadsVersionRef.current === collectionVersions.leads
        ) {
          leadsRef.current = loadedLeads;
          setLeads(loadedLeads);
          if (!ls) await AsyncStorage.setItem(LEADS_KEY, JSON.stringify(leadsRef.current));
        }
        if (
          generation === resetGenerationRef.current &&
          buyerMatchesVersionRef.current === collectionVersions.buyerMatches
        ) {
          buyerMatchesRef.current = loadedBuyerMatches;
          setBuyerMatches(loadedBuyerMatches);
          if (!ms) await AsyncStorage.setItem(MATCHES_KEY, JSON.stringify(buyerMatchesRef.current));
        }
        if (
          generation === resetGenerationRef.current &&
          tasksVersionRef.current === collectionVersions.tasks
        ) {
          tasksRef.current = loadedTasks;
          setTasks(loadedTasks);
          if (!ts) await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasksRef.current));
        }
        if (
          generation === resetGenerationRef.current &&
          alertsVersionRef.current === collectionVersions.alerts
        ) {
          alertsRef.current = loadedAlerts;
          setAlerts(loadedAlerts);
        }
      } finally {
        if (generation === resetGenerationRef.current) {
          setIsLoading(false);
          if (!remoteEnabled(user?.id)) setCloudSyncState('offline');
        }
      }
    };
    load();
  }, [user?.id]);

  const save = async <T,>(key: string, collectionRef: React.MutableRefObject<T[]>) =>
    AsyncStorage.setItem(key, JSON.stringify(collectionRef.current));

  const persistPending = async () => {
    await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pendingSyncRef.current));
  };

  const clearRetryTimer = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const scheduleRetry = (delayMs: number) => {
    if (retryTimerRef.current) return;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      syncNowRef.current().catch(() => {});
    }, delayMs);
  };

  const flushPendingSync = useCallback(async () => {
    if (!remoteEnabled(user?.id) || flushingRef.current) return;
    flushingRef.current = true;
    setCloudSyncState('syncing');
    const idMap = new Map<string, string>();
    try {
      while (pendingSyncRef.current.length > 0) {
        const operation = pendingSyncRef.current[0];
        const retryDelay = (operation.retryAt ?? 0) - Date.now();
        if (retryDelay > 0) {
          setCloudSyncState('pending');
          scheduleRetry(retryDelay);
          return;
        }
        const resolveId = (id: string) => idMap.get(id) ?? id;

        if (operation.kind === 'property-create') {
          const local = propertiesRef.current.find(p => p.id === operation.localId) ?? operation.property;
          const withDurableMedia = await uploadPropertyMedia(local);
          const created = await createProperty(
            toServerProperty(withDurableMedia, user!.id),
            { headers: { 'Idempotency-Key': operation.localId } },
          );
          const remote = toMobileProperty(created);
          idMap.set(operation.localId, remote.id);
          syncedPropertyResultsRef.current.set(operation.localId, remote);
          propertiesRef.current = propertiesRef.current.map(p => p.id === operation.localId ? remote : p);
          setProperties(propertiesRef.current);
          await save(PROPS_KEY, propertiesRef);
        } else if (operation.kind === 'property-update') {
          const id = resolveId(operation.localId);
          if (isServerId(id)) {
            const current = propertiesRef.current.find(p => p.id === id);
            if (current) {
              const withDurableMedia = await uploadPropertyMedia(current);
              const result = await updateRemoteProperty(Number(id), toServerProperty(withDurableMedia, user!.id) as PropertyUpdate);
              const remote = toMobileProperty(result);
              propertiesRef.current = propertiesRef.current.map(p => p.id === id ? remote : p);
              setProperties(propertiesRef.current);
              await save(PROPS_KEY, propertiesRef);
            }
          }
        } else if (operation.kind === 'property-delete') {
          const id = resolveId(operation.localId);
          if (isServerId(id)) await deleteRemoteProperty(Number(id));
        } else if (operation.kind === 'task-create') {
          const local = tasksRef.current.find(t => t.id === operation.localId) ?? operation.task;
          const propertyId = local.propertyId ? resolveId(local.propertyId) : undefined;
          const created = await createTask(
            toServerTask(local, user!.id, propertyId),
            { headers: { 'Idempotency-Key': operation.localId } },
          );
          const remote = toMobileTask(created, propertiesRef.current);
          idMap.set(operation.localId, remote.id);
          tasksRef.current = tasksRef.current.map(t => t.id === operation.localId ? remote : t);
          setTasks(tasksRef.current);
          await save(TASKS_KEY, tasksRef);
        } else if (operation.kind === 'task-update') {
          const id = resolveId(operation.localId);
          if (isServerId(id)) {
            const current = tasksRef.current.find(t => t.id === id);
            if (current) {
              const result = await updateRemoteTask(Number(id), {
                ...toServerTask(current, user!.id, current.propertyId),
                status: current.completed ? 'done' : 'open',
              } as TaskUpdate);
              const remote = toMobileTask(result, propertiesRef.current);
              tasksRef.current = tasksRef.current.map(t => t.id === id ? remote : t);
              setTasks(tasksRef.current);
              await save(TASKS_KEY, tasksRef);
            }
          }
        } else if (operation.kind === 'task-delete') {
          const id = resolveId(operation.localId);
          if (isServerId(id)) await deleteRemoteTask(Number(id));
        } else if (operation.kind === 'viewing-create') {
          const created = await createViewing(
            { ...operation.viewing, agentId: Number(user!.id) },
            { headers: { 'Idempotency-Key': operation.mutationKey } },
          );
          idMap.set(operation.localId, String(created.id));
          viewingsRef.current = viewingsRef.current.map(v => String(v.id) === operation.localId ? created : v);
          setViewings(viewingsRef.current);
          await save(VIEWINGS_KEY, viewingsRef);
        } else if (operation.kind === 'viewing-update') {
          const id = resolveId(operation.localId);
          if (isServerId(id)) {
            const updated = await updateRemoteViewing(Number(id), operation.updates);
            viewingsRef.current = viewingsRef.current.map(v => v.id === Number(id) ? updated : v);
            setViewings(viewingsRef.current);
            await save(VIEWINGS_KEY, viewingsRef);
          }
        } else if (operation.kind === 'viewing-delete') {
          const id = resolveId(operation.localId);
          if (isServerId(id)) await deleteRemoteViewing(Number(id));
        } else if (operation.kind === 'alert-delete') {
          try {
            await deleteAgentSearchAlert(operation.localId);
          } catch (error) {
            // An older API deployment has no search-alert route or synced alert to delete.
            if (!isApiNotFoundError(error)) throw error;
          }
        }

        pendingSyncRef.current.shift();
        await persistPending();
      }
    } catch (error) {
      // The local mutation has already been saved. Leave this operation and the
      // remaining order intact so it retries after the connection returns.
      const operation = pendingSyncRef.current[0];
      if (operation) {
        const retryCount = (operation.retryCount ?? 0) + 1;
        const retryDelay = Math.min(60_000, 1_000 * (2 ** Math.min(retryCount - 1, 6)));
        pendingSyncRef.current[0] = {
          ...operation,
          retryCount,
          retryAt: Date.now() + retryDelay,
        };
        await persistPending();
        scheduleRetry(retryDelay);
      }
      if (isConnectivityError(error)) {
        setLastSyncError(null);
        setCloudSyncState('offline');
      } else {
        setLastSyncError(syncErrorMessage(error));
        setCloudSyncState('pending');
      }
    } finally {
      flushingRef.current = false;
    }
  }, [user?.id]);

  const syncFromServer = useCallback(async () => {
    if (!remoteEnabled(user?.id)) return;
    setCloudSyncState('syncing');
    try {
      const [remoteProperties, remoteTasks, remoteViewings] = await Promise.all([
        listProperties({ agentId: Number(user!.id) }),
        listTasks({ assigneeId: Number(user!.id) }),
        listViewings({ agentId: Number(user!.id) }),
      ]);
      try {
        const remoteSearchAlerts = await listAgentSearchAlerts();
        const pendingAlertDeletes = new Set(
          pendingSyncRef.current
            .filter((operation): operation is Extract<PendingSync, { kind: 'alert-delete' }> => operation.kind === 'alert-delete')
            .map(operation => operation.localId),
        );
        const remoteAlertsById = new Map(remoteSearchAlerts.map(alert => [alert.id, alert]));
        for (const localAlert of alertsRef.current) {
          if (pendingAlertDeletes.has(localAlert.id)) continue;
          let remoteAlert = remoteAlertsById.get(localAlert.id);
          if (!remoteAlert) {
            remoteAlert = await upsertAgentSearchAlert(localAlert.id, toAgentSearchAlertInput(localAlert));
            remoteAlertsById.set(localAlert.id, remoteAlert);
          }
          const remoteSeen = new Set(remoteAlert.seenPropertyIds);
          const unseenServerIds = localAlert.seenPropertyIds
            .filter(id => /^\d+$/.test(id) && !remoteSeen.has(id))
            .map(Number);
          if (unseenServerIds.length) {
            await markAgentSearchAlertMatchesSeen(localAlert.id, { propertyIds: unseenServerIds });
          }
        }
        const refreshedAlerts = [...remoteAlertsById.values()]
          .filter(alert => !pendingAlertDeletes.has(alert.id))
          .map(alert => {
            const local = alertsRef.current.find(item => item.id === alert.id);
            const merged = toMobileSearchAlert(alert, user!.id);
            return local
              ? { ...merged, seenPropertyIds: [...new Set([...merged.seenPropertyIds, ...local.seenPropertyIds])] }
              : merged;
          });
        alertsRef.current = refreshedAlerts;
        alertsVersionRef.current += 1;
        setAlerts(refreshedAlerts);
        await save(ALERTS_KEY, alertsRef);
      } catch (error) {
        console.warn('Saved-search alert sync deferred; local alerts are preserved.', error);
      }

      const pendingPropertyDeletes = new Set(
        pendingSyncRef.current
          .filter((operation): operation is Extract<PendingSync, { kind: 'property-delete' }> => operation.kind === 'property-delete')
          .map(operation => operation.localId),
      );
      const existingCloudProperties = propertiesRef.current.filter(
        property => isServerId(property.id) && !pendingPropertyDeletes.has(property.id),
      );
      if (remoteProperties.length === 0 && existingCloudProperties.length > 0) {
        setLastSyncError('QuickProp cloud returned an empty portfolio. Your existing listings were kept safely on this device; tap to retry sync.');
        setCloudSyncState('error');
        return;
      }
      const pendingPropertyUpdates = new Map<string, Partial<Property>>();
      for (const operation of pendingSyncRef.current) {
        if (operation.kind === 'property-update') {
          pendingPropertyUpdates.set(operation.localId, {
            ...pendingPropertyUpdates.get(operation.localId),
            ...operation.updates,
          });
        }
      }
      const mappedProperties = remoteProperties
        .map(toMobileProperty)
        .filter(property => !pendingPropertyDeletes.has(property.id))
        .map(property => ({ ...property, ...pendingPropertyUpdates.get(property.id) }));
      const localOnlyProperties = propertiesRef.current.filter(
        property => !isServerId(property.id)
          && !LEGACY_DEMO_PROPERTY_IDS.has(property.id)
          && !pendingPropertyDeletes.has(property.id),
      );
      propertiesRef.current = [...mappedProperties, ...localOnlyProperties];
      setProperties(propertiesRef.current);
      await save(PROPS_KEY, propertiesRef);

      const pendingTaskDeletes = new Set(
        pendingSyncRef.current
          .filter((operation): operation is Extract<PendingSync, { kind: 'task-delete' }> => operation.kind === 'task-delete')
          .map(operation => operation.localId),
      );
      const pendingTaskUpdates = new Map<string, Partial<Task>>();
      for (const operation of pendingSyncRef.current) {
        if (operation.kind === 'task-update') {
          pendingTaskUpdates.set(operation.localId, {
            ...pendingTaskUpdates.get(operation.localId),
            ...operation.updates,
          });
        }
      }
      const mappedTasks = remoteTasks
        .map(task => toMobileTask(task, propertiesRef.current))
        .filter(task => !pendingTaskDeletes.has(task.id))
        .map(task => ({ ...task, ...pendingTaskUpdates.get(task.id) }));
      const localOnlyTasks = tasksRef.current.filter(
        task => !isServerId(task.id) && !pendingTaskDeletes.has(task.id),
      );
      tasksRef.current = [...mappedTasks, ...localOnlyTasks];
      setTasks(tasksRef.current);
      await save(TASKS_KEY, tasksRef);

      const pendingViewingDeletes = new Set(
        pendingSyncRef.current
          .filter((operation): operation is Extract<PendingSync, { kind: 'viewing-delete' }> => operation.kind === 'viewing-delete')
          .map(operation => operation.localId),
      );
      const pendingViewingUpdates = new Map<string, ViewingUpdate>();
      for (const operation of pendingSyncRef.current) {
        if (operation.kind === 'viewing-update') {
          pendingViewingUpdates.set(operation.localId, {
            ...pendingViewingUpdates.get(operation.localId),
            ...operation.updates,
          });
        }
      }
      const refreshedViewings = remoteViewings
        .filter(viewing => !pendingViewingDeletes.has(String(viewing.id)))
        .map(viewing => ({ ...viewing, ...pendingViewingUpdates.get(String(viewing.id)) }));
      const localOnlyViewings = viewingsRef.current.filter(
        viewing => !isServerId(String(viewing.id)) && !pendingViewingDeletes.has(String(viewing.id)),
      );
      viewingsRef.current = [...refreshedViewings, ...localOnlyViewings];
      setViewings(viewingsRef.current);
      await save(VIEWINGS_KEY, viewingsRef);
      setLastSyncedAt(now());
      if (pendingSyncRef.current.length > 0) {
        setCloudSyncState('pending');
      } else {
        setCloudSyncState('synced');
        setLastSyncError(null);
      }
    } catch (error) {
      // Offline access keeps the last persisted data visible.
      if (isConnectivityError(error)) {
        setLastSyncError(null);
        setCloudSyncState('offline');
      } else {
        setLastSyncError(syncErrorMessage(error));
        setCloudSyncState('error');
      }
    }
  }, [user?.id]);

  const syncNow = useCallback(async () => {
    if (!remoteEnabled(user?.id)) {
      setCloudSyncState('offline');
      return;
    }
    if (isOffline) {
      setCloudSyncState('offline');
      return;
    }
    await flushPendingSync();
    await syncFromServer();
  }, [user?.id, isOffline, flushPendingSync, syncFromServer]);

  useEffect(() => {
    syncNowRef.current = syncNow;
  }, [syncNow]);

  useEffect(() => () => {
    clearRetryTimer();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || isLoading || !isOnline) return;
    syncNow().catch(() => {});
  }, [user?.id, isLoading, isOnline, syncNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && isOnline) {
        syncNow().catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [isOnline, syncNow]);

  // A second agent can make changes while this app stays in the foreground.
  // Refresh periodically so active devices converge without waiting for an
  // AppState transition; the runtime pauses this work when backgrounded.
  useEffect(() => {
    if (!remoteEnabled(user?.id) || isLoading) return;
    const interval = setInterval(() => {
      if (AppState.currentState === 'active' && isOnline) {
        syncNow().catch(() => {});
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [user?.id, isLoading, isOnline, syncNow]);

  // Compute which published properties match each alert and haven't been dismissed
  const alertMatches = useMemo<AlertMatch[]>(() => {
    return alerts
      .map(alert => ({
        alert,
        properties: properties.filter(
          p => p.status === 'published' &&
            !alert.seenPropertyIds.includes(p.id) &&
            propertyMatchesAlert(p, alert)
        ),
      }))
      .filter(m => m.properties.length > 0);
  }, [alerts, properties]);

  const unseenMatchCount = useMemo(
    () => alertMatches.reduce((sum, m) => sum + m.properties.length, 0),
    [alertMatches]
  );

  const addProperty = async (p: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>) => {
    const prop: Property = { ...p, id: uid(), createdAt: now(), updatedAt: now() };
    const updated = [...propertiesRef.current, prop];
    propertiesRef.current = updated;
    propertiesVersionRef.current += 1;
    setProperties(updated);
    await save(PROPS_KEY, propertiesRef);
    if (remoteEnabled(user?.id)) {
      pendingSyncRef.current.push({ kind: 'property-create', localId: prop.id, property: prop });
      await persistPending();
      await syncNow();
    }
    return syncedPropertyResultsRef.current.get(prop.id) ?? prop;
  };

  const updateProperty = async (id: string, updates: Partial<Property>) => {
    const updated = propertiesRef.current.map(p => p.id === id ? { ...p, ...updates, updatedAt: now() } : p);
    propertiesRef.current = updated;
    propertiesVersionRef.current += 1;
    setProperties(updated);
    await save(PROPS_KEY, propertiesRef);
    if (remoteEnabled(user?.id)) {
      pendingSyncRef.current.push({ kind: 'property-update', localId: id, updates });
      await persistPending();
      await syncNow();
    }
  };

  const recordPropertySale = async (id: string, input: MarkPropertySoldInput) => {
    if (!remoteEnabled(user?.id) || !isServerId(id)) {
      throw new Error('Sync this listing to QuickProp before recording a sale.');
    }
    if (isOffline) throw new Error('Connect to the internet to request conveyancer confirmation.');
    await syncNow();
    if (pendingSyncRef.current.some(operation => operation.kind === 'property-update' && operation.localId === id)) {
      throw new Error('This listing has unsynced changes. Sync it and try recording the sale again.');
    }
    const result = await markRemotePropertySold(Number(id), input);
    const remote = toMobileProperty(result.property);
    propertiesRef.current = propertiesRef.current.map(property => property.id === id ? remote : property);
    propertiesVersionRef.current += 1;
    setProperties(propertiesRef.current);
    await save(PROPS_KEY, propertiesRef);
    return result;
  };

  const deleteProperty = async (id: string) => {
    const updated = propertiesRef.current.filter(p => p.id !== id);
    propertiesRef.current = updated;
    propertiesVersionRef.current += 1;
    setProperties(updated);
    await save(PROPS_KEY, propertiesRef);
    if (remoteEnabled(user?.id)) {
      // Deleting a record before its queued creation reaches the server should
      // never create a ghost listing later.
      if (!isServerId(id)) {
        pendingSyncRef.current = pendingSyncRef.current.filter(op =>
          !('localId' in op) || op.localId !== id
        );
      } else {
        pendingSyncRef.current.push({ kind: 'property-delete', localId: id });
      }
      await persistPending();
      await syncNow();
    }
  };

  const addLead = async (l: Omit<Lead, 'id' | 'createdAt'>) => {
    const lead: Lead = { ...l, id: uid(), createdAt: now() };
    const updated = [...leadsRef.current, lead];
    leadsRef.current = updated;
    leadsVersionRef.current += 1;
    setLeads(updated);
    await save(LEADS_KEY, leadsRef);
    return lead;
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    const updated = leadsRef.current.map(l => l.id === id ? { ...l, ...updates } : l);
    leadsRef.current = updated;
    leadsVersionRef.current += 1;
    setLeads(updated);
    await save(LEADS_KEY, leadsRef);
  };

  const addTask = async (t: Omit<Task, 'id' | 'createdAt'>) => {
    const task: Task = { ...t, id: uid(), createdAt: now() };
    const updated = [...tasksRef.current, task];
    tasksRef.current = updated;
    tasksVersionRef.current += 1;
    setTasks(updated);
    await save(TASKS_KEY, tasksRef);
    if (remoteEnabled(user?.id)) {
      pendingSyncRef.current.push({ kind: 'task-create', localId: task.id, task });
      await persistPending();
      await syncNow();
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const updated = tasksRef.current.map(t => t.id === id ? { ...t, ...updates } : t);
    tasksRef.current = updated;
    tasksVersionRef.current += 1;
    setTasks(updated);
    await save(TASKS_KEY, tasksRef);
    if (remoteEnabled(user?.id)) {
      pendingSyncRef.current.push({ kind: 'task-update', localId: id, updates });
      await persistPending();
      await syncNow();
    }
  };

  const deleteTask = async (id: string) => {
    const updated = tasksRef.current.filter(t => t.id !== id);
    tasksRef.current = updated;
    tasksVersionRef.current += 1;
    setTasks(updated);
    await save(TASKS_KEY, tasksRef);
    if (remoteEnabled(user?.id)) {
      if (!isServerId(id)) {
        pendingSyncRef.current = pendingSyncRef.current.filter(op =>
          !('localId' in op) || op.localId !== id
        );
      } else {
        pendingSyncRef.current.push({ kind: 'task-delete', localId: id });
      }
      await persistPending();
      await syncNow();
    }
  };

  const addViewing = async (viewing: ViewingInput) => {
    const localId = uid();
    const localViewing: ApiViewing = {
      id: -Math.floor(Math.random() * 2_000_000_000) - 1,
      propertyId: viewing.propertyId,
      buyerName: viewing.buyerName,
      leadId: viewing.leadId,
      agentId: Number(user?.id) || undefined,
      scheduledAt: viewing.scheduledAt,
      status: 'scheduled',
      notes: viewing.notes,
    };
    viewingsRef.current = [...viewingsRef.current, localViewing];
    setViewings(viewingsRef.current);
    await save(VIEWINGS_KEY, viewingsRef);
    if (remoteEnabled(user?.id)) {
      pendingSyncRef.current.push({
        kind: 'viewing-create',
        localId: String(localViewing.id),
        mutationKey: localId,
        viewing,
      });
      await persistPending();
      await syncNow();
    }
  };

  const updateViewing = async (id: string, updates: ViewingUpdate) => {
    const numericId = Number(id);
    viewingsRef.current = viewingsRef.current.map(viewing => viewing.id === numericId ? { ...viewing, ...updates } : viewing);
    setViewings(viewingsRef.current);
    await save(VIEWINGS_KEY, viewingsRef);
    if (remoteEnabled(user?.id)) {
      pendingSyncRef.current.push({ kind: 'viewing-update', localId: id, updates });
      await persistPending();
      await syncNow();
    }
  };

  const deleteViewing = async (id: string) => {
    const numericId = Number(id);
    viewingsRef.current = viewingsRef.current.filter(viewing => viewing.id !== numericId);
    setViewings(viewingsRef.current);
    await save(VIEWINGS_KEY, viewingsRef);
    if (remoteEnabled(user?.id)) {
      if (isServerId(id)) pendingSyncRef.current.push({ kind: 'viewing-delete', localId: id });
      else pendingSyncRef.current = pendingSyncRef.current.filter(op => !('localId' in op) || op.localId !== id);
      await persistPending();
      await syncNow();
    }
  };

  const addAlert = async (a: Omit<PropertyAlert, 'id' | 'createdAt' | 'seenPropertyIds'>) => {
    const alert: PropertyAlert = { ...a, id: uid(), createdAt: now(), seenPropertyIds: [] };
    const updated = [...alertsRef.current, alert];
    alertsRef.current = updated;
    alertsVersionRef.current += 1;
    setAlerts(updated);
    await save(ALERTS_KEY, alertsRef);
    void syncNowRef.current().catch(() => {});
  };

  const deleteAlert = async (id: string) => {
    const updated = alertsRef.current.filter(a => a.id !== id);
    alertsRef.current = updated;
    alertsVersionRef.current += 1;
    setAlerts(updated);
    await save(ALERTS_KEY, alertsRef);
    if (remoteEnabled(user?.id)) {
      pendingSyncRef.current.push({ kind: 'alert-delete', localId: id });
      await persistPending();
      void syncNowRef.current().catch(() => {});
    }
  };

  const dismissAlertMatches = async (alertId: string, propertyIds: string[]) => {
    const updated = alertsRef.current.map(a =>
      a.id === alertId
        ? { ...a, seenPropertyIds: [...new Set([...a.seenPropertyIds, ...propertyIds])] }
        : a
    );
    alertsRef.current = updated;
    alertsVersionRef.current += 1;
    setAlerts(updated);
    await save(ALERTS_KEY, alertsRef);
    void syncNowRef.current().catch(() => {});
  };

  return (
    <DataContext.Provider value={{
      properties, leads, buyerMatches, tasks, viewings, alerts,
      alertMatches, unseenMatchCount, isLoading,
      cloudSyncEnabled, cloudSyncState, lastSyncedAt, lastSyncError,
      pendingSyncCount: pendingSyncRef.current.length, syncNow,
      addProperty, updateProperty, recordPropertySale, deleteProperty,
      addLead, updateLead, addTask, updateTask, deleteTask,
      addViewing, updateViewing, deleteViewing,
      addAlert, deleteAlert, dismissAlertMatches,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
