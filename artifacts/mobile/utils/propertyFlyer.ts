import type { Property, User } from '@/types';

export type FlyerTemplate = 'editorial' | 'showcase' | 'minimal';

export interface FlyerSettings {
  template: FlyerTemplate;
  agencyName: string;
  logoUrl: string;
  primaryColor: string;
  headline: string;
  contactName: string;
  contactPhone: string;
  tagline: string;
}

export const FLYER_TEMPLATES: Array<{ id: FlyerTemplate; label: string; hint: string }> = [
  { id: 'editorial', label: 'Editorial', hint: 'Bold headline, photo grid, contact bar' },
  { id: 'showcase', label: 'Showcase', hint: 'Full-bleed photo, overlay details' },
  { id: 'minimal', label: 'Minimal', hint: 'Quiet, spacious, price-led' },
];

export const FALLBACK_FLYER_COLOR = '#1A3C6E';

export function isHexColor(value: string): boolean {
  return /^#([0-9a-f]{6})$/i.test(value.trim());
}

export function safeColor(value: string): string {
  return isHexColor(value) ? value.trim() : FALLBACK_FLYER_COLOR;
}

export function readableOn(hex: string): string {
  const c = safeColor(hex).slice(1);
  const [r, g, b] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0B1929' : '#FFFFFF';
}

export function defaultHeadline(property: Property): string {
  const title = property.title?.trim();
  if (title) return title;
  const kind = property.propertyType?.trim() || property.type;
  const label = property.listingType === 'rent' || property.type === 'rent' ? 'To Rent' : 'For Sale';
  return [kind.charAt(0).toUpperCase() + kind.slice(1), label].filter(Boolean).join(' ');
}

export function buildDefaultFlyerSettings(
  property: Property,
  user: User | null,
  agency?: { agencyName?: string; logoUrl?: string | null; primaryColor?: string; tagline?: string } | null,
): FlyerSettings {
  return {
    template: 'editorial',
    agencyName: agency?.agencyName?.trim() || user?.agency?.trim() || '',
    logoUrl: agency?.logoUrl?.trim() || '',
    primaryColor: agency?.primaryColor && isHexColor(agency.primaryColor) ? agency.primaryColor : FALLBACK_FLYER_COLOR,
    headline: defaultHeadline(property),
    contactName: user?.name?.trim() || '',
    contactPhone: user?.phone?.trim() || '',
    tagline: agency?.tagline?.trim() || '',
  };
}

export function mergeFlyerSettings(base: FlyerSettings, saved: unknown): FlyerSettings {
  if (!saved || typeof saved !== 'object') return base;
  const s = saved as Record<string, unknown>;
  const str = (k: keyof FlyerSettings) => (typeof s[k] === 'string' ? (s[k] as string) : base[k]);
  const template = (['editorial', 'showcase', 'minimal'] as const).find(t => t === s.template) ?? base.template;
  return {
    template,
    agencyName: str('agencyName'),
    logoUrl: str('logoUrl'),
    primaryColor: str('primaryColor'),
    headline: str('headline'),
    contactName: str('contactName'),
    contactPhone: str('contactPhone'),
    tagline: str('tagline'),
  };
}

export function flyerPrice(p: Property): string {
  const value = p.type !== 'rent' && p.salePrice && p.status === 'sold' ? p.salePrice : p.price;
  if (!Number.isFinite(value) || value <= 0 || !p.currency) return '';
  const amt = value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value.toLocaleString('en-US');
  return `${p.currency} ${amt}${p.listingType === 'rent' || p.type === 'rent' ? '/mo' : ''}`;
}

export function flyerLocation(p: Property): string {
  return [p.showAddress ? p.address : '', p.suburb, p.city].map(v => v?.trim()).filter(Boolean).join(', ');
}

export function flyerStats(p: Property): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = [];
  const add = (v: number | undefined, label: string) => {
    if (v !== undefined && Number.isFinite(v) && v > 0) out.push({ value: String(v), label });
  };
  add(p.bedrooms, 'Beds');
  add(p.bathrooms, 'Baths');
  add(p.garages, 'Garages');
  add(p.floorArea, 'm2 floor');
  add(p.landSize, 'm2 land');
  return out;
}

export function flyerFeatures(p: Property, max = 8): string[] {
  return (p.features ?? []).map(f => f.trim()).filter(Boolean).slice(0, max);
}

export function flyerSummary(p: Property, max = 220): string {
  const d = (p.description ?? '').replace(/\s+/g, ' ').trim();
  return d.length > max ? `${d.slice(0, max - 1).trim()}...` : d;
}
