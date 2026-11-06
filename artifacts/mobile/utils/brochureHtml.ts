import type { Property, User } from '@/types';
import { resolveAgencyBrandColors } from '@/utils/propertyFlyer';

type AgencyBranding = {
  agencyName?: string | null;
  logoUrl?: string | null;
  tagline?: string | null;
  primaryColor?: string | null;
  logoColors?: string[] | null;
};

export type BrochureAgent = {
  id: string | number;
  name: string;
  email?: string | null;
  phone?: string | null;
};

const ICONS = {
  bedroom: '<path d="M3 20v-8h18v8M3 16h18M5 12V7a2 2 0 0 1 2-2h4v7M11 8h7a3 3 0 0 1 3 3v1"/>',
  bathroom: '<path d="M9 6 7.5 4.5a2.1 2.1 0 0 0-3 3L6 9M3 12h18v2a7 7 0 0 1-7 7h-4a7 7 0 0 1-7-7v-2ZM7 21v-1M17 21v-1"/>',
  parking: '<path d="M5 17h14l-1.5-6h-11L5 17ZM4 17v2h2v-2m12 0v2h2v-2M7 11l1-4h8l1 4M7 14h.01M17 14h.01"/>',
  land: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  map: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1V10Z"/>',
};

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function isRental(property: Property): boolean {
  return property.listingType === 'rent' || property.type === 'rent';
}

function formatPrice(property: Property): string {
  const amount = property.price >= 1_000_000
    ? `${(property.price / 1_000_000).toFixed(2)}M`
    : property.price.toLocaleString();
  return `${escapeHtml(property.currency)} ${amount}${isRental(property) ? '/month' : ''}`;
}

function formatPropertyType(property: Property): string {
  return escapeHtml((property.propertyType ?? property.type).replace(/_/g, ' '));
}

function getPropertyPhotos(property: Property): string[] {
  return [...new Set((property.photos ?? [])
    .filter((photo) => typeof photo === 'string' && photo.trim().length > 0)
    .map((photo) => photo.trim()))].slice(0, 4);
}

function icon(name: keyof typeof ICONS): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
}

function photoSlot(uri: string | undefined, label: string, className: string): string {
  return `<div class="${className}">
    ${uri
      ? `<img src="${escapeHtml(uri)}" alt="${escapeHtml(label)}"/>`
      : `<div class="photo-placeholder">${icon('home')}<span>Photo not available</span></div>`}
  </div>`;
}

function propertyStatus(property: Property, accent: string): { label: string; color: string } {
  if (property.status === 'sold') return { label: 'Sold', color: '#B64444' };
  if (property.status === 'rented') return { label: 'Rented', color: '#7C3AED' };
  if (property.status === 'pending') return { label: 'Under Offer', color: '#B7791F' };
  return { label: isRental(property) ? 'To Rent' : 'For Sale', color: accent };
}

function propertyPage(
  property: Property,
  agents: BrochureAgent[],
  fallbackAgent: BrochureAgent | null,
  agencyName: string,
  agencyLogo: string,
  tagline: string,
  accent: string,
  pageIndex: number,
  pageCount: number,
): string {
  const photos = getPropertyPhotos(property);
  const title = property.title?.trim() || [property.address, property.suburb].filter(Boolean).join(', ') || 'Property listing';
  const address = property.showAddress === false ? '' : property.address?.trim() ?? '';
  const location = [address, property.suburb, property.city].filter(Boolean).map(escapeHtml).join(', ');
  const status = propertyStatus(property, accent);
  const agent = agents.find((candidate) => String(candidate.id) === String(property.agentId))
    ?? (fallbackAgent && String(fallbackAgent.id) === String(property.agentId) ? fallbackAgent : null);

  const specs = [
    property.bedrooms != null ? `<div class="spec">${icon('bedroom')}<strong>${property.bedrooms}</strong><span>Bedrooms</span></div>` : '',
    property.bathrooms != null ? `<div class="spec">${icon('bathroom')}<strong>${property.bathrooms}</strong><span>Bathrooms</span></div>` : '',
    property.garages != null ? `<div class="spec">${icon('parking')}<strong>${property.garages}</strong><span>Garages</span></div>` : '',
    property.landSize != null ? `<div class="spec">${icon('land')}<strong>${Number(property.landSize).toLocaleString()} m²</strong><span>Land area</span></div>` : '',
    property.floorArea != null ? `<div class="spec">${icon('home')}<strong>${Number(property.floorArea).toLocaleString()} m²</strong><span>Floor area</span></div>` : '',
  ].filter(Boolean).join('');

  const features = property.features.length
    ? `<section class="features">
        <h2>Property features</h2>
        <div class="feature-grid">${property.features.map((feature) =>
          `<div class="feature"><span></span>${escapeHtml(feature)}</div>`).join('')}
        </div>
      </section>`
    : '';

  const contact = agent
    ? `<section class="contact">
        <h2>Handling agent</h2>
        <strong>${escapeHtml(agent.name)}</strong>
        ${agent.email ? `<span>${escapeHtml(agent.email)}</span>` : ''}
        ${agent.phone ? `<span>${escapeHtml(agent.phone)}</span>` : ''}
      </section>`
    : '';

  const brand = agencyLogo
    ? `<img class="agency-logo" src="${escapeHtml(agencyLogo)}" alt="${escapeHtml(agencyName)} logo"/>`
    : '';

  return `<section class="brochure-page${pageIndex === pageCount ? ' last-page' : ''}">
    <header class="page-header">
      <div class="brand">
        ${brand}
        <div class="brand-copy">
          <strong>${escapeHtml(agencyName)}</strong>
          ${tagline ? `<span>${escapeHtml(tagline)}</span>` : ''}
        </div>
      </div>
      <div class="page-meta">
        <span>Property listing</span>
        <strong>Ref ${escapeHtml(property.referenceNumber)}</strong>
      </div>
    </header>

    <div class="gallery">
      ${photoSlot(photos[0], `${title} main photo`, 'main-photo')}
      <div class="side-photos">
        ${[1, 2, 3].map((index) => photoSlot(photos[index], `${title} supporting photo ${index}`, 'side-photo')).join('')}
      </div>
    </div>

    <div class="property-heading">
      <div class="heading-copy">
        <h1>${escapeHtml(title)}</h1>
        <div class="location">${icon('map')}<span>${location || escapeHtml(property.suburb)}</span></div>
      </div>
      <div class="price-status">
        <strong>${formatPrice(property)}</strong>
        <span style="color:${status.color}">${status.label}</span>
      </div>
    </div>

    ${specs ? `<div class="specs">${specs}<div class="spec property-type">${icon('home')}<strong>${formatPropertyType(property)}</strong><span>Property type</span></div></div>` : `<div class="specs"><div class="spec property-type">${icon('home')}<strong>${formatPropertyType(property)}</strong><span>Property type</span></div></div>`}

    <div class="details">
      <div class="description">
        <h2>Property details</h2>
        <p>${escapeHtml(property.description || 'Contact the handling agent for further information.')}</p>
        ${features}
      </div>
      ${contact}
    </div>

    <footer class="page-footer">
      <span>Powered by quickprop.co.zw</span>
      <span>${escapeHtml(agencyName)} · ${escapeHtml(property.referenceNumber)} · ${pageIndex} / ${pageCount}</span>
    </footer>
  </section>`;
}

function renderBrochure(
  properties: Property[],
  fallbackAgent: BrochureAgent | null,
  agents: BrochureAgent[],
  agency?: AgencyBranding | null,
): string {
  const colors = resolveAgencyBrandColors(agency);
  const agencyName = agency?.agencyName?.trim() || 'Agency';
  const agencyLogo = agency?.logoUrl?.trim() ?? '';
  const tagline = agency?.tagline?.trim()
    || (agencyName === 'DBT Properties' ? 'Property is what we know best!' : '');
  const pages = properties.length
    ? properties.map((property, index) => propertyPage(
      property,
      agents,
      fallbackAgent,
      agencyName,
      agencyLogo,
      tagline,
      colors.primaryColor,
      index + 1,
      properties.length,
    )).join('')
    : `<section class="brochure-page">
        <header class="page-header">
          <div class="brand">${agencyLogo ? `<img class="agency-logo" src="${escapeHtml(agencyLogo)}" alt="${escapeHtml(agencyName)} logo"/>` : ''}<div class="brand-copy"><strong>${escapeHtml(agencyName)}</strong>${tagline ? `<span>${escapeHtml(tagline)}</span>` : ''}</div></div>
          <div class="page-meta"><span>Property brochure</span></div>
        </header>
        <div class="empty">No published listings are available for this brochure.</div>
        <footer class="page-footer"><span>Powered by quickprop.co.zw</span><span>${escapeHtml(agencyName)}</span></footer>
      </section>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; color: #102a2a; background: #eef2f1; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .brochure-page { width: 210mm; height: 297mm; margin: 0 auto 16px; padding: 11mm 13mm 9mm; display: flex; flex-direction: column; overflow: hidden; background: #fff; page-break-after: always; break-after: page; }
    .brochure-page.last-page { page-break-after: auto; break-after: auto; }
    .page-header { min-height: 25mm; display: flex; align-items: center; justify-content: space-between; gap: 10mm; padding-bottom: 5mm; border-bottom: 2px solid ${colors.primaryColor}; }
    .brand { display: flex; min-width: 0; align-items: center; gap: 4mm; }
    .agency-logo { display: block; width: 36mm; height: 22mm; object-fit: contain; object-position: left center; }
    .brand-copy { display: flex; min-width: 0; flex-direction: column; gap: 2mm; }
    .brand-copy strong { color: #102a2a; font-size: 18px; line-height: 1.08; }
    .brand-copy span { color: #687b77; font-size: 9px; line-height: 1.25; }
    .page-meta { display: flex; flex-shrink: 0; flex-direction: column; gap: 2mm; text-align: right; color: #71827f; font-size: 8px; text-transform: uppercase; letter-spacing: .12em; }
    .page-meta strong { color: #35504e; font-size: 9px; letter-spacing: .05em; }
    .gallery { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(38mm, .82fr); gap: 4mm; height: 88mm; margin-top: 6mm; flex: 0 0 auto; }
    .main-photo, .side-photo { position: relative; min-width: 0; min-height: 0; overflow: hidden; background: #e7efeb; }
    .main-photo img, .side-photo img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .side-photos { display: grid; grid-template-rows: repeat(3, minmax(0, 1fr)); gap: 3mm; min-height: 0; }
    .photo-placeholder { display: flex; width: 100%; height: 100%; flex-direction: column; align-items: center; justify-content: center; gap: 2mm; color: #879691; background: #f5f8f7; font-size: 8px; }
    .photo-placeholder svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .property-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 10mm; margin-top: 7mm; }
    .heading-copy { min-width: 0; }
    .property-heading h1 { margin: 0; color: #102a2a; font-size: 25px; font-weight: 800; line-height: 1.08; letter-spacing: -.04em; }
    .location { display: flex; align-items: flex-start; gap: 2mm; margin-top: 2.5mm; color: #71827f; font-size: 10px; line-height: 1.35; }
    .location svg { width: 14px; height: 14px; flex: 0 0 auto; fill: none; stroke: ${colors.primaryColor}; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .price-status { flex: 0 0 auto; text-align: right; }
    .price-status strong { display: block; color: ${colors.primaryColor}; font-size: 19px; font-weight: 800; white-space: nowrap; }
    .price-status span { display: block; margin-top: 2mm; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
    .specs { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 2mm; margin-top: 6mm; padding: 4mm 0; border-top: 1px solid #dce8e4; border-bottom: 1px solid #dce8e4; }
    .spec { display: flex; min-width: 0; flex-direction: column; align-items: center; gap: 1.3mm; text-align: center; }
    .spec svg { width: 18px; height: 18px; fill: none; stroke: ${colors.primaryColor}; stroke-width: 1.65; stroke-linecap: round; stroke-linejoin: round; }
    .spec strong { max-width: 100%; color: #102a2a; font-size: 12px; font-weight: 800; line-height: 1.1; overflow-wrap: anywhere; }
    .spec span { color: #71827f; font-size: 7px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
    .details { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, .85fr); gap: 7mm; margin-top: 6mm; min-height: 0; }
    .description h2, .features h2, .contact h2 { margin: 0 0 2.5mm; color: ${colors.primaryColor}; font-size: 9px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    .description p { margin: 0; color: #35504e; font-size: 9px; line-height: 1.45; white-space: pre-wrap; }
    .features { margin-top: 4mm; }
    .feature-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.6mm 3mm; }
    .feature { display: flex; align-items: flex-start; gap: 1.8mm; color: #35504e; font-size: 8px; line-height: 1.25; }
    .feature span { width: 1.5mm; height: 1.5mm; margin-top: 1mm; flex: 0 0 auto; border-radius: 50%; background: ${colors.primaryColor}; }
    .contact { align-self: start; padding: 4mm; border: 1px solid #dce8e4; background: #f7faf9; }
    .contact strong { display: block; color: #102a2a; font-size: 11px; }
    .contact span { display: block; margin-top: 1.5mm; color: #526662; font-size: 8px; overflow-wrap: anywhere; }
    .empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #71827f; font-size: 15px; }
    .page-footer { display: flex; align-items: center; justify-content: space-between; gap: 8mm; margin-top: auto; padding-top: 3mm; border-top: 1px solid #dce8e4; color: #71827f; font-size: 7px; }
    .page-footer span:first-child { color: #526662; font-weight: 700; }
    @media print {
      html, body { background: #fff; }
      .brochure-page { margin: 0; box-shadow: none; }
    }
    @media screen {
      body { padding: 14px 0; }
      .brochure-page { box-shadow: 0 12px 40px rgba(16,42,42,.12); }
    }
  </style>
</head>
<body>${pages}</body>
</html>`;
}

export function singlePropertyBrochureHtml(
  property: Property,
  agent: User | null,
  agency?: AgencyBranding | null,
): string {
  const agentContact = agent ? [{
    id: agent.id,
    name: agent.name,
    email: agent.email,
    phone: agent.phone,
  }] : [];
  return renderBrochure([property], agentContact[0] ?? null, agentContact, agency);
}

export function catalogueBrochureHtml(
  properties: Property[],
  agent: User | null,
  _mode: 'my' | 'company' | 'custom',
  agents: BrochureAgent[] = [],
  agency?: AgencyBranding | null,
): string {
  const fallbackAgent = agent ? {
    id: agent.id,
    name: agent.name,
    email: agent.email,
    phone: agent.phone,
  } : null;
  return renderBrochure(properties, fallbackAgent, agents, agency);
}
