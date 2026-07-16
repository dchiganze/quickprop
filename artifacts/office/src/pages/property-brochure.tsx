import React from 'react';
import { useGetProperty, useGetCurrentUser } from '@workspace/api-client-react';
import { Bed, Bath, Car, Square, Building2, MapPin, Phone, Mail, Printer, ArrowLeft } from 'lucide-react';

export default function PropertyBrochure({ params }: { params: { id: string } }) {
  const propertyId = parseInt(params.id, 10);
  const { data: property, isLoading } = useGetProperty(propertyId);
  const { data: user } = useGetCurrentUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">Property not found.</p>
      </div>
    );
  }

  const formatPrice = () => {
    const p = property.price;
    const formatted = p >= 1_000_000
      ? `${(p / 1_000_000).toFixed(2)}M`
      : p.toLocaleString();
    const suffix = property.listingType === 'rent' ? '/month' : '';
    return `${property.currency} ${formatted}${suffix}`;
  };

  const specs = [
    property.bedrooms != null && { icon: <Bed className="w-5 h-5" />, value: property.bedrooms, label: 'Bedrooms' },
    property.bathrooms != null && { icon: <Bath className="w-5 h-5" />, value: property.bathrooms, label: 'Bathrooms' },
    property.parking != null && { icon: <Car className="w-5 h-5" />, value: property.parking, label: 'Parking' },
    property.landSize != null && { icon: <Square className="w-5 h-5" />, value: `${property.landSize} m²`, label: 'Stand Size' },
    { icon: <Building2 className="w-5 h-5" />, value: property.propertyType.charAt(0).toUpperCase() + property.propertyType.slice(1).replace('_', ' '), label: 'Type' },
  ].filter(Boolean) as { icon: React.ReactNode; value: string | number; label: string }[];

  const statusLabel: Record<string, { text: string; bg: string }> = {
    public: { text: 'For Sale', bg: 'bg-emerald-600' },
    under_offer: { text: 'Under Offer', bg: 'bg-amber-500' },
    coming_soon: { text: 'Coming Soon', bg: 'bg-blue-600' },
    sold: { text: 'Sold', bg: 'bg-red-600' },
  };
  const statusInfo = statusLabel[property.status] ?? { text: property.listingType === 'rent' ? 'To Rent' : 'For Sale', bg: 'bg-emerald-600' };

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .brochure-page { box-shadow: none !important; }
        }
        @page {
          size: A4;
          margin: 0;
        }
      `}</style>

      {/* Action bar — hidden when printing */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Property
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Print or save as PDF using your browser's print dialog</span>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Brochure — A4 layout */}
      <div className="min-h-screen bg-gray-100 pt-16 pb-12 no-print-bg">
        <div
          className="brochure-page mx-auto bg-white shadow-2xl"
          style={{ width: '210mm', minHeight: '297mm' }}
        >
          {/* ── HEADER BAND ── */}
          <div className="flex items-center justify-between px-10 py-5 border-b-4 border-emerald-600">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-emerald-600 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth={2}>
                  <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
                  <path d="M9 21V12h6v9" />
                </svg>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 leading-tight">QuickProp</div>
                <div className="text-xs text-gray-500 leading-tight">Zimbabwe's Property Marketplace</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Property Brochure</div>
              <div className="text-xs text-gray-500 mt-0.5">Ref: {property.reference}</div>
            </div>
          </div>

          {/* ── HERO IMAGE ── */}
          <div className="relative bg-gray-100" style={{ height: '220px' }}>
            {property.coverImage ? (
              <img
                src={property.coverImage}
                alt={property.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                <Building2 className="w-16 h-16 mb-2" />
                <span className="text-sm">No photo available</span>
              </div>
            )}
            {/* Price + Status overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-8 pt-12 pb-5">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-white text-3xl font-bold tracking-tight">{formatPrice()}</div>
                  <div className="flex items-center gap-1.5 mt-1 text-white/80 text-sm">
                    <MapPin className="w-3.5 h-3.5" />
                    {property.address ? `${property.address}, ` : ''}{property.suburb}, {property.city}
                  </div>
                </div>
                <span className={`${statusInfo.bg} text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-md`}>
                  {property.listingType === 'rent' ? 'To Rent' : statusInfo.text}
                </span>
              </div>
            </div>
          </div>

          {/* ── PROPERTY TITLE ── */}
          <div className="px-10 pt-6 pb-4 border-b border-gray-100">
            <h1 className="text-2xl font-bold text-gray-900">{property.title}</h1>
          </div>

          {/* ── SPECS BAR ── */}
          <div className="px-10 py-5 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-8 flex-wrap">
              {specs.map((spec, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="text-emerald-600">{spec.icon}</div>
                  <div>
                    <div className="text-lg font-bold text-gray-900 leading-tight">{spec.value}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">{spec.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── BODY ── */}
          <div className="px-10 py-6 grid grid-cols-3 gap-8">
            {/* Description */}
            <div className="col-span-2 space-y-6">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-700 mb-3">Description</h2>
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {property.description || 'Contact us for full property details.'}
                </p>
              </div>

              {property.features && property.features.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-700 mb-3">Features & Amenities</h2>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                    {property.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Contact Sidebar */}
            <div className="col-span-1 space-y-4">
              {/* Agent card */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-emerald-600 px-4 py-3">
                  <div className="text-white text-xs font-bold uppercase tracking-widest">Your Agent</div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="font-semibold text-gray-900 text-sm">{user?.name ?? 'QuickProp Agent'}</div>
                  {user?.email && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Mail className="w-3.5 h-3.5 text-emerald-600" />
                      {user.email}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    +263 77 000 0000
                  </div>
                </div>
              </div>

              {/* Property details card */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                  <div className="text-gray-700 text-xs font-bold uppercase tracking-widest">Property Info</div>
                </div>
                <div className="p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reference</span>
                    <span className="font-semibold text-gray-800">{property.reference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Listing Type</span>
                    <span className="font-semibold text-gray-800 capitalize">{property.listingType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Property Type</span>
                    <span className="font-semibold text-gray-800 capitalize">{property.propertyType.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">City</span>
                    <span className="font-semibold text-gray-800">{property.city}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Suburb</span>
                    <span className="font-semibold text-gray-800">{property.suburb}</span>
                  </div>
                  {property.landSize != null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Stand Size</span>
                      <span className="font-semibold text-gray-800">{property.landSize} m²</span>
                    </div>
                  )}
                </div>
              </div>

              {/* QR / CTA */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                <div className="text-xs text-emerald-700 font-semibold mb-1">View online</div>
                <div className="text-xs text-emerald-600 break-all">quickprop.co.zw/web/property/{property.id}</div>
              </div>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div className="mt-auto px-10 py-4 bg-gray-900 flex items-center justify-between">
            <div className="text-white text-sm font-semibold">QuickProp — Zimbabwe's Property Marketplace</div>
            <div className="text-gray-400 text-xs">www.quickprop.co.zw · Ref: {property.reference}</div>
          </div>
        </div>
      </div>
    </>
  );
}
