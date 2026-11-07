import type { Property, User } from '@/types';
import { resolveAgencyBrandColors } from '@/utils/propertyFlyer';

type AgencyBranding = {
  agencyName?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  tagline?: string | null;
  aboutText?: string | null;
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
  if (property.priceOnApplication) return 'POA';
  const amount = property.price >= 1_000_000
    ? `${(property.price / 1_000_000).toFixed(2)}M`
    : property.price.toLocaleString();
  return `${escapeHtml(property.currency)} ${amount}${isRental(property) ? '/mo' : ''}`;
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
  agencyWebsite: string,
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
    property.bedrooms != null ? `<div class="property-spec">${icon('bedroom')}<strong>${property.bedrooms}</strong><span>Bedrooms</span></div>` : '',
    property.bathrooms != null ? `<div class="property-spec">${icon('bathroom')}<strong>${property.bathrooms}</strong><span>Bathrooms</span></div>` : '',
    property.garages != null ? `<div class="property-spec">${icon('parking')}<strong>${property.garages}</strong><span>Garages / parking</span></div>` : '',
    property.landSize != null ? `<div class="property-spec">${icon('land')}<strong>${Number(property.landSize).toLocaleString()} m²</strong><span>Land area</span></div>` : '',
    `<div class="property-spec">${icon('home')}<strong>${formatPropertyType(property)}</strong><span>Property type</span></div>`,
  ].join('');

  const features = property.features.length
    ? `<section class="features">
        <h2>Property features</h2>
        <div class="feature-grid">${property.features.slice(0, 8).map((feature) =>
          `<div class="feature">${escapeHtml(feature)}</div>`).join('')}
        </div>
      </section>`
    : '';

  const contact = agent
    ? `<section class="contact">
        <span class="contact-label">Handling agent</span>
        ${agent.name ? `<span class="contact-item"><strong>${escapeHtml(agent.name)}</strong></span>` : ''}
        ${agent.email ? `<span class="contact-item">${escapeHtml(agent.email)}</span>` : ''}
        ${agent.phone ? `<span class="contact-item">${escapeHtml(agent.phone)}</span>` : ''}
        ${agencyWebsite ? `<span class="contact-item">${escapeHtml(agencyWebsite.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</span>` : ''}
      </section>`
    : '';

  const brand = agencyLogo
    ? `<img class="agency-logo" src="${escapeHtml(agencyLogo)}" alt="${escapeHtml(agencyName)} logo"/>`
    : '';

  const statusClass = property.status === 'pending' ? 'status-under-offer'
    : property.status === 'sold' ? 'status-sold' : '';
  const statusLabel = status.label;
  const listingKind = isRental(property) ? 'To rent' : 'For sale';
  const typeLabel = formatPropertyType(property);

  return `<section class="brochure-page property-page${pageIndex === pageCount ? ' last-page' : ''}">
    <header class="property-page-header">
      <div class="property-brand">
        ${brand}
        <div class="brand-copy">
          <strong class="property-brand-name">${escapeHtml(agencyName)}</strong>
          ${tagline ? `<span class="property-brand-tagline">${escapeHtml(tagline)}</span>` : ''}
        </div>
      </div>
      <div class="property-page-meta">
        <p class="property-kicker">${listingKind} · ${typeLabel}</p>
        <span class="property-status ${statusClass}">${statusLabel}</span>
        <span class="property-reference">Ref ${escapeHtml(property.referenceNumber)}</span>
      </div>
    </header>

    <div class="property-gallery">
      ${photoSlot(photos[0], `${title} main photo`, 'property-hero')}
      <div class="property-side-photos">
        ${[1, 2, 3].map((index) => photoSlot(photos[index], `${title} supporting photo ${index}`, 'property-side-photo')).join('')}
      </div>
    </div>

    <div class="property-copy">
      <div class="property-heading-row">
        <div>
          <h1 class="property-title">${escapeHtml(title)}</h1>
          <div class="property-location">${icon('map')}<span>${location || escapeHtml(property.suburb)}</span></div>
        </div>
        <span class="property-price">${formatPrice(property)}</span>
      </div>

      <div class="property-specs">${specs}</div>

      <div class="property-detail-grid${property.description && property.features.length > 0 ? '' : ' property-detail-grid-single'}">
        <div>
          ${property.description ? `<p class="property-description">${escapeHtml(property.description)}</p>` : ''}
        </div>
        ${features}
      </div>
      ${contact}
    </div>

    ${pageFooter(agencyName, agencyLogo, pageIndex, pageCount)}
  </section>`;
}

function pageFooter(agencyName: string, agencyLogo: string, pageNumber: number, pageCount: number): string {
  return `<footer class="page-footer">
    <div class="page-footer-meta">
      <strong>Powered by <a href="https://quickprop.co.zw">quickprop.co.zw</a></strong>
      <span>${String(pageNumber).padStart(2, '0')} / ${String(pageCount).padStart(2, '0')}</span>
    </div>
    <div class="page-footer-logo" aria-label="${escapeHtml(agencyName)} logo">
      ${agencyLogo
        ? `<img src="${escapeHtml(agencyLogo)}" alt="${escapeHtml(agencyName)} logo"/>`
        : `<span>${escapeHtml(agencyName)}</span>`}
    </div>
  </footer>`;
}

function coverPage(
  agencyName: string,
  agencyLogo: string,
  tagline: string,
  aboutText: string,
  titleLine: string,
  properties: Property[],
  pageCount: number,
): string {
  const saleCount = properties.filter((property) => !isRental(property)).length;
  const rentalCount = properties.length - saleCount;
  return `<section class="brochure-page cover-page">
    <div>
      <div class="cover-logo">
        ${agencyLogo ? `<img src="${escapeHtml(agencyLogo)}" alt="${escapeHtml(agencyName)} logo"/>` : ''}
        <div class="cover-brand-copy">
          <span class="cover-brand-name">${escapeHtml(agencyName)}</span>
          ${tagline ? `<span class="cover-brand-tagline">${escapeHtml(tagline)}</span>` : ''}
        </div>
      </div>
      <div class="cover-main">
        <h1 class="cover-title">${escapeHtml(titleLine)}</h1>
        <div class="cover-rule"></div>
        <div class="cover-stats">
          <div class="cover-stat"><strong>${properties.length}</strong><span>Published listings</span></div>
          <div class="cover-stat"><strong>${saleCount}</strong><span>For sale</span></div>
          <div class="cover-stat"><strong>${rentalCount}</strong><span>To rent</span></div>
        </div>
        <div class="cover-about">
          <h2>About us</h2>
          <p>${escapeHtml(aboutText || 'Add your agency story in Agency Settings to complete this section.')}</p>
        </div>
      </div>
    </div>
    ${pageFooter(agencyName, agencyLogo, 1, pageCount)}
  </section>`;
}

function emptyBrochurePage(agencyName: string, agencyLogo: string, pageCount: number): string {
  return `<section class="brochure-page property-page last-page">
    <div class="empty">No published listings are available for this brochure.</div>
    ${pageFooter(agencyName, agencyLogo, 2, pageCount)}
  </section>`;
}

function renderBrochure(
  properties: Property[],
  fallbackAgent: BrochureAgent | null,
  agents: BrochureAgent[],
  agency?: AgencyBranding | null,
  options: { includeCover?: boolean; mode?: 'my' | 'company' | 'custom' } = {},
): string {
  const colors = resolveAgencyBrandColors(agency);
  const agencyName = agency?.agencyName?.trim() || 'Agency';
  const agencyLogo = agency?.logoUrl?.trim() ?? '';
  const tagline = agency?.tagline?.trim()
    || (agencyName === 'DBT Properties' ? 'Property is what we know best!' : '');
  const titleLine = options.mode === 'my'
    ? `${fallbackAgent?.name || 'Agent'}'s Property Brochure`
    : options.mode === 'custom'
      ? `${[...new Set(properties.map((property) =>
        agents.find((candidate) => String(candidate.id) === String(property.agentId))?.name,
      ).filter((name): name is string => Boolean(name)))].join(', ') || agencyName} — Property Brochure`
      : `${agencyName} Brochure`;
  const pageCount = options.includeCover
    ? properties.length > 0 ? properties.length + 1 : 2
    : properties.length || 1;
  const pages = `${options.includeCover
    ? coverPage(
      agencyName,
      agencyLogo,
      tagline,
      agency?.aboutText?.trim() ?? '',
      titleLine,
      properties,
      pageCount,
    )
    : ''}${properties.length
    ? properties.map((property, index) => propertyPage(
      property,
      agents,
      fallbackAgent,
      agencyName,
      agencyLogo,
      tagline,
      agency?.website?.trim() ?? '',
      colors.primaryColor,
      index + (options.includeCover ? 2 : 1),
      pageCount,
    )).join('')
    : options.includeCover
      ? emptyBrochurePage(agencyName, agencyLogo, pageCount)
      : `<section class="brochure-page last-page"><div class="empty">No published listings are available for this brochure.</div>${pageFooter(agencyName, agencyLogo, 1, pageCount)}</section>`}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; color: #102a2a; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .brochure-page { position: relative; width: 210mm; height: 297mm; margin: 0; padding: 16mm 15mm 25mm; overflow: hidden; background: #fff; break-inside: avoid; page-break-inside: avoid; break-after: page; page-break-after: always; }
    .brochure-page.last-page { break-after: auto; page-break-after: auto; }
    .cover-page { display: flex; flex-direction: column; justify-content: space-between; padding-top: 7.5mm; }
    .cover-logo { display: flex; min-height: 31.5mm; align-items: center; gap: 16px; }
    .cover-logo img { display: block; max-width: 48mm; max-height: 25mm; object-fit: contain; object-position: left center; }
    .cover-brand-copy, .property-brand-copy { display: flex; flex-direction: column; gap: 3px; }
    .cover-brand-name, .property-brand-name { color: #102a2a; font-size: 22px; font-weight: 800; letter-spacing: -.04em; line-height: 1.1; }
    .cover-brand-tagline, .property-brand-tagline { color: #71827f; font-size: 10px; line-height: 1.35; }
    .cover-main { max-width: 690px; padding-top: 10mm; }
    .cover-title { max-width: 170mm; margin: 12px 0 0; color: #102a2a; font-size: 54px; font-weight: 800; letter-spacing: -.07em; line-height: .96; }
    .cover-rule { width: 68px; height: 4px; margin-top: 26px; background: ${colors.secondaryColor}; border-radius: 999px; }
    .cover-stats { display: grid; grid-template-columns: repeat(3, 1fr); max-width: 135mm; margin-top: 34px; border-top: 1px solid #dce8e4; border-bottom: 1px solid #dce8e4; }
    .cover-stat { padding: 13px 18px 13px 0; }
    .cover-stat + .cover-stat { padding-left: 18px; border-left: 1px solid #dce8e4; }
    .cover-stat strong { display: block; color: #102a2a; font-size: 22px; font-weight: 800; letter-spacing: -.05em; }
    .cover-stat span { display: block; margin-top: 3px; color: #71827f; font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .cover-about { max-width: 155mm; margin-top: 22mm; padding-top: 14px; border-top: 1px solid #dce8e4; }
    .cover-about h2 { margin: 0; color: ${colors.primaryColor}; font-size: 15px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .cover-about p { max-width: 145mm; margin: 8px 0 0; color: #35504e; font-size: 18px; line-height: 1.55; white-space: pre-line; }
    .property-page { display: flex; flex-direction: column; }
    .property-page-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 13px; }
    .property-brand { display: flex; min-width: 0; align-items: center; gap: 9px; }
    .property-brand img { display: block; width: 19mm; height: 15mm; object-fit: contain; object-position: left center; }
    .property-brand-name { font-size: 14px; }
    .property-brand-tagline { font-size: 8px; }
    .property-page-meta { flex: 0 0 auto; text-align: right; }
    .property-kicker { margin: 0 0 4px; color: #71827f; font-size: 10px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .property-status { display: inline-block; margin: 0 0 3px 8px; padding: 3px 6px; color: ${colors.primaryColor}; border: 1px solid ${colors.secondaryColor}; border-radius: 3px; font-size: 7px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .status-under-offer { color: #b7791f; border-color: #e7c47f; }
    .status-sold { color: #b64444; border-color: #e5aaaa; }
    .property-reference { display: block; color: #71827f; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
    .property-gallery { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(35mm, .82fr); gap: 5mm; height: 94mm; flex: 0 0 auto; }
    .property-hero, .property-side-photo { position: relative; min-width: 0; min-height: 0; overflow: hidden; background: #e7efeb; }
    .property-hero img, .property-side-photo img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .property-side-photos { display: grid; grid-template-rows: repeat(3, minmax(0, 1fr)); gap: 3mm; min-height: 0; }
    .photo-placeholder { display: flex; width: 100%; height: 100%; flex-direction: column; align-items: center; justify-content: center; gap: 2mm; color: #879691; background: #f5f8f7; font-size: 8px; }
    .photo-placeholder svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .property-copy { min-height: 0; }
    .property-heading-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-top: 7mm; }
    .property-title { margin: 0; color: #102a2a; font-size: 27px; font-weight: 800; letter-spacing: -.06em; line-height: 1.02; }
    .property-location { display: flex; align-items: flex-start; gap: 6px; margin-top: 7px; color: #71827f; font-size: 11px; line-height: 1.4; }
    .property-location svg { width: 14px; height: 14px; flex: 0 0 auto; margin-top: 1px; fill: none; stroke: ${colors.primaryColor}; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .property-price { display: inline-block; flex: 0 0 auto; margin: 0 0 2px; padding: 11px 14px; color: #fff; background: ${colors.primaryColor}; font-size: 20px; font-weight: 800; letter-spacing: -.05em; line-height: 1.1; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .property-specs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 6mm; padding: 12px 0; border-top: 1px solid #dce8e4; border-bottom: 1px solid #dce8e4; }
    .property-spec { display: flex; min-width: 0; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
    .property-spec svg { width: 18px; height: 18px; fill: none; stroke: ${colors.primaryColor}; stroke-width: 1.65; stroke-linecap: round; stroke-linejoin: round; }
    .property-spec strong { color: #102a2a; font-size: 15px; font-weight: 800; line-height: 1; }
    .property-spec span { color: #71827f; font-size: 8px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .property-detail-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr); gap: 8mm; margin-top: 6mm; }
    .property-detail-grid-single { grid-template-columns: 1fr; }
    .property-description { margin: 12px 0 0; color: #35504e; font-size: 11px; line-height: 1.6; }
    .features h2 { margin: 0 0 8px; color: ${colors.primaryColor}; font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
    .feature-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px 12px; }
    .feature { color: #35504e; font-size: 9px; line-height: 1.35; }
    .feature::before { content: "• "; }
    .contact { display: flex; flex-wrap: wrap; gap: 7px 18px; margin-top: 6mm; padding: 12px 14px; color: #35504e; background: #fff; border: 1px solid #dce8e4; font-size: 9px; }
    .contact-label { width: 100%; color: ${colors.primaryColor}; font-size: 9px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    .contact-item { display: inline-flex; align-items: center; gap: 5px; }
    .empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #71827f; font-size: 15px; }
    .page-footer { position: absolute; right: 15mm; bottom: 9mm; left: 15mm; display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; padding-top: 9px; color: #71827f; border-top: 1px solid #dce8e4; font-size: 8px; }
    .page-footer-meta { display: flex; flex-direction: column; gap: 3px; font-size: 8px; line-height: 1.2; }
    .page-footer-meta strong { color: #35504e; font-size: 9px; }
    .page-footer-meta a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
    .page-footer-logo { display: flex; width: 42mm; min-height: 12mm; align-items: center; justify-content: flex-end; }
    .page-footer-logo img { display: block; max-width: 42mm; max-height: 13mm; object-fit: contain; object-position: right bottom; }
    .page-footer-logo span { color: #102a2a; font-size: 11px; font-weight: 800; letter-spacing: -.04em; }
    @media print {
      html, body { width: 210mm; margin: 0; background: #fff; }
      .brochure-page { margin: 0; }
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
  agents: BrochureAgent[] = [],
): string {
  const fallbackAgent = agent ? {
    id: agent.id,
    name: agent.name,
    email: agent.email,
    phone: agent.phone,
  } : null;
  const contacts = fallbackAgent ? [...agents, fallbackAgent] : agents;
  return renderBrochure([property], fallbackAgent, contacts, agency);
}

export function catalogueBrochureHtml(
  properties: Property[],
  agent: User | null,
  mode: 'my' | 'company' | 'custom',
  agents: BrochureAgent[] = [],
  agency?: AgencyBranding | null,
): string {
  const fallbackAgent = agent ? {
    id: agent.id,
    name: agent.name,
    email: agent.email,
    phone: agent.phone,
  } : null;
  return renderBrochure(properties, fallbackAgent, agents, agency, { includeCover: true, mode });
}
