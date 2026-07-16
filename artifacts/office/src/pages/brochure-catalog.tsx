import React from 'react';
import { useListProperties, useGetCurrentUser, useListUsers } from '@workspace/api-client-react';
import { Bed, Bath, Car, Square, MapPin, Building2, Printer, ArrowLeft, Tag } from 'lucide-react';

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

export default function BrochureCatalog() {
  const params = new URLSearchParams(window.location.search);
  const mode = (params.get('mode') ?? 'company') as 'my' | 'company' | 'custom';
  const agentParam = params.get('agents') ?? '';
  const selectedAgentIds = agentParam ? agentParam.split(',').map(Number) : [];

  const { data: currentUser } = useGetCurrentUser();
  const { data: allProps, isLoading } = useListProperties();
  const { data: users } = useListUsers();

  const PUBLIC_STATUSES = ['public', 'under_offer', 'coming_soon'];

  const properties = React.useMemo(() => {
    if (!allProps) return [];
    const pub = allProps.filter(p => PUBLIC_STATUSES.includes(p.status));
    if (mode === 'my') return pub.filter(p => p.agentId === currentUser?.id);
    if (mode === 'custom') return pub.filter(p => p.agentId != null && selectedAgentIds.includes(p.agentId));
    return pub; // company
  }, [allProps, mode, currentUser, selectedAgentIds.join(',')]);

  const agentMap = React.useMemo(() => {
    const m: Record<number, string> = {};
    (users ?? []).forEach(u => { m[u.id] = u.name ?? 'Agent'; });
    return m;
  }, [users]);

  const titleLine = mode === 'my'
    ? `${currentUser?.name ?? 'Agent'}'s Property Catalogue`
    : mode === 'custom' && selectedAgentIds.length > 0
      ? selectedAgentIds.map(id => agentMap[id]).filter(Boolean).join(', ') + ' — Property Catalogue'
      : 'Company Property Catalogue';

  const forSale = properties.filter(p => p.listingType === 'sale');
  const forRent = properties.filter(p => p.listingType === 'rent');

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
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          .prop-card { break-inside: avoid; }
          .section-header { break-after: avoid; }
        }
        @page { size: A4; margin: 15mm; }
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
      <div className="bg-white pt-16 pb-16 min-h-screen" style={{ maxWidth: '210mm', margin: '0 auto' }}>

        {/* ── COVER HEADER ── */}
        <div className="px-10 pt-10 pb-8 border-b-4 border-emerald-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth={2}>
                  <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
                  <path d="M9 21V12h6v9" />
                </svg>
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900">QuickProp</div>
                <div className="text-xs text-gray-500">Zimbabwe's Property Marketplace</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Property Catalogue</div>
              <div className="text-xs text-gray-500 mt-0.5">{new Date().toLocaleDateString('en-ZW', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>

          <div className="mt-6">
            <h1 className="text-3xl font-bold text-gray-900">{titleLine}</h1>
            <p className="text-gray-500 mt-1 text-sm">
              {forSale.length > 0 && `${forSale.length} for sale`}
              {forSale.length > 0 && forRent.length > 0 && ' · '}
              {forRent.length > 0 && `${forRent.length} to rent`}
              {properties.length === 0 && 'No published listings'}
            </p>
          </div>
        </div>

        {properties.length === 0 && (
          <div className="px-10 py-16 text-center text-gray-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">No published listings</p>
            <p className="text-sm mt-1">Publish some properties in the CRM to generate a brochure.</p>
          </div>
        )}

        {/* ── FOR SALE SECTION ── */}
        {forSale.length > 0 && (
          <div className="px-10 pt-8">
            <div className="section-header flex items-center gap-3 mb-5">
              <div className="w-1 h-6 rounded-full bg-emerald-600" />
              <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">For Sale</h2>
              <span className="text-sm text-gray-400">{forSale.length} {forSale.length === 1 ? 'property' : 'properties'}</span>
            </div>
            <div className="space-y-4">
              {forSale.map(p => (
                <PropertyCard key={p.id} property={p} agentMap={agentMap} />
              ))}
            </div>
          </div>
        )}

        {/* ── TO RENT SECTION ── */}
        {forRent.length > 0 && (
          <div className="px-10 pt-8">
            <div className="section-header flex items-center gap-3 mb-5">
              <div className="w-1 h-6 rounded-full bg-blue-600" />
              <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">To Rent</h2>
              <span className="text-sm text-gray-400">{forRent.length} {forRent.length === 1 ? 'property' : 'properties'}</span>
            </div>
            <div className="space-y-4">
              {forRent.map(p => (
                <PropertyCard key={p.id} property={p} agentMap={agentMap} />
              ))}
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="mx-10 mt-10 pt-6 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400">
          <span>QuickProp · Zimbabwe's Property Marketplace · www.quickprop.co.zw</span>
          <span>Generated {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </>
  );
}

function PropertyCard({ property: p, agentMap }: { property: any; agentMap: Record<number, string> }) {
  const statusInfo = STATUS_PILL[p.status] ?? { label: p.listingType === 'rent' ? 'To Rent' : 'For Sale', color: '#059669' };
  const agentName = p.agentId ? agentMap[p.agentId] : null;

  return (
    <div className="prop-card flex gap-4 border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Thumbnail */}
      <div className="w-40 shrink-0 bg-gray-100 relative" style={{ minHeight: '120px' }}>
        {p.coverImage ? (
          <img src={p.coverImage} alt={p.title} className="w-full h-full object-cover absolute inset-0" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-300">
            <Building2 className="w-8 h-8" />
          </div>
        )}
        <div
          className="absolute top-2 left-2 text-white text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
          style={{ backgroundColor: statusInfo.color }}
        >
          {statusInfo.label}
        </div>
      </div>

      {/* Details */}
      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">{p.title}</h3>
            <div className="flex items-center gap-1 text-gray-500 text-xs mt-0.5">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{p.address ? `${p.address}, ` : ''}{p.suburb}, {p.city}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-base font-bold text-emerald-700 leading-tight">{formatPrice(p.price, p.currency, p.listingType)}</div>
            <div className="text-[10px] text-gray-400 font-mono uppercase">{p.reference}</div>
          </div>
        </div>

        {/* Specs */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
          {p.bedrooms != null && (
            <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" /> {p.bedrooms} bed</span>
          )}
          {p.bathrooms != null && (
            <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {p.bathrooms} bath</span>
          )}
          {p.parking != null && (
            <span className="flex items-center gap-1"><Car className="w-3.5 h-3.5" /> {p.parking} park</span>
          )}
          {p.landSize != null && (
            <span className="flex items-center gap-1"><Square className="w-3.5 h-3.5" /> {p.landSize} m²</span>
          )}
          <span className="flex items-center gap-1 capitalize">
            <Building2 className="w-3.5 h-3.5" /> {p.propertyType.replace('_', ' ')}
          </span>
        </div>

        {/* Description snippet */}
        {p.description && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">{p.description}</p>
        )}

        {/* Features + agent */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex flex-wrap gap-1">
            {(p.features ?? []).slice(0, 4).map((f: string) => (
              <span key={f} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{f}</span>
            ))}
          </div>
          {agentName && (
            <span className="text-[10px] text-gray-400 shrink-0 ml-2">{agentName}</span>
          )}
        </div>
      </div>
    </div>
  );
}
