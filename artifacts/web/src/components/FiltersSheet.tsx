import { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FilterState {
  listingType: string;       // sale | rent | sold | ""
  propertyTypes: string[];   // house | apartment | townhouse | stand | commercial
  minPrice: string;
  maxPrice: string;
  onlyWithPrice: boolean;
  minBeds: string;
  maxBeds: string;
  minBaths: string;
  features: string[];        // pool, balcony, garage, outdoor area, ensuite, study, dishwasher, built-in robes, aircon, solar, heating, fireplace
}

export const EMPTY_FILTERS: FilterState = {
  listingType: "sale",
  propertyTypes: [],
  minPrice: "",
  maxPrice: "",
  onlyWithPrice: false,
  minBeds: "",
  maxBeds: "",
  minBaths: "",
  features: [],
};

const PROPERTY_TYPES = [
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment & Unit" },
  { value: "townhouse", label: "Townhouse" },
  { value: "stand", label: "Stand / Land" },
  { value: "commercial", label: "Commercial" },
  { value: "villa", label: "Villa" },
];

const SALE_PRICES = [
  { value: "25000", label: "$25,000" },
  { value: "50000", label: "$50,000" },
  { value: "75000", label: "$75,000" },
  { value: "100000", label: "$100,000" },
  { value: "150000", label: "$150,000" },
  { value: "200000", label: "$200,000" },
  { value: "300000", label: "$300,000" },
  { value: "500000", label: "$500,000" },
  { value: "750000", label: "$750,000" },
  { value: "1000000", label: "$1,000,000" },
];

const RENT_PRICES = [
  { value: "300", label: "$300/mo" },
  { value: "500", label: "$500/mo" },
  { value: "800", label: "$800/mo" },
  { value: "1000", label: "$1,000/mo" },
  { value: "1500", label: "$1,500/mo" },
  { value: "2000", label: "$2,000/mo" },
  { value: "3000", label: "$3,000/mo" },
  { value: "5000", label: "$5,000/mo" },
];

const BED_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5+" },
];

const OUTDOOR_FEATURES = [
  { value: "pool", label: "Swimming pool" },
  { value: "balcony", label: "Balcony" },
  { value: "garage", label: "Garage" },
  { value: "outdoor area", label: "Outdoor area" },
];
const OUTDOOR_EXTRA = [
  { value: "tennis court", label: "Tennis court" },
  { value: "borehole", label: "Borehole" },
  { value: "servants quarters", label: "Servants quarters" },
  { value: "electric fence", label: "Electric fence" },
];

const INDOOR_FEATURES = [
  { value: "ensuite", label: "Ensuite" },
  { value: "study", label: "Study" },
  { value: "dishwasher", label: "Dishwasher" },
  { value: "built-in robes", label: "Built-in robes" },
];
const INDOOR_EXTRA = [
  { value: "fireplace", label: "Fireplace" },
  { value: "security system", label: "Security system" },
];

const CLIMATE_FEATURES = [
  { value: "air conditioning", label: "Air conditioning" },
  { value: "solar panels", label: "Solar panels" },
  { value: "generator", label: "Generator" },
  { value: "inverter", label: "Inverter" },
];
const CLIMATE_EXTRA = [
  { value: "heating", label: "Heating" },
  { value: "solar geyser", label: "Solar geyser" },
];

interface FiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFilters: FilterState;
  onApply: (filters: FilterState) => void;
}

function ExpandableSection({
  visible,
  extra,
  features,
  onToggle,
  label,
}: {
  visible: { value: string; label: string }[];
  extra: { value: string; label: string }[];
  features: string[];
  onToggle: (v: string) => void;
  label: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const all = expanded ? [...visible, ...extra] : visible;
  const left = all.filter((_, i) => i % 2 === 0);
  const right = all.filter((_, i) => i % 2 === 1);
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        {[left, right].map((col, ci) =>
          col.map((f) => (
            <label key={f.value} className="flex items-center gap-3 cursor-pointer text-sm text-gray-800">
              <input
                type="checkbox"
                checked={features.includes(f.value)}
                onChange={() => onToggle(f.value)}
                className="w-4 h-4 rounded border-gray-300 accent-primary"
              />
              {f.label}
            </label>
          ))
        )}
      </div>
      {extra.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"
        >
          {expanded ? `Hide ${label}` : `Show more ${label}`}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Any",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-800 bg-white pr-8 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

export function FiltersSheet({ open, onOpenChange, initialFilters, onApply }: FiltersSheetProps) {
  const [f, setF] = useState<FilterState>(initialFilters);

  useEffect(() => {
    if (open) setF(initialFilters);
  }, [open, initialFilters]);

  const priceOptions = f.listingType === "rent" ? RENT_PRICES : SALE_PRICES;

  const togglePropertyType = (v: string) => {
    setF((prev) => ({
      ...prev,
      propertyTypes: prev.propertyTypes.includes(v)
        ? prev.propertyTypes.filter((t) => t !== v)
        : [...prev.propertyTypes, v],
    }));
  };

  const toggleFeature = (v: string) => {
    setF((prev) => ({
      ...prev,
      features: prev.features.includes(v)
        ? prev.features.filter((t) => t !== v)
        : [...prev.features, v],
    }));
  };

  const handleApply = () => {
    onApply(f);
    onOpenChange(false);
  };

  const handleClear = () => {
    const cleared = { ...EMPTY_FILTERS, listingType: f.listingType };
    setF(cleared);
  };

  const activeFilterCount =
    (f.propertyTypes.length > 0 ? 1 : 0) +
    (f.minPrice || f.maxPrice ? 1 : 0) +
    (f.minBeds || f.maxBeds ? 1 : 0) +
    (f.minBaths ? 1 : 0) +
    (f.features.length > 0 ? 1 : 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Panel */}
      <div className="relative bg-white w-full md:max-w-2xl md:rounded-2xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Filters</h2>
          <button onClick={() => onOpenChange(false)} className="p-1 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Listing type tabs inside sheet */}
        <div className="flex border-b shrink-0">
          {["sale", "rent", "sold"].map((t) => (
            <button
              key={t}
              onClick={() => setF({ ...f, listingType: t, minPrice: "", maxPrice: "" })}
              className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors border-b-2 ${
                f.listingType === t
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t === "sale" ? "Buy" : t === "rent" ? "Rent" : "Sold"}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

          {/* Property type */}
          <section>
            <h3 className="text-base font-bold text-gray-900 mb-4">Property type</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {[
                { value: "__all__", label: "All types" },
                ...PROPERTY_TYPES,
              ].map((pt) => (
                <label key={pt.value} className="flex items-center gap-3 cursor-pointer text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={
                      pt.value === "__all__"
                        ? f.propertyTypes.length === 0
                        : f.propertyTypes.includes(pt.value)
                    }
                    onChange={() => {
                      if (pt.value === "__all__") {
                        setF({ ...f, propertyTypes: [] });
                      } else {
                        togglePropertyType(pt.value);
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 accent-primary"
                  />
                  {pt.label}
                </label>
              ))}
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* Price */}
          <section>
            <h3 className="text-base font-bold text-gray-900 mb-4">Price</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Min</p>
                <Dropdown
                  value={f.minPrice}
                  onChange={(v) => setF({ ...f, minPrice: v })}
                  options={priceOptions}
                />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Max</p>
                <Dropdown
                  value={f.maxPrice}
                  onChange={(v) => setF({ ...f, maxPrice: v })}
                  options={priceOptions}
                />
              </div>
            </div>
            <label className="flex items-center gap-3 mt-4 cursor-pointer text-sm text-gray-800">
              <input
                type="checkbox"
                checked={f.onlyWithPrice}
                onChange={() => setF({ ...f, onlyWithPrice: !f.onlyWithPrice })}
                className="w-4 h-4 rounded border-gray-300 accent-primary"
              />
              Only show properties with a price
            </label>
          </section>

          <hr className="border-gray-100" />

          {/* Bedrooms */}
          <section>
            <h3 className="text-base font-bold text-gray-900 mb-4">Bedrooms</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Min</p>
                <Dropdown value={f.minBeds} onChange={(v) => setF({ ...f, minBeds: v })} options={BED_OPTIONS} />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Max</p>
                <Dropdown value={f.maxBeds} onChange={(v) => setF({ ...f, maxBeds: v })} options={BED_OPTIONS} />
              </div>
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* Bathrooms */}
          <section>
            <h3 className="text-base font-bold text-gray-900 mb-4">Bathrooms</h3>
            <div className="w-1/2 pr-2">
              <p className="text-sm text-gray-600 mb-2">Min</p>
              <Dropdown value={f.minBaths} onChange={(v) => setF({ ...f, minBaths: v })} options={BED_OPTIONS} />
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* Outdoor features */}
          <section>
            <h3 className="text-base font-bold text-gray-900 mb-4">Outdoor features</h3>
            <ExpandableSection
              visible={OUTDOOR_FEATURES}
              extra={OUTDOOR_EXTRA}
              features={f.features}
              onToggle={toggleFeature}
              label="outdoor features"
            />
          </section>

          <hr className="border-gray-100" />

          {/* Indoor features */}
          <section>
            <h3 className="text-base font-bold text-gray-900 mb-4">Indoor features</h3>
            <ExpandableSection
              visible={INDOOR_FEATURES}
              extra={INDOOR_EXTRA}
              features={f.features}
              onToggle={toggleFeature}
              label="indoor features"
            />
          </section>

          <hr className="border-gray-100" />

          {/* Climate control */}
          <section>
            <h3 className="text-base font-bold text-gray-900 mb-4">Climate control & energy</h3>
            <ExpandableSection
              visible={CLIMATE_FEATURES}
              extra={CLIMATE_EXTRA}
              features={f.features}
              onToggle={toggleFeature}
              label="climate control & energy"
            />
          </section>

          {/* bottom padding */}
          <div className="h-4" />
        </div>

        {/* Sticky bottom bar */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-white shrink-0">
          <button onClick={handleClear} className="text-sm font-semibold text-gray-700 hover:underline">
            Clear filters
          </button>
          <Button onClick={handleApply} className="rounded-full px-8">
            Search
          </Button>
        </div>
      </div>
    </div>
  );
}
