import React from 'react';
import { useListProperties, useGetCurrentUser, useListUsers, useGetAdminAgencySettings } from '@workspace/api-client-react';
import { Bed, Bath, Car, Square, MapPin, Building2, Printer, ArrowLeft, ArrowUpRight, Tag } from 'lucide-react';

function formatPrice(price: number, currency: string, listingType: string) {
  const f = price >= 1_000_000
    ? `${currency} ${(price / 1_000_000).toFixed(2)}M`
    : `${currency} ${price.toLocaleString()}`;
  return listingType === 'rent' ? `${f}/mo` : f;
}

const STATUS_PILL: Record<string, { label: string; color: string }> = {
  public:       { label: 'For Sale',     color: '#059669' },
  under_offer:  { label: 'Under Offer',  color: '#d97706' },
  coming_soon:  { label: 'Coming Soon',  color: '#2563eb' },
  sold:         { label: 'Sold',         color: '#dc2626' },
};

const PUBLIC_SITE_URL = 'https://www.quickprop.melios.co.zw';

export default function BrochureCatalog() {
  const params = new URLSearchParams(window.location.search);
  const mode = (params.get('mode') ?? 'company') as 'my' | 'company' | 'custom';
  // custom mode now passes individual prop IDs
  const propParam = params.get('props') ?? '';
  const selectedPropIds = propParam ? new Set(propParam.split(',').map(Number)) : new Set<number>();

  React.useEffect(() => {
    const previousTitle = document.title;
    document.title = '';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const { data: currentUser } = useGetCurrentUser();
  const { data: agencySettings } = useGetAdminAgencySettings();
  const { data: allProps, isLoading } = useListProperties();
  const { data: users } = useListUsers();

  const PUBLIC_STATUSES = ['public', 'under_offer', 'coming_soon'];

  const properties = React.useMemo(() => {
    if (!allProps) return [];
    const pub = allProps.filter(p => PUBLIC_STATUSES.includes(p.status));
    if (mode === 'my') return pub.filter(p => p.agentId === currentUser?.id);
    if (mode === 'custom') return pub.filter(p => selectedPropIds.has(p.id));
    return pub; // company
  }, [allProps, mode, currentUser, propParam]);

  const agentMap = React.useMemo(() => {
    const m: Record<number, string> = {};
    (users ?? []).forEach(u => { m[u.id] = u.name ?? 'Agent'; });
    return m;
  }, [users]);

  // For custom, derive agent names from the selected properties
  const customAgentNames = React.useMemo(() => {
    if (mode !== 'custom') return [];
    const ids = new Set(properties.map(p => p.agentId).filter(Boolean));
    return [...ids].map(id => agentMap[id as number]).filter(Boolean);
  }, [mode, properties, agentMap]);

  const agencyName = agencySettings?.agencyName || 'QuickProp';
  const titleLine = mode === 'my'
    ? `${currentUser?.name ?? 'Agent'}'s Property Catalogue`
    : mode === 'custom' && customAgentNames.length > 0
      ? customAgentNames.join(', ') + ' — Property Catalogue'
      : `${agencyName} Catalogue`;

  const forSale = properties.filter(p => p.listingType === 'sale');
  const forRent = properties.filter(p => p.listingType === 'rent');
  const agencyLogo = agencySettings?.logoUrl;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <style>{`
        :root {
          --brochure-ink: #102a2a;
          --brochure-ink-soft: #35504e;
          --brochure-primary: #0f766e;
          --brochure-primary-bright: #10b981;
          --brochure-primary-soft: #dff5ed;
          --brochure-paper: #ffffff;
          --brochure-paper-warm: #f7faf8;
          --brochure-line: #dce8e4;
          --brochure-muted: #71827f;
          --brochure-amber: #b7791f;
          --brochure-red: #b64444;
        }

        .brochure-canvas {
          min-height: 100vh;
          padding: 88px 24px 48px;
          background: #e9efec;
          color: var(--brochure-ink);
        }

        .brochure-paper {
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(16, 42, 42, 0.12);
        }

        .cover-header {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          padding: 38px 40px 42px;
          background: var(--brochure-paper-warm);
          border-bottom: 1px solid var(--brochure-line);
        }

        .cover-header::before,
        .cover-header::after {
          position: absolute;
          z-index: -1;
          display: block;
          content: '';
          pointer-events: none;
          border: 1px solid rgba(16, 185, 129, 0.17);
          border-radius: 999px;
          transform: rotate(-13deg);
        }

        .cover-header::before {
          top: 68px;
          right: -130px;
          width: 460px;
          height: 210px;
          box-shadow:
            0 34px 0 rgba(16, 185, 129, 0.08),
            0 68px 0 rgba(16, 185, 129, 0.06),
            0 102px 0 rgba(16, 185, 129, 0.04);
        }

        .cover-header::after {
          bottom: -140px;
          left: -105px;
          width: 360px;
          height: 200px;
          border-color: rgba(15, 118, 110, 0.13);
          box-shadow:
            0 28px 0 rgba(15, 118, 110, 0.07),
            0 56px 0 rgba(15, 118, 110, 0.05);
        }

        .cover-topline {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
        }

        .brochure-logo {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          width: 148px;
          min-height: 38px;
        }

        .brochure-logo img {
          display: block;
          width: auto;
          max-width: 148px;
          max-height: 64px;
          object-fit: contain;
          object-position: left center;
        }

        .brochure-logo-fallback {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--brochure-ink);
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .brochure-logo-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          color: white;
          background: var(--brochure-primary);
          border-radius: 9px;
        }

        .cover-date {
          color: var(--brochure-muted);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-align: right;
          text-transform: uppercase;
        }

        .cover-copy {
          position: relative;
          z-index: 1;
          max-width: 600px;
          margin-top: 36px;
        }

        .cover-kicker,
        .section-eyebrow,
        .property-type,
        .property-reference {
          color: var(--brochure-primary);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .cover-kicker {
          margin: 0 0 10px;
        }

        .cover-title {
          max-width: 650px;
          margin: 0;
          color: var(--brochure-ink);
          font-size: clamp(2.2rem, 5vw, 3.8rem);
          font-weight: 800;
          letter-spacing: -0.065em;
          line-height: 0.98;
        }

        .cover-description {
          max-width: 470px;
          margin: 18px 0 0;
          color: var(--brochure-ink-soft);
          font-size: 13px;
          line-height: 1.65;
        }

        .cover-rule {
          width: 64px;
          height: 4px;
          margin-top: 24px;
          background: var(--brochure-primary-bright);
          border-radius: 999px;
        }

        .cover-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          max-width: 520px;
          margin-top: 28px;
          border-top: 1px solid var(--brochure-line);
          border-bottom: 1px solid var(--brochure-line);
        }

        .cover-stat {
          padding: 13px 18px 13px 0;
        }

        .cover-stat + .cover-stat {
          padding-left: 18px;
          border-left: 1px solid var(--brochure-line);
        }

        .cover-stat-value {
          display: block;
          color: var(--brochure-ink);
          font-size: 21px;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .cover-stat-label {
          display: block;
          margin-top: 3px;
          color: var(--brochure-muted);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .listing-section {
          padding: 34px 40px 0;
        }

        .section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
          padding-bottom: 13px;
          border-bottom: 1px solid var(--brochure-line);
        }

        .section-eyebrow {
          margin: 0 0 7px;
          color: var(--brochure-muted);
        }

        .section-title {
          margin: 0;
          color: var(--brochure-ink);
          font-size: 25px;
          font-weight: 800;
          letter-spacing: -0.045em;
        }

        .section-count {
          color: var(--brochure-muted);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .property-list {
          display: grid;
          gap: 14px;
        }

        .prop-card {
          display: flex;
          min-width: 0;
          overflow: hidden;
          background: var(--brochure-paper);
          border: 1px solid var(--brochure-line);
          border-radius: 16px;
          break-inside: avoid;
        }

        .property-visual {
          position: relative;
          flex: 0 0 218px;
          min-height: 188px;
          overflow: hidden;
          background: #e8efec;
        }

        .property-visual img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .property-visual-empty {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--brochure-primary);
          background: linear-gradient(135deg, #edf6f2, #dbece5);
        }

        .property-status {
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 5px 8px;
          color: white;
          background: var(--brochure-primary);
          border-radius: 5px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .property-status.status-under-offer {
          background: var(--brochure-amber);
        }

        .property-status.status-sold {
          background: var(--brochure-red);
        }

        .property-info {
          display: flex;
          flex: 1;
          min-width: 0;
          flex-direction: column;
          padding: 17px 19px 15px;
        }

        .property-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }

        .property-type {
          margin: 0 0 6px;
          color: var(--brochure-primary);
          font-size: 9px;
        }

        .property-title {
          margin: 0;
          color: var(--brochure-ink);
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.035em;
          line-height: 1.15;
        }

        .property-location {
          display: flex;
          align-items: flex-start;
          gap: 5px;
          margin-top: 7px;
          color: var(--brochure-muted);
          font-size: 11px;
          line-height: 1.35;
        }

        .property-location svg {
          flex: 0 0 auto;
          margin-top: 1px;
          color: var(--brochure-primary);
        }

        .price-lockup {
          flex: 0 0 auto;
          min-width: 104px;
          text-align: right;
        }

        .property-price {
          display: block;
          color: var(--brochure-primary);
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.1;
        }

        .property-reference {
          display: block;
          margin-top: 6px;
          color: var(--brochure-muted);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 8px;
          letter-spacing: 0.08em;
        }

        .property-specs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          margin-top: 15px;
          padding: 10px 0;
          border-top: 1px solid #edf2f0;
          border-bottom: 1px solid #edf2f0;
          color: var(--brochure-ink-soft);
          font-size: 10px;
        }

        .property-spec {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }

        .property-spec svg {
          color: var(--brochure-primary);
        }

        .property-description {
          display: -webkit-box;
          margin: 11px 0 0;
          overflow: hidden;
          color: var(--brochure-ink-soft);
          font-size: 10px;
          line-height: 1.5;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .property-bottom {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          margin-top: auto;
          padding-top: 11px;
        }

        .property-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        .property-tag {
          padding: 4px 6px;
          color: var(--brochure-ink-soft);
          background: var(--brochure-paper-warm);
          border: 1px solid var(--brochure-line);
          border-radius: 4px;
          font-size: 8px;
          font-weight: 700;
        }

        .property-link {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          gap: 3px;
          color: var(--brochure-primary);
          font-size: 9px;
          font-weight: 800;
          text-decoration: none;
          white-space: nowrap;
        }

        .property-link:hover {
          color: var(--brochure-ink);
        }

        .property-agent {
          margin-left: auto;
          color: var(--brochure-muted);
          font-size: 9px;
          text-align: right;
        }

        .brochure-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin: 34px 40px 0;
          padding: 17px 0 27px;
          color: var(--brochure-muted);
          border-top: 1px solid var(--brochure-line);
          font-size: 9px;
        }

        .brochure-footer a {
          color: var(--brochure-primary);
          font-weight: 800;
          text-decoration: none;
        }

        .empty-state {
          margin: 34px 40px;
          padding: 60px 24px;
          color: var(--brochure-muted);
          text-align: center;
          background: var(--brochure-paper-warm);
          border: 1px solid var(--brochure-line);
          border-radius: 16px;
        }

        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          .brochure-canvas { min-height: 0; padding: 0; background: white; }
          .brochure-paper { box-shadow: none; }
          .cover-header { padding-top: 24px; }
          .prop-card { break-inside: avoid; }
          .section-heading { break-after: avoid; }
          .listing-section { break-inside: avoid; }
        }

        @media (max-width: 700px) {
          .brochure-canvas { padding: 64px 0 0; }
          .cover-header, .listing-section { padding-right: 22px; padding-left: 22px; }
          .cover-stats { grid-template-columns: 1fr; }
          .cover-stat,
          .cover-stat + .cover-stat {
            padding: 11px 0;
            border-left: 0;
          }
          .cover-stat + .cover-stat { border-top: 1px solid var(--brochure-line); }
          .prop-card { display: block; }
          .property-visual { min-height: 180px; }
          .property-bottom { align-items: flex-start; flex-direction: column; }
          .property-agent { margin-left: 0; text-align: left; }
          .brochure-footer { margin-right: 22px; margin-left: 22px; }
        }

        @page { size: A4; margin: 10mm 12mm 13mm; }
      `}</style>

      {/* Action bar */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => window.close()}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Close
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{properties.length} properties · Print to save as PDF</span>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Brochure body */}
      <div className="brochure-canvas">
        <div className="brochure-body brochure-paper bg-white min-h-screen" style={{ maxWidth: '210mm', margin: '0 auto' }}>

        {/* ── COVER HEADER ── */}
        <section className="cover-header">
          <div className="cover-topline">
            <LogoLockup logoUrl={agencyLogo} agencyName={agencyName} />
            <div className="cover-date">{new Date().toLocaleDateString('en-ZW', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>

          <div className="cover-copy">
            <p className="cover-kicker">Property catalogue</p>
            <h1 className="cover-title">{titleLine}</h1>
            <p className="cover-description">
              A considered selection of published properties, presented through the QuickProp platform.
            </p>
            <div className="cover-rule" />
            <div className="cover-stats">
              <CoverStat value={properties.length} label="Published listings" />
              <CoverStat value={forSale.length} label="For sale" />
              <CoverStat value={forRent.length} label="To rent" />
            </div>
          </div>
        </section>

        {properties.length === 0 && (
          <div className="empty-state">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">No published listings</p>
            <p className="text-sm mt-1">Publish some properties in the CRM to generate a brochure.</p>
          </div>
        )}

        {/* ── FOR SALE SECTION ── */}
        {forSale.length > 0 && (
          <section className="listing-section">
            <div className="section-heading">
              <div>
                <p className="section-eyebrow">01 / Available now</p>
                <h2 className="section-title">For Sale</h2>
              </div>
              <span className="section-count">{forSale.length} {forSale.length === 1 ? 'property' : 'properties'}</span>
            </div>
            <div className="property-list">
              {forSale.map(p => (
                <PropertyCard key={p.id} property={p} agentMap={agentMap} />
              ))}
            </div>
          </section>
        )}

        {/* ── TO RENT SECTION ── */}
        {forRent.length > 0 && (
          <section className="listing-section">
            <div className="section-heading">
              <div>
                <p className="section-eyebrow">02 / Flexible living</p>
                <h2 className="section-title">To Rent</h2>
              </div>
              <span className="section-count">{forRent.length} {forRent.length === 1 ? 'property' : 'properties'}</span>
            </div>
            <div className="property-list">
              {forRent.map(p => (
                <PropertyCard key={p.id} property={p} agentMap={agentMap} />
              ))}
            </div>
          </section>
        )}

        {/* ── FOOTER ── */}
        <footer className="brochure-footer">
          <span>
            Powered by{' '}
            <a href="https://www.quickprop.co.zw" target="_blank" rel="noopener noreferrer">
              QuickProp
            </a>
          </span>
          <span>Generated {new Date().toLocaleDateString('en-ZW')}</span>
        </footer>
        </div>
      </div>
    </>
  );
}

function LogoLockup({ logoUrl, agencyName }: { logoUrl?: string | null; agencyName: string }) {
  return (
    <div className="brochure-logo" aria-label={`${agencyName} logo`}>
      {logoUrl ? (
        <img src={logoUrl} alt={`${agencyName} logo`} />
      ) : (
        <span className="brochure-logo-fallback">
          <span className="brochure-logo-mark"><Building2 className="w-4 h-4" /></span>
          <span>{agencyName}</span>
        </span>
      )}
    </div>
  );
}

function CoverStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="cover-stat">
      <span className="cover-stat-value">{value}</span>
      <span className="cover-stat-label">{label}</span>
    </div>
  );
}

function PropertyCard({ property: p, agentMap }: { property: any; agentMap: Record<number, string> }) {
  const statusInfo = STATUS_PILL[p.status] ?? { label: p.listingType === 'rent' ? 'To Rent' : 'For Sale', color: '#059669' };
  const agentName = p.agentId ? agentMap[p.agentId] : null;
  const statusClass = p.status === 'under_offer'
    ? 'status-under-offer'
    : p.status === 'sold'
      ? 'status-sold'
      : '';

  return (
    <article className="prop-card">
      {/* Thumbnail */}
      <div className="property-visual">
        {p.coverImage ? (
          <img src={p.coverImage} alt={p.title} />
        ) : (
          <div className="property-visual-empty">
            <Building2 className="w-8 h-8" />
          </div>
        )}
        <div
          className={`property-status ${statusClass}`}
        >
          {statusInfo.label}
        </div>
      </div>

      {/* Details */}
      <div className="property-info">
        <div className="property-top">
          <div className="min-w-0">
            <p className="property-type">{p.propertyType.replace('_', ' ')}</p>
            <h3 className="property-title">{p.title}</h3>
            <div className="property-location">
              <MapPin className="w-3 h-3" />
              <span>{p.address ? `${p.address}, ` : ''}{p.suburb}, {p.city}</span>
            </div>
          </div>
          <div className="price-lockup">
            <span className="property-price">{formatPrice(p.price, p.currency, p.listingType)}</span>
            <span className="property-reference">Ref {p.reference}</span>
          </div>
        </div>

        {/* Specs */}
        <div className="property-specs">
          {p.bedrooms != null && (
            <span className="property-spec"><Bed className="w-3.5 h-3.5" /> {p.bedrooms} bed</span>
          )}
          {p.bathrooms != null && (
            <span className="property-spec"><Bath className="w-3.5 h-3.5" /> {p.bathrooms} bath</span>
          )}
          {p.parking != null && (
            <span className="property-spec"><Car className="w-3.5 h-3.5" /> {p.parking} park</span>
          )}
          {p.landSize != null && (
            <span className="property-spec"><Square className="w-3.5 h-3.5" /> {p.landSize} m²</span>
          )}
          <span className="property-spec">
            <Building2 className="w-3.5 h-3.5" /> {p.propertyType.replace('_', ' ')}
          </span>
        </div>

        {/* Description snippet */}
        {p.description && (
          <p className="property-description">{p.description}</p>
        )}

        {/* Features + agent */}
        <div className="property-bottom">
          <div className="property-tags">
            {(p.features ?? []).slice(0, 4).map((f: string) => (
              <span key={f} className="property-tag">{f}</span>
            ))}
          </div>
          <a
            href={`${PUBLIC_SITE_URL}/properties/${p.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="property-link"
          >
            View online <ArrowUpRight className="w-3 h-3" />
          </a>
          {agentName && (
            <span className="property-agent">{agentName}</span>
          )}
        </div>
      </div>
    </article>
  );
}
