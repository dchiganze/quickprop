import { apiBaseUrl, getStoredAccessToken } from '@/contexts/AuthContext';
import {
  CollaborationListing,
  CollaborationRequest,
  CollaborationRequestStatus,
} from '@/types';

type DiscoveryFilters = {
  q?: string;
  suburb?: string;
  minBedrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  feature?: string[];
};

function apiUnavailable(): Error {
  return new Error('QuickProp cloud is unavailable. Connect to the internet and try again.');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiBaseUrl) throw apiUnavailable();
  const token = await getStoredAccessToken();
  if (!token) throw new Error('Please sign in again to use Matches.');

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || 'Unable to complete that collaboration action.');
  }
  return response.json() as Promise<T>;
}

export async function discoverCollaborations(filters: DiscoveryFilters = {}): Promise<CollaborationListing[]> {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.suburb?.trim()) params.set('suburb', filters.suburb.trim());
  if (filters.minBedrooms) params.set('minBedrooms', String(filters.minBedrooms));
  if (filters.minPrice) params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
  if (filters.minSize) params.set('minSize', String(filters.minSize));
  if (filters.maxSize) params.set('maxSize', String(filters.maxSize));
  if (filters.feature?.length) params.set('feature', filters.feature.join(','));
  const query = params.toString();
  return request<CollaborationListing[]>(`/collaboration/discovery${query ? `?${query}` : ''}`);
}

export async function listCollaborationRequests(
  direction: 'incoming' | 'outgoing',
): Promise<CollaborationRequest[]> {
  return request<CollaborationRequest[]>(`/collaboration/requests?direction=${direction}`);
}

export async function createCollaborationRequest(
  propertyId: number,
  message?: string,
): Promise<CollaborationRequest> {
  return request<CollaborationRequest>('/collaboration/requests', {
    method: 'POST',
    body: JSON.stringify({ propertyId, message: message?.trim() || undefined }),
  });
}

export async function updateCollaborationRequest(
  requestId: number,
  status: Extract<CollaborationRequestStatus, 'approved' | 'declined' | 'cancelled'>,
): Promise<CollaborationRequest> {
  return request<CollaborationRequest>(`/collaboration/requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}