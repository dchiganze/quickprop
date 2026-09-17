import React from 'react';
import {
  ArrowLeft,
  Bath,
  Bed,
  Building2,
  Car,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Printer,
  Quote,
  Square,
} from 'lucide-react';
import {
  useGetAdminAgencySettings,
  useGetCurrentUser,
  useListProperties,
  useListUsers,
} from '@workspace/api-client-react';

const PUBLIC_STATUSES = ['public', 'under_offer', 'coming_soon'];
const STATUS_LABELS: Record<string, string> = {
  public: 'For Sale',
  under_offer: 'Under Offer',
  coming_soon: 'Coming Soon',
  sold: 'Sold',
};
const STOCK_PROPERTY_PHOTOS_BASE = `${import.meta.env.BASE_URL}stock-property-images/`;
const GENERIC_PROPERTY_PHOTOS = ['house-exterior.jpg', 'house-interior.jpg', 'house-living.jpg'];
type PropertyGroup = 'residential' | 'commercial' | 'stand' | 'mine' | 'farm' | 'other_land';
type LandGroupKey = Extract<PropertyGroup, 'stand' | 'mine' | 'farm' | 'other_land'>;
const LAND_TYPE_GROUPS: Record<string, LandGroupKey> = {
  stand: 'stand',
  stands: 'stand',
  mine: 'mine',
  mines: 'mine',
  mining: 'mine',
  farm: 'farm',
  farms: 'farm',
  other_land: 'other_land',
  land: 'other_land',
  plot: 'other_land',
  vacant_land: 'other_land',
};
const COMMERCIAL_TYPES = new Set(['commercial', 'industrial', 'office', 'retail', 'warehouse', 'shop', 'business']);

function getPropertyGroup(propertyType: string): PropertyGroup {
  const normalized = propertyType.toLowerCase();
  return LAND_TYPE_GROUPS[normalized] ?? (COMMERCIAL_TYPES.has(normalized) ? 'commercial' : 'residential');
}

function formatPrice(price: number, currency: string, listingType: string) {
  const formatted = price >= 1_000_000
    ? `${currency} ${(price / 1_000_000).toFixed(2)}M`
    : `${currency} ${price.toLocaleString()}`;
  return listingType === 'rent' ? `${formatted}/mo` : formatted;
}

function getGenericPropertyPhotos(property: any): string[] {
  const stockStart = Number(property.id ?? 0) % GENERIC_PROPERTY_PHOTOS.length;
  return [
    ...GENERIC_PROPERTY_PHOTOS.slice(stockStart),
    ...GENERIC_PROPERTY_PHOTOS.slice(0, stockStart),
  ].map((photo) => `${STOCK_PROPERTY_PHOTOS_BASE}${photo}`);
}

function getPropertyPhotos(property: any): string[] {
  const listingPhotos = [...new Set([
    property.coverImage,
    ...(Array.isArray(property.photos) ? property.photos : []),
  ].filter((photo): photo is string => typeof photo === 'string' && photo.trim().length > 0))];
  const genericPhotos = getGenericPropertyPhotos(property);

  return Array.from({ length: 3 }, (_, index) => listingPhotos[index] ?? genericPhotos[index]);
}

export default function BrochureCatalog() {
  const params = new URLSearchParams(window.location.search);
  const mode = (params.get('mode') ?? 'company') as 'my' | 'company' | 'custom';
  const propParam = params.get('props') ?? '';
  const listingTypesParam = params.get('listingTypes') ?? 'sale,rent';
  const propertyGroupsParam = params.get('propertyGroups') ?? 'residential,commercial,stand,mine,farm,other_land';
  const listingTypes = new Set(listingTypesParam.split(',').filter(Boolean));
  const propertyGroups = new Set(propertyGroupsParam.split(',').filter(Boolean));
  if (propertyGroups.has('residential_commercial')) {
    propertyGroups.add('residential');
    propertyGroups.add('commercial');
  }
  if (propertyGroups.has('land')) {
    propertyGroups.add('stand');
    propertyGroups.add('mine');
    propertyGroups.add('farm');
    propertyGroups.add('other_land');
  }
  const selectedPropIds = propParam
    ? new Set(propParam.split(',').map(Number))
    : new Set<number>();

  React.useEffect(() => {
    const previousTitle = document.title;
    document.title = '';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const { data: currentUser } = useGetCurrentUser();
  const { data: agencySettings } = useGetAdminAgencySettings();
  const { data: allProperties, isLoading } = useListProperties();
  const { data: users } = useListUsers();

  const properties = React.useMemo(() => {
    if (!allProperties) return [];
    const published = allProperties.filter((property) => PUBLIC_STATUSES.includes(property.status));
    const scoped = mode === 'my'
      ? published.filter((property) => property.agentId === currentUser?.id)
      : mode === 'custom'
        ? published.filter((property) => selectedPropIds.has(property.id))
        : published;
    return scoped.filter((property) =>
      listingTypes.has(property.listingType) &&
      propertyGroups.has(getPropertyGroup(property.propertyType)),
    );
  }, [allProperties, currentUser?.id, mode, propParam, listingTypesParam, propertyGroupsParam]);

  const agentMap = React.useMemo(() => {
    const map: Record<number, string> = {};
    (users ?? []).forEach((user) => {
      map[user.id] = user.name ?? 'Agent';
    });
    return map;
  }, [users]);

  const customAgentNames = React.useMemo(() => {
    if (mode !== 'custom') return [];
    const agentIds = new Set(properties.map((property) => property.agentId).filter(Boolean));
    return [...agentIds].map((id) => agentMap[id as number]).filter(Boolean);
  }, [agentMap, mode, properties]);

  const agencyName = agencySettings?.agencyName || 'QuickProp';
  const titleLine = mode === 'my'
    ? `${currentUser?.name ?? 'Agent'}'s Property Brochure`
    : mode === 'custom' && customAgentNames.length > 0
      ? `${customAgentNames.join(', ')} — Property Brochure`
      : `${agencyName} Brochure`;
  const saleProperties = properties.filter((property) => property.listingType === 'sale');
  const rentalProperties = properties.filter((property) => property.listingType === 'rent');
  const pagesCount = properties.length > 0 ? properties.length + 1 : 2;
  const tagline = agencySettings?.tagline?.trim() ?? '';
  const aboutText = agencySettings?.aboutText?.trim() ?? '';

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

        .brochure-page {
          position: relative;
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto 24px;
          padding: 16mm 15mm 25mm;
          overflow: hidden;
          background: var(--brochure-paper);
          box-shadow: 0 20px 60px rgba(16, 42, 42, 0.12);
          break-inside: avoid;
          break-after: page;
          page-break-after: always;
        }

        .brochure-page:last-child {
          break-after: auto;
          page-break-after: auto;
        }

        .cover-page {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: var(--brochure-paper-warm);
        }

        .cover-logo {
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          min-height: 31.5mm;
        }

        .cover-logo img {
          display: block;
          max-width: 101.5mm;
          max-height: 31.5mm;
          object-fit: contain;
          object-position: left top;
        }

        .cover-logo-fallback {
          color: var(--brochure-ink);
          font-size: 31px;
          font-weight: 800;
          letter-spacing: -0.05em;
        }

        .cover-kicker,
        .page-kicker,
        .property-kicker {
          margin: 0;
          color: var(--brochure-primary);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .cover-main {
          max-width: 690px;
          padding-top: 10mm;
        }

        .cover-title {
          max-width: 170mm;
          margin: 12px 0 0;
          color: var(--brochure-ink);
          font-size: 54px;
          font-weight: 800;
          letter-spacing: -0.07em;
          line-height: 0.96;
        }

        .cover-tagline {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          max-width: 125mm;
          margin: 22px 0 0;
          color: var(--brochure-ink-soft);
          font-size: 17px;
          font-weight: 500;
          line-height: 1.45;
        }

        .cover-tagline svg {
          flex: 0 0 auto;
          margin-top: 3px;
          color: var(--brochure-primary-bright);
        }

        .cover-description {
          max-width: 135mm;
          margin: 18px 0 0;
          color: var(--brochure-muted);
          font-size: 12px;
          line-height: 1.65;
        }

        .cover-rule {
          width: 68px;
          height: 4px;
          margin-top: 26px;
          background: var(--brochure-primary-bright);
          border-radius: 999px;
        }

        .cover-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          max-width: 135mm;
          margin-top: 34px;
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
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.05em;
        }

        .cover-stat-label {
          display: block;
          margin-top: 3px;
          color: var(--brochure-muted);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .cover-about {
          max-width: 155mm;
          margin-top: 22mm;
          padding-top: 14px;
          border-top: 1px solid var(--brochure-line);
        }

        .cover-about-kicker {
          margin: 0;
          color: var(--brochure-primary);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .cover-about-copy {
          max-width: 145mm;
          margin: 8px 0 0;
          color: var(--brochure-ink-soft);
          font-size: 12px;
          line-height: 1.55;
          white-space: pre-line;
        }

        .cover-about .about-contact {
          margin-top: 16px;
          padding-top: 14px;
          gap: 10px;
        }

        .about-page {
          display: flex;
          flex-direction: column;
        }

        .about-heading {
          max-width: 150mm;
          margin-top: 25mm;
        }

        .about-title {
          margin: 10px 0 0;
          color: var(--brochure-ink);
          font-size: 47px;
          font-weight: 800;
          letter-spacing: -0.07em;
          line-height: 0.98;
        }

        .about-tagline {
          max-width: 135mm;
          margin: 20px 0 0;
          color: var(--brochure-primary);
          font-size: 21px;
          font-weight: 700;
          letter-spacing: -0.03em;
          line-height: 1.25;
        }

        .about-rule {
          width: 100%;
          height: 1px;
          margin: 25px 0 28px;
          background: var(--brochure-line);
        }

        .about-copy {
          max-width: 145mm;
          margin: 0;
          color: var(--brochure-ink-soft);
          font-size: 16px;
          line-height: 1.75;
          white-space: pre-line;
        }

        .about-empty {
          color: var(--brochure-muted);
          font-style: italic;
        }

        .about-contact {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          max-width: 155mm;
          margin-top: auto;
          padding-top: 28px;
          border-top: 1px solid var(--brochure-line);
        }

        .contact-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          color: var(--brochure-ink-soft);
          font-size: 10px;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }

        .contact-item svg {
          flex: 0 0 auto;
          margin-top: 1px;
          color: var(--brochure-primary);
        }

        .property-page {
          display: flex;
          flex-direction: column;
        }

        .property-page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 13px;
        }

        .property-kicker {
          color: var(--brochure-muted);
        }

        .property-reference {
          color: var(--brochure-muted);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .property-hero {
          position: relative;
          width: 100%;
          height: 76mm;
          overflow: hidden;
          background: #e7efeb;
        }

        .property-hero img,
        .property-side-photo img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .property-lower {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 67mm;
          gap: 11mm;
          margin-top: 10mm;
        }

        .property-copy {
          min-width: 0;
        }

        .property-title {
          margin: 8px 0 0;
          color: var(--brochure-ink);
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.06em;
          line-height: 1.02;
        }

        .property-location {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          margin-top: 10px;
          color: var(--brochure-muted);
          font-size: 11px;
          line-height: 1.4;
        }

        .property-location svg {
          flex: 0 0 auto;
          margin-top: 1px;
          color: var(--brochure-primary);
        }

        .property-description {
          margin: 19px 0 0;
          color: var(--brochure-ink-soft);
          font-size: 11px;
          line-height: 1.6;
        }

        .property-specs {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px 12px;
          margin-top: 20px;
          padding: 13px 0;
          border-top: 1px solid var(--brochure-line);
          border-bottom: 1px solid var(--brochure-line);
          color: var(--brochure-ink-soft);
          font-size: 10px;
        }

        .property-spec {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .property-spec svg {
          color: var(--brochure-primary);
        }

        .property-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 16px;
        }

        .property-tag {
          padding: 5px 7px;
          color: var(--brochure-ink-soft);
          background: var(--brochure-paper-warm);
          border: 1px solid var(--brochure-line);
          border-radius: 4px;
          font-size: 8px;
          font-weight: 700;
        }

        .property-price {
          display: block;
          margin-top: 22px;
          padding: 13px 14px;
          color: white;
          background: var(--brochure-primary);
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.05em;
          line-height: 1.1;
        }

        .property-status {
          display: inline-block;
          margin-top: 12px;
          padding: 5px 8px;
          color: var(--brochure-primary);
          border: 1px solid var(--brochure-primary-bright);
          border-radius: 4px;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .property-status.status-under-offer {
          color: var(--brochure-amber);
          border-color: #e7c47f;
        }

        .property-status.status-sold {
          color: var(--brochure-red);
          border-color: #e5aaaa;
        }

        .property-side-photos {
          display: grid;
          grid-template-rows: repeat(2, 1fr);
          gap: 10px;
        }

        .property-side-photo {
          position: relative;
          min-height: 53mm;
          overflow: hidden;
          background: #e7efeb;
        }

        .photo-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 12px;
          color: var(--brochure-muted);
          background: var(--brochure-paper-warm);
          border: 1px dashed var(--brochure-line);
          font-size: 10px;
          text-align: center;
        }

        .property-contact {
          display: flex;
          flex-wrap: wrap;
          gap: 7px 18px;
          margin-top: auto;
          padding-top: 16px;
          color: var(--brochure-muted);
          border-top: 1px solid var(--brochure-line);
          font-size: 9px;
        }

        .property-contact-item {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .property-contact-item svg {
          color: var(--brochure-primary);
        }

        .page-footer {
          position: absolute;
          right: 15mm;
          bottom: 9mm;
          left: 15mm;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          padding-top: 9px;
          color: var(--brochure-muted);
          border-top: 1px solid var(--brochure-line);
          font-size: 8px;
        }

        .page-footer-meta {
          display: flex;
          flex-direction: column;
          gap: 3px;
          font-size: 12px;
          line-height: 1.2;
        }

        .page-footer-meta strong {
          color: var(--brochure-ink-soft);
          font-size: 13.5px;
        }

        .page-footer-meta a {
          color: inherit;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .page-footer-logo {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          width: 42mm;
          min-height: 12mm;
        }

        .page-footer-logo img {
          display: block;
          max-width: 42mm;
          max-height: 13mm;
          object-fit: contain;
          object-position: right bottom;
        }

        .page-footer-wordmark {
          color: var(--brochure-ink);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          .brochure-canvas { min-height: 0; padding: 0; background: white; }
          .brochure-page {
            margin: 0;
            box-shadow: none;
          }
        }

        @media (max-width: 900px) {
          .brochure-canvas { padding: 74px 0 0; }
          .brochure-page {
            width: 100%;
            min-height: 0;
            margin-bottom: 18px;
          }
        }

        @media (max-width: 680px) {
          .brochure-page { padding: 32px 22px 96px; }
          .cover-main { padding-top: 10mm; }
          .cover-title { font-size: 42px; }
          .cover-stats { grid-template-columns: 1fr; }
          .cover-stat,
          .cover-stat + .cover-stat {
            padding: 10px 0;
            border-left: 0;
          }
          .cover-stat + .cover-stat { border-top: 1px solid var(--brochure-line); }
          .about-contact { grid-template-columns: 1fr; }
          .property-lower { grid-template-columns: 1fr; }
          .property-hero { height: 58vw; }
          .property-side-photos { grid-template-columns: repeat(2, 1fr); grid-template-rows: 42vw; }
          .property-side-photo { min-height: 0; }
          .page-footer { right: 22px; bottom: 24px; left: 22px; }
        }

        @page { size: A4; margin: 0; }
      `}</style>

      <div className="no-print fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <button
          onClick={() => window.close()}
          className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Close
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{properties.length} properties · One property per page</span>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>
        </div>
      </div>

      <main className="brochure-canvas">
        <CoverPage
          agencyName={agencyName}
          agencyLogo={agencySettings?.logoUrl}
          agencyWebsite={agencySettings?.website}
          agencyPhone={agencySettings?.phone}
          agencyEmail={agencySettings?.email}
          aboutText={aboutText}
          tagline={tagline}
          titleLine={titleLine}
          totalProperties={properties.length}
          saleCount={saleProperties.length}
          rentalCount={rentalProperties.length}
          pageNumber={1}
          pageCount={pagesCount}
        />

        {properties.map((property, index) => (
          <PropertyPage
            key={property.id}
            property={property}
            agentName={property.agentId ? agentMap[property.agentId] : null}
            agencyName={agencyName}
            agencyLogo={agencySettings?.logoUrl}
            agencyWebsite={agencySettings?.website}
            agencyPhone={agencySettings?.phone}
            agencyEmail={agencySettings?.email}
            pageNumber={index + 2}
            pageCount={pagesCount}
          />
        ))}

        {properties.length === 0 && (
          <section className="brochure-page about-page">
            <p className="page-kicker">Brochure status</p>
            <div className="about-heading">
              <h2 className="about-title">No published listings</h2>
              <p className="about-copy about-empty">
                Publish properties in the CRM to include them in this brochure.
              </p>
            </div>
            <PageFooter
              agencyName={agencyName}
              agencyLogo={agencySettings?.logoUrl}
              pageNumber={2}
              pageCount={2}
            />
          </section>
        )}
      </main>
    </>
  );
}

function CoverPage({
  agencyName,
  agencyLogo,
  agencyWebsite,
  agencyPhone,
  agencyEmail,
  aboutText,
  tagline,
  titleLine,
  totalProperties,
  saleCount,
  rentalCount,
  pageNumber,
  pageCount,
}: {
  agencyName: string;
  agencyLogo?: string | null;
  agencyWebsite?: string | null;
  agencyPhone?: string | null;
  agencyEmail?: string | null;
  aboutText: string;
  tagline: string;
  titleLine: string;
  totalProperties: number;
  saleCount: number;
  rentalCount: number;
  pageNumber: number;
  pageCount: number;
}) {
  return (
    <section className="brochure-page cover-page">
      <div>
        <div className="cover-logo" aria-label={`${agencyName} logo`}>
          {agencyLogo ? (
            <img src={agencyLogo} alt={`${agencyName} logo`} />
          ) : (
            <span className="cover-logo-fallback">{agencyName}</span>
          )}
        </div>
        <div className="cover-main">
          <h1 className="cover-title">{titleLine}</h1>
          {tagline && (
            <p className="cover-tagline">
              <Quote className="w-4 h-4" />
              {tagline}
            </p>
          )}
          <p className="cover-description">
            A considered selection of published properties, presented through the QuickProp platform.
          </p>
          <div className="cover-rule" />
          <div className="cover-stats">
            <CoverStat value={totalProperties} label="Published listings" />
            <CoverStat value={saleCount} label="For sale" />
            <CoverStat value={rentalCount} label="To rent" />
          </div>
          <div className="cover-about">
            <p className="cover-about-kicker">About us</p>
            <p className={`cover-about-copy ${aboutText ? '' : 'about-empty'}`}>
              {aboutText || 'Add your agency story in Agency Settings to complete this section.'}
            </p>
            <div className="about-contact">
              {agencyPhone && (
                <span className="contact-item"><Phone className="w-3.5 h-3.5" />{agencyPhone}</span>
              )}
              {agencyEmail && (
                <span className="contact-item"><Mail className="w-3.5 h-3.5" />{agencyEmail}</span>
              )}
              {agencyWebsite && (
                <span className="contact-item"><Globe2 className="w-3.5 h-3.5" />{agencyWebsite.replace(/^https?:\/\//, '')}</span>
              )}
            </div>
          </div>
        </div>
      </div>
      <PageFooter
        agencyName={agencyName}
        agencyLogo={agencyLogo}
        pageNumber={pageNumber}
        pageCount={pageCount}
      />
    </section>
  );
}

function PropertyPage({
  property,
  agentName,
  agencyName,
  agencyLogo,
  agencyWebsite,
  agencyPhone,
  agencyEmail,
  pageNumber,
  pageCount,
}: {
  property: any;
  agentName: string | null;
  agencyName: string;
  agencyLogo?: string | null;
  agencyWebsite?: string | null;
  agencyPhone?: string | null;
  agencyEmail?: string | null;
  pageNumber: number;
  pageCount: number;
}) {
  const photos = getPropertyPhotos(property);
  const genericPhotos = getGenericPropertyPhotos(property);
  const statusLabel = STATUS_LABELS[property.status] ?? (property.listingType === 'rent' ? 'To Rent' : 'For Sale');
  const statusClass = property.status === 'under_offer'
    ? 'status-under-offer'
    : property.status === 'sold'
      ? 'status-sold'
      : '';
  const location = `${property.address ? `${property.address}, ` : ''}${property.suburb}, ${property.city}`;

  return (
    <section className="brochure-page property-page">
      <div className="property-page-header">
        <p className="property-kicker">{property.listingType === 'rent' ? 'To rent' : 'For sale'} · {property.propertyType.replace('_', ' ')}</p>
        <span className="property-reference">Ref {property.reference}</span>
      </div>

      <PhotoSlot
        src={photos[0]}
        fallbackSrc={genericPhotos[0]}
        label="Main property image"
        className="property-hero"
      />

      <div className="property-lower">
        <div className="property-copy">
          <h2 className="property-title">{property.title}</h2>
          <div className="property-location">
            <MapPin className="w-3.5 h-3.5" />
            <span>{location}</span>
          </div>
          {property.description && <p className="property-description">{property.description}</p>}

          <div className="property-specs">
            {property.bedrooms != null && <span className="property-spec"><Bed className="w-3.5 h-3.5" />{property.bedrooms} bedrooms</span>}
            {property.bathrooms != null && <span className="property-spec"><Bath className="w-3.5 h-3.5" />{property.bathrooms} bathrooms</span>}
            {property.parking != null && <span className="property-spec"><Car className="w-3.5 h-3.5" />{property.parking} parking</span>}
            {property.landSize != null && <span className="property-spec"><Square className="w-3.5 h-3.5" />{property.landSize} m²</span>}
            <span className="property-spec"><Building2 className="w-3.5 h-3.5" />{property.propertyType.replace('_', ' ')}</span>
          </div>

          {(property.features ?? []).length > 0 && (
            <div className="property-tags">
              {(property.features ?? []).slice(0, 8).map((feature: string) => (
                <span key={feature} className="property-tag">{feature}</span>
              ))}
            </div>
          )}

          <span className="property-price">{formatPrice(property.price, property.currency, property.listingType)}</span>
          <span className={`property-status ${statusClass}`}>{statusLabel}</span>
        </div>

        <div className="property-side-photos">
          <PhotoSlot
            src={photos[1]}
            fallbackSrc={genericPhotos[1]}
            label="Supporting property image"
            className="property-side-photo"
          />
          <PhotoSlot
            src={photos[2]}
            fallbackSrc={genericPhotos[2]}
            label="Supporting property image"
            className="property-side-photo"
          />
        </div>
      </div>

      <div className="property-contact">
        {agentName && <span className="property-contact-item"><Building2 className="w-3 h-3" />{agentName}</span>}
        {agencyPhone && <span className="property-contact-item"><Phone className="w-3 h-3" />{agencyPhone}</span>}
        {agencyEmail && <span className="property-contact-item"><Mail className="w-3 h-3" />{agencyEmail}</span>}
        {agencyWebsite && <span className="property-contact-item"><Globe2 className="w-3 h-3" />{agencyWebsite.replace(/^https?:\/\//, '')}</span>}
      </div>

      <PageFooter
        agencyName={agencyName}
        agencyLogo={agencyLogo}
        pageNumber={pageNumber}
        pageCount={pageCount}
      />
    </section>
  );
}

function PhotoSlot({
  src,
  fallbackSrc,
  label,
  className,
}: {
  src?: string;
  fallbackSrc?: string;
  label: string;
  className: string;
}) {
  const [imageState, setImageState] = React.useState<'primary' | 'fallback' | 'none'>(
    src ? 'primary' : fallbackSrc ? 'fallback' : 'none',
  );

  React.useEffect(() => {
    setImageState(src ? 'primary' : fallbackSrc ? 'fallback' : 'none');
  }, [src, fallbackSrc]);

  const imageSrc = imageState === 'primary' ? src : imageState === 'fallback' ? fallbackSrc : undefined;

  return (
    <div className={className}>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={label}
          onError={() => setImageState((current) => current === 'primary' && fallbackSrc ? 'fallback' : 'none')}
        />
      ) : (
        <div className="photo-placeholder">
          <Building2 className="mr-2 h-4 w-4" />
          Photo not available
        </div>
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

function PageFooter({
  agencyName,
  agencyLogo,
  pageNumber,
  pageCount,
}: {
  agencyName: string;
  agencyLogo?: string | null;
  pageNumber: number;
  pageCount: number;
}) {
  return (
    <footer className="page-footer">
      <div className="page-footer-meta">
        <strong>
          Powered by{' '}
          <a href="https://quickprop.co.zw" target="_blank" rel="noopener noreferrer">
            quickprop.co.zw
          </a>
        </strong>
        <span>{String(pageNumber).padStart(2, '0')} / {String(pageCount).padStart(2, '0')}</span>
      </div>
      <div className="page-footer-logo" aria-label={`${agencyName} logo`}>
        {agencyLogo ? (
          <img src={agencyLogo} alt={`${agencyName} logo`} />
        ) : (
          <span className="page-footer-wordmark">{agencyName}</span>
        )}
      </div>
    </footer>
  );
}