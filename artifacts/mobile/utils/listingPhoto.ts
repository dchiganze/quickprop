import { Property } from '@/types';

// Seed listings retain polished imagery until an agent uploads a real photo.
// Uploaded listing photos always take precedence.
const DEMO_PHOTOS: Record<string, string> = {
  'prop-001': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80',
  'prop-002': 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=900&q=80',
  'prop-003': 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=900&q=80',
  'prop-004': 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&q=80',
  'prop-005': 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900&q=80',
  'prop-006': 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=900&q=80',
};

export function getPrimaryListingPhoto(property: Pick<Property, 'id' | 'photos'>): string | undefined {
  return property.photos?.[0] || DEMO_PHOTOS[property.id];
}