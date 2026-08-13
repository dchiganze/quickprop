export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  agency: string;
  branch: string;
  licenceNumber: string;
  role: 'agent' | 'administrator' | 'quickprop_admin';
  photo?: string;
}

export interface Property {
  id: string;
  referenceNumber: string;
  type: 'sale' | 'rent' | 'commercial' | 'stand' | 'farm' | 'mine';
  status: 'published' | 'draft' | 'archived' | 'sold' | 'rented' | 'pending';
  address: string;
  showAddress?: boolean;
  suburb: string;
  price: number;
  currency: string;
  negotiable: boolean;
  bedrooms?: number;
  bathrooms?: number;
  garages?: number;
  landSize?: number;
  floorArea?: number;
  levies?: number;
  rates?: number;
  features: string[];
  description: string;
  photos: string[];
  videoUrl?: string;
  coordinates?: { lat: number; lng: number };
  seller: {
    name: string;
    phone: string;
    email: string;
    mandateExpiry: string;
    mandateType: 'open' | 'sole' | 'exclusive';
    notes: string;
  };
  agentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  propertyId: string;
  propertyAddress: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  stage: 'new' | 'contacted' | 'viewing_booked' | 'offer' | 'negotiation' | 'completed' | 'lost';
  notes: string;
  followUpDate?: string;
  createdAt: string;
}

export interface BuyerMatch {
  id: string;
  propertyId: string;
  propertyAddress: string;
  buyerName: string;
  matchPercentage: number;
  budget: number;
  preferredLocation: string;
  financeType: 'cash' | 'mortgage' | 'diaspora';
  urgency: 'immediate' | 'within_month' | 'flexible';
  preferences: string[];
  responded: boolean;
}

export interface Task {
  id: string;
  title: string;
  type: 'call_seller' | 'viewing' | 'price_update' | 'renew_mandate' | 'take_photos' | 'other';
  dueDate: string;
  propertyId?: string;
  propertyAddress?: string;
  completed: boolean;
  createdAt: string;
}

export const PROPERTY_FEATURES = [
  'Solar', 'Borehole', 'Swimming Pool', 'Electric Fence',
  'Staff Quarters', 'Cottage', 'Fitted Kitchen', 'Generator',
  'Fireplace', 'Fibre', 'Air Conditioning', 'Alarm System',
  'Paved Driveway', 'Municipal Water', 'Septic Tank', 'Internet',
  'Schools Nearby', 'Hospital Nearby', 'Shopping Centre Nearby',
  'Double Storey', 'Servant Quarters', 'Garden', 'Deck',
  'Study', 'Gym', 'Home Theatre', 'Wine Cellar',
  'Irrigation', 'Boma', 'Lapa', 'Outhouse',
];

export interface PropertyAlert {
  id: string;
  agentId: string;
  name: string;
  type?: Property['type'];
  suburb?: string;
  minBedrooms?: number;
  maxPrice?: number;
  currency?: string;
  features: string[];
  createdAt: string;
  seenPropertyIds: string[];
}

export const LEAD_STAGES: Record<Lead['stage'], { label: string; color: string }> = {
  new: { label: 'New', color: '#3B82F6' },
  contacted: { label: 'Contacted', color: '#8B5CF6' },
  viewing_booked: { label: 'Viewing Booked', color: '#F59E0B' },
  offer: { label: 'Offer', color: '#10B981' },
  negotiation: { label: 'Negotiation', color: '#F97316' },
  completed: { label: 'Completed', color: '#10B981' },
  lost: { label: 'Lost', color: '#EF4444' },
};
