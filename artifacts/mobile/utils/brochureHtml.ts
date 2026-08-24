import { Property, User } from '@/types';
import { catalogueShareLinks, propertyShareLinks } from '@/utils/shareLinks';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtPrice(p: Property): string {
  const val =
    p.price >= 1_000_000
      ? `${p.currency} ${(p.price / 1_000_000).toFixed(2)}M`
      : `${p.currency} ${p.price.toLocaleString()}`;
  return p.type === 'rent' ? `${val}/mo` : val;
}

function fmtDate(): string {
  return new Date().toLocaleDateString('en-ZW', { day: 'numeric', month: 'long', year: 'numeric' });
}

function statusLabel(p: Property): { text: string; color: string } {
  if (p.status === 'sold') return { text: 'Sold', color: '#dc2626' };
  if (p.status === 'rented') return { text: 'Rented', color: '#7c3aed' };
  if (p.type === 'rent') return { text: 'To Rent', color: '#2563eb' };
  return { text: 'For Sale', color: '#059669' };
}

const LOGO_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22" stroke="white" stroke-width="2"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>`;

const BASE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: #f3f4f6; color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print {
    body { background: white; }
    @page { size: A4; margin: 0; }
  }
`;

// ─── Single Property Brochure ────────────────────────────────────────────────

export function singlePropertyBrochureHtml(property: Property, agent: User | null): string {
  const st = statusLabel(property);
  const price = fmtPrice(property);
  const coverImg = property.photos?.[0];
  const propertyLinks = propertyShareLinks(property);

  const specsHtml = [
    property.bedrooms != null ? `<div class="spec"><span class="spec-val">${property.bedrooms}</span><span class="spec-lbl">Bedrooms</span></div>` : '',
    property.bathrooms != null ? `<div class="spec"><span class="spec-val">${property.bathrooms}</span><span class="spec-lbl">Bathrooms</span></div>` : '',
    property.garages != null ? `<div class="spec"><span class="spec-val">${property.garages}</span><span class="spec-lbl">Garages</span></div>` : '',
    property.landSize != null ? `<div class="spec"><span class="spec-val">${property.landSize} m²</span><span class="spec-lbl">Stand Size</span></div>` : '',
    property.floorArea != null ? `<div class="spec"><span class="spec-val">${property.floorArea} m²</span><span class="spec-lbl">Floor Area</span></div>` : '',
  ].filter(Boolean).join('');

  const featuresHtml = property.features.length > 0
    ? `<div class="section">
        <div class="section-title">Features &amp; Amenities</div>
        <div class="features-grid">
          ${property.features.map(f => `<div class="feature-item"><span class="feature-dot"></span>${f}</div>`).join('')}
        </div>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
${BASE_STYLES}
.page { background: white; max-width: 210mm; min-height: 297mm; margin: 0 auto; box-shadow: 0 4px 24px rgba(0,0,0,.12); }
.header { display: flex; align-items: center; justify-content: space-between; padding: 20px 36px; border-bottom: 4px solid #059669; }
.brand { display: flex; align-items: center; gap: 12px; }
.brand-icon { width: 40px; height: 40px; border-radius: 10px; background: #059669; display: flex; align-items: center; justify-content: center; }
.brand-name { font-size: 18px; font-weight: 700; color: #111827; }
.brand-sub { font-size: 11px; color: #6b7280; }
.header-right { text-align: right; }
.header-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #9ca3af; font-weight: 600; }
.header-ref { font-size: 11px; color: #6b7280; margin-top: 2px; }

.hero { position: relative; height: 220px; background: #e5e7eb; overflow: hidden; }
.hero img { width: 100%; height: 100%; object-fit: cover; }
.hero-placeholder { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #9ca3af; font-size: 13px; gap: 8px; }
.hero-overlay { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,.75), transparent); padding: 32px 36px 20px; }
.hero-price { font-size: 28px; font-weight: 700; color: white; letter-spacing: -0.5px; }
.hero-address { font-size: 13px; color: rgba(255,255,255,.8); margin-top: 4px; }
.hero-badge { position: absolute; top: 16px; right: 16px; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: white; }

.prop-title { padding: 20px 36px 16px; border-bottom: 1px solid #f3f4f6; }
.prop-title h1 { font-size: 22px; font-weight: 700; color: #111827; }

.specs-bar { display: flex; gap: 28px; flex-wrap: wrap; padding: 16px 36px; background: #f9fafb; border-bottom: 1px solid #f3f4f6; }
.spec { display: flex; flex-direction: column; gap: 2px; }
.spec-val { font-size: 17px; font-weight: 700; color: #111827; }
.spec-lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; font-weight: 600; }

.body { display: flex; gap: 28px; padding: 24px 36px; }
.body-main { flex: 1; min-width: 0; }
.body-side { width: 180px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; }

.section { margin-bottom: 20px; }
.section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #059669; margin-bottom: 10px; }
.description { font-size: 12px; color: #374151; line-height: 1.7; white-space: pre-wrap; }

.features-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
.feature-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #374151; }
.feature-dot { width: 6px; height: 6px; border-radius: 50%; background: #059669; flex-shrink: 0; }

.card { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
.card-head { padding: 10px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
.card-head-green { background: #059669; color: white; }
.card-head-gray { background: #f9fafb; color: #374151; border-bottom: 1px solid #e5e7eb; }
.card-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.agent-name { font-size: 13px; font-weight: 600; color: #111827; }
.contact-row { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #4b5563; }
.info-row { display: flex; justify-content: space-between; font-size: 11px; }
.info-label { color: #6b7280; }
.info-val { font-weight: 600; color: #111827; text-align: right; }

.cta-card { border: 1px solid #a7f3d0; border-radius: 10px; background: #f0fdf4; padding: 14px; text-align: center; }
.cta-label { font-size: 11px; font-weight: 600; color: #065f46; margin-bottom: 4px; }
.cta-url { font-size: 10px; color: #059669; word-break: break-all; }

.footer { margin-top: auto; padding: 14px 36px; background: #111827; display: flex; align-items: center; justify-content: space-between; }
.footer-left { font-size: 12px; font-weight: 600; color: white; }
.footer-right { font-size: 10px; color: #6b7280; }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="brand">
      <div class="brand-icon">${LOGO_SVG}</div>
      <div>
        <div class="brand-name">QuickProp</div>
        <div class="brand-sub">Zimbabwe's Property Marketplace</div>
      </div>
    </div>
    <div class="header-right">
      <div class="header-label">Property Brochure</div>
      <div class="header-ref">Ref: ${property.referenceNumber}</div>
    </div>
  </div>

  <!-- Hero -->
  <div class="hero">
    ${coverImg
      ? `<img src="${coverImg}" alt="${property.address}" />`
      : `<div class="hero-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg><span>No photo available</span></div>`
    }
    <div class="hero-overlay">
      <div class="hero-price">${price}</div>
      <div class="hero-address">${property.address}, ${property.suburb}</div>
    </div>
    <div class="hero-badge" style="background:${st.color}">${st.text}</div>
  </div>

  <!-- Title -->
  <div class="prop-title">
    <h1>${property.address}, ${property.suburb}</h1>
  </div>

  <!-- Specs -->
  ${specsHtml ? `<div class="specs-bar">${specsHtml}</div>` : ''}

  <!-- Body -->
  <div class="body">
    <div class="body-main">
      <div class="section">
        <div class="section-title">Description</div>
        <div class="description">${property.description || 'Contact us for full property details.'}</div>
      </div>
      ${featuresHtml}
    </div>
    <div class="body-side">
      <!-- Agent card -->
      <div class="card">
        <div class="card-head card-head-green">Your Agent</div>
        <div class="card-body">
          <div class="agent-name">${agent?.name ?? 'QuickProp Agent'}</div>
          ${agent?.email ? `<div class="contact-row">${agent.email}</div>` : ''}
          <div class="contact-row">${agent?.phone ?? '+263 77 000 0000'}</div>
          ${agent?.agency ? `<div class="contact-row">${agent.agency}</div>` : ''}
        </div>
      </div>
      <!-- Property info card -->
      <div class="card">
        <div class="card-head card-head-gray">Property Info</div>
        <div class="card-body">
          <div class="info-row"><span class="info-label">Reference</span><span class="info-val">${property.referenceNumber}</span></div>
          <div class="info-row"><span class="info-label">Type</span><span class="info-val" style="text-transform:capitalize">${property.type}</span></div>
          <div class="info-row"><span class="info-label">Suburb</span><span class="info-val">${property.suburb}</span></div>
          ${property.landSize != null ? `<div class="info-row"><span class="info-label">Stand</span><span class="info-val">${property.landSize} m²</span></div>` : ''}
          ${property.floorArea != null ? `<div class="info-row"><span class="info-label">Floor</span><span class="info-val">${property.floorArea} m²</span></div>` : ''}
        </div>
      </div>
      <div class="cta-card">
        <div class="cta-label">View online</div>
        <div class="cta-url">${propertyLinks.webUrl}</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">QuickProp — Zimbabwe's Property Marketplace</div>
    <div class="footer-right">${propertyLinks.webUrl} · Ref: ${property.referenceNumber}</div>
  </div>
</div>
</body>
</html>`;
}

// ─── Catalogue ───────────────────────────────────────────────────────────────

function propertyCardHtml(p: Property): string {
  const st = statusLabel(p);
  const price = fmtPrice(p);
  const coverImg = p.photos?.[0];

  const specs = [
    p.bedrooms != null ? `${p.bedrooms} bed` : '',
    p.bathrooms != null ? `${p.bathrooms} bath` : '',
    p.garages != null ? `${p.garages} gar` : '',
    p.landSize != null ? `${p.landSize} m²` : '',
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');

  return `<div class="prop-card">
    <div class="prop-thumb">
      ${coverImg
        ? `<img src="${coverImg}" alt="${p.address}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0"/>`
        : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#d1d5db"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/></svg></div>`
      }
      <div class="prop-badge" style="background:${st.color}">${st.text}</div>
    </div>
    <div class="prop-info">
      <div class="prop-header">
        <div class="prop-addr">${p.address}, ${p.suburb}</div>
        <div class="prop-price">${price}</div>
      </div>
      ${specs ? `<div class="prop-specs">${specs}</div>` : ''}
      ${p.description ? `<div class="prop-desc">${p.description.slice(0, 160)}${p.description.length > 160 ? '…' : ''}</div>` : ''}
      <div class="prop-ref">${p.referenceNumber}</div>
    </div>
  </div>`;
}

export function catalogueBrochureHtml(
  properties: Property[],
  agent: User | null,
  mode: 'my' | 'company',
): string {
  const titleLine = mode === 'my'
    ? `${agent?.name ?? 'Agent'}'s Property Catalogue`
    : `${agent?.agency ?? 'Company'} Property Catalogue`;
  const catalogueUrl = catalogueShareLinks(mode === 'my' ? agent?.id : undefined).webUrl;

  const forSale = properties.filter(p => p.type !== 'rent');
  const forRent = properties.filter(p => p.type === 'rent');

  const sectionHtml = (title: string, color: string, props: Property[]) =>
    props.length === 0 ? '' : `
    <div class="section-header">
      <div class="section-bar" style="background:${color}"></div>
      <span class="section-title">${title}</span>
      <span class="section-count">${props.length} ${props.length === 1 ? 'property' : 'properties'}</span>
    </div>
    <div class="props-list">
      ${props.map(propertyCardHtml).join('')}
    </div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
${BASE_STYLES}
.page { background: white; max-width: 210mm; margin: 0 auto; padding-bottom: 40px; box-shadow: 0 4px 24px rgba(0,0,0,.12); }

.cover { padding: 32px 36px 28px; border-bottom: 4px solid #059669; }
.cover-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.brand { display: flex; align-items: center; gap: 12px; }
.brand-icon { width: 44px; height: 44px; border-radius: 12px; background: #059669; display: flex; align-items: center; justify-content: center; }
.brand-name { font-size: 20px; font-weight: 700; color: #111827; }
.brand-sub { font-size: 11px; color: #6b7280; }
.cover-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #9ca3af; font-weight: 600; text-align: right; }
.cover-date { font-size: 11px; color: #6b7280; margin-top: 2px; text-align: right; }
.cover-title { font-size: 28px; font-weight: 700; color: #111827; line-height: 1.2; }
.cover-sub { font-size: 13px; color: #6b7280; margin-top: 6px; }

.body { padding: 28px 36px 0; }

.section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; margin-top: 28px; }
.section-bar { width: 4px; height: 22px; border-radius: 2px; }
.section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #111827; }
.section-count { font-size: 12px; color: #9ca3af; margin-left: 4px; }

.props-list { display: flex; flex-direction: column; gap: 12px; }
.prop-card { display: flex; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; page-break-inside: avoid; }
.prop-thumb { width: 148px; flex-shrink: 0; background: #f3f4f6; position: relative; min-height: 110px; }
.prop-badge { position: absolute; top: 8px; left: 8px; padding: 3px 8px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: white; }
.prop-info { flex: 1; padding: 14px 16px; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.prop-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.prop-addr { font-size: 13px; font-weight: 600; color: #111827; line-height: 1.3; }
.prop-price { font-size: 15px; font-weight: 700; color: #059669; white-space: nowrap; flex-shrink: 0; }
.prop-specs { font-size: 11px; color: #6b7280; }
.prop-desc { font-size: 11px; color: #4b5563; line-height: 1.55; }
.prop-ref { font-size: 10px; color: #9ca3af; font-weight: 600; font-family: monospace; margin-top: 2px; }

.footer { margin: 28px 36px 0; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }

.empty { padding: 40px 36px; text-align: center; color: #9ca3af; font-size: 14px; }
</style>
</head>
<body>
<div class="page">
  <!-- Cover -->
  <div class="cover">
    <div class="cover-top">
      <div class="brand">
        <div class="brand-icon">${LOGO_SVG}</div>
        <div>
          <div class="brand-name">QuickProp</div>
          <div class="brand-sub">Zimbabwe's Property Marketplace</div>
        </div>
      </div>
      <div>
        <div class="cover-label">Property Catalogue</div>
        <div class="cover-date">${fmtDate()}</div>
      </div>
    </div>
    <div class="cover-title">${titleLine}</div>
    <div class="cover-sub">
      ${forSale.length > 0 ? `${forSale.length} for sale` : ''}${forSale.length > 0 && forRent.length > 0 ? ' · ' : ''}${forRent.length > 0 ? `${forRent.length} to rent` : ''}${properties.length === 0 ? 'No published listings' : ''}
    </div>
  </div>

  <!-- Property sections -->
  <div class="body">
    ${properties.length === 0
      ? `<div class="empty">No published listings to show in this catalogue.</div>`
      : sectionHtml('For Sale', '#059669', forSale) + sectionHtml('To Rent', '#2563eb', forRent)
    }
  </div>

  <!-- Footer -->
  <div class="footer">
     <span>QuickProp · Zimbabwe's Property Marketplace · ${catalogueUrl}</span>
    <span>Generated ${fmtDate()}</span>
  </div>
</div>
</body>
</html>`;
}
