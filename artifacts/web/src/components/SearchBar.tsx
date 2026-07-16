import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { FiltersSheet, FilterState, EMPTY_FILTERS } from "@/components/FiltersSheet";
import { QuickSearchDialog } from "@/components/QuickSearchDialog";

const TABS = [
  { value: "sale", label: "Buy" },
  { value: "rent", label: "Rent" },
  { value: "sold", label: "Sold" },
  { value: "agents", label: "Agents" },
];

function filtersFromUrl(search: string): FilterState {
  const p = new URLSearchParams(search);
  const lt = p.get("listingType") || "sale";
  const pt = p.get("propertyType");
  const features = p.get("features")?.split(",").filter(Boolean) ?? [];
  return {
    listingType: lt,
    propertyTypes: pt ? [pt] : [],
    minPrice: p.get("minPrice") || "",
    maxPrice: p.get("maxPrice") || "",
    onlyWithPrice: p.get("onlyWithPrice") === "1",
    minBeds: p.get("minBeds") || "",
    maxBeds: p.get("maxBeds") || "",
    minBaths: p.get("minBaths") || "",
    features,
  };
}

function buildUrl(q: string, filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.listingType && filters.listingType !== "sold") {
    params.set("listingType", filters.listingType);
  }
  if (filters.propertyTypes.length === 1) {
    params.set("propertyType", filters.propertyTypes[0]);
  }

  // Combine suburb query with feature keywords
  const parts = [q.trim(), ...filters.features].filter(Boolean);
  if (parts.length > 0) params.set("q", parts.join(" "));

  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.onlyWithPrice) params.set("onlyWithPrice", "1");
  if (filters.minBeds) params.set("minBeds", filters.minBeds);
  if (filters.maxBeds) params.set("maxBeds", filters.maxBeds);
  if (filters.minBaths) params.set("minBaths", filters.minBaths);
  if (filters.features.length > 0) params.set("features", filters.features.join(","));
  return `/search?${params.toString()}`;
}

function activeFilterCount(f: FilterState): number {
  return (
    (f.propertyTypes.length > 0 ? 1 : 0) +
    (f.minPrice || f.maxPrice ? 1 : 0) +
    (f.minBeds || f.maxBeds ? 1 : 0) +
    (f.minBaths ? 1 : 0) +
    (f.features.length > 0 ? f.features.length : 0)
  );
}

interface SearchBarProps {
  /** compact = true on search results page (fits in sticky header) */
  compact?: boolean;
}

export function SearchBar({ compact = false }: SearchBarProps) {
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from URL on mount and when URL changes
  useEffect(() => {
    const p = new URLSearchParams(searchString);
    // q in URL might include features — show only suburb portion (before feature keywords)
    // We store features separately so just show the raw q
    const rawQ = p.get("q") || "";
    const featuresFromUrl = p.get("features")?.split(",").filter(Boolean) ?? [];
    // Strip feature keywords from q for display
    let displayQ = rawQ;
    featuresFromUrl.forEach((feat) => {
      displayQ = displayQ.replace(feat, "").trim();
    });
    setQ(displayQ);
    setFilters(filtersFromUrl(searchString));
  }, [searchString]);

  const handleSearch = () => {
    const url = buildUrl(q, filters);
    setLocation(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleTabClick = (tab: string) => {
    if (tab === "agents") { setLocation("/agents"); return; }
    const newFilters = { ...filters, listingType: tab, minPrice: "", maxPrice: "" };
    setFilters(newFilters);
    // If on search page, update URL immediately
    if (searchString !== "") {
      setLocation(buildUrl(q, newFilters));
    }
  };

  const handleFiltersApply = (newFilters: FilterState) => {
    setFilters(newFilters);
    setLocation(buildUrl(q, newFilters));
  };

  const count = activeFilterCount(filters);
  const activeTab = TABS.find((t) => t.value === filters.listingType)?.value ?? "sale";

  return (
    <>
      <FiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        initialFilters={filters}
        onApply={handleFiltersApply}
      />
      <QuickSearchDialog open={quickSearchOpen} onOpenChange={setQuickSearchOpen} />

      <div className={compact ? "" : "w-full"}>
        {/* Tab row */}
        <div className={`flex border-b border-gray-200 ${compact ? "bg-white" : "bg-white/95"}`}>
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabClick(tab.value)}
              className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === tab.value
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search row */}
        <div className={`flex items-center gap-3 ${compact ? "py-3 px-0" : "py-4"}`}>
          {/* Search input */}
          <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-full px-4 py-2.5 bg-white focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all shadow-sm">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search suburb, postcode or area"
              className="flex-1 text-sm text-gray-800 placeholder:text-gray-400 outline-none bg-transparent"
            />
          </div>

          {/* Filters pill */}
          <button
            onClick={() => setFiltersOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all shadow-sm whitespace-nowrap"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {count > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold">
                {count}
              </span>
            )}
          </button>

          {/* Search button */}
          <button
            onClick={handleSearch}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all shadow-sm whitespace-nowrap"
          >
            <Search className="h-4 w-4" />
            Search
          </button>

          {/* Quick search */}
          <button
            onClick={() => setQuickSearchOpen(true)}
            title="Quick search with AI"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-full border border-primary/30 bg-emerald-50 text-primary text-sm font-medium hover:bg-emerald-100 transition-all shadow-sm whitespace-nowrap"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Quick search</span>
          </button>
        </div>
      </div>
    </>
  );
}
