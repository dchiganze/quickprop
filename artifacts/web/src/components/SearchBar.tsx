import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { MapPin, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { FiltersSheet, FilterState, EMPTY_FILTERS } from "@/components/FiltersSheet";
import { QuickSearchDialog } from "@/components/QuickSearchDialog";
import { ZIMBABWE_LOCATIONS } from "@/data/zimbabwe-suburbs";

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

function buildUrl(q: string, filters: FilterState, suburbs: string[] = []): string {
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
  if (suburbs.length > 0) params.set("suburb", suburbs.join(","));

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
  const [selectedSuburbs, setSelectedSuburbs] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [locationSuggestionsOpen, setLocationSuggestionsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from URL on mount and when URL changes
  useEffect(() => {
    const p = new URLSearchParams(searchString);
    // q in URL might include features — show only suburb portion (before feature keywords)
    // We store features separately so just show the raw q
    const rawQ = p.get("q") || "";
    const rawSuburbs = (p.get("suburb") || "")
      .split(",")
      .map((suburb) => suburb.trim())
      .filter(Boolean);
    const featuresFromUrl = p.get("features")?.split(",").filter(Boolean) ?? [];
    // Strip feature keywords from q for display
    let displayQ = rawQ;
    featuresFromUrl.forEach((feat) => {
      displayQ = displayQ.replace(feat, "").trim();
    });
    setSelectedSuburbs(rawSuburbs);
    setQ(rawSuburbs.length > 0 ? "" : displayQ);
    setFilters(filtersFromUrl(searchString));
  }, [searchString]);

  const handleSearch = () => {
    const url = buildUrl(q, filters, selectedSuburbs);
    setLocationSuggestionsOpen(false);
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
      setLocation(buildUrl(q, newFilters, selectedSuburbs));
    }
  };

  const handleFiltersApply = (newFilters: FilterState) => {
    setFilters(newFilters);
    setLocation(buildUrl(q, newFilters, selectedSuburbs));
  };

  const locationSuggestions = useMemo(() => {
    const query = q.trim().toLocaleLowerCase();
    const matching = query
      ? ZIMBABWE_LOCATIONS.filter(
          (location) =>
            !selectedSuburbs.includes(location) &&
            location.toLocaleLowerCase().includes(query),
        )
      : ZIMBABWE_LOCATIONS.filter((location) => !selectedSuburbs.includes(location));
    return matching.slice(0, 8);
  }, [q, selectedSuburbs]);

  const selectSuburb = (suburb: string) => {
    setSelectedSuburbs((current) =>
      current.includes(suburb) ? current : [...current, suburb],
    );
    setQ("");
    setLocationSuggestionsOpen(true);
    inputRef.current?.focus();
  };

  const clearSelectedSuburb = (suburbToRemove: string) => {
    setSelectedSuburbs((current) => current.filter((suburb) => suburb !== suburbToRemove));
    setLocationSuggestionsOpen(true);
    inputRef.current?.focus();
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
        <div className={`flex flex-wrap border-b border-gray-200 ${compact ? "bg-white" : "bg-white/95"}`}>
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabClick(tab.value)}
                className={`shrink-0 px-4 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px sm:px-5 ${
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
        <div className={`flex flex-wrap items-center gap-2 px-2 sm:gap-3 sm:px-3 ${compact ? "py-3" : "py-4"}`}>
          {/* Search input */}
          <div className="relative min-w-0 basis-full sm:basis-auto sm:flex-1">
            <div className="flex min-h-[44px] flex-wrap items-center gap-2 border border-gray-200 rounded-full px-4 py-2.5 bg-white focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all shadow-sm">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              {selectedSuburbs.map((suburb) => (
                <span key={suburb} className="inline-flex max-w-[30%] shrink-0 items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="truncate">{suburb}</span>
                  <button
                    type="button"
                    onClick={() => clearSelectedSuburb(suburb)}
                    aria-label={`Remove ${suburb}`}
                    className="ml-0.5 rounded-full p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setLocationSuggestionsOpen(true);
                }}
                onFocus={() => setLocationSuggestionsOpen(true)}
                onBlur={() => window.setTimeout(() => setLocationSuggestionsOpen(false), 150)}
                onKeyDown={handleKeyDown}
                placeholder={selectedSuburbs.length > 0 ? "Add another suburb or area" : "Search suburb or area"}
                className="min-w-0 flex-1 text-sm text-gray-800 placeholder:text-gray-400 outline-none bg-transparent"
              />
            </div>
            {locationSuggestionsOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Zimbabwe locations
                </p>
                {locationSuggestions.length > 0 ? (
                  locationSuggestions.map((suburb) => (
                    <button
                      key={suburb}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectSuburb(suburb)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-emerald-50 hover:text-primary"
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                      {suburb}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-gray-500">No matching location found. Press Enter to search this area.</p>
                )}
              </div>
            )}
          </div>

          {/* Filters pill */}
          <button
            onClick={() => setFiltersOpen(true)}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 px-3 py-2.5 rounded-full border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all shadow-sm whitespace-nowrap sm:flex-none sm:px-4"
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
            className="flex min-w-0 flex-1 items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all shadow-sm whitespace-nowrap sm:flex-none sm:px-6"
          >
            <Search className="h-4 w-4" />
            Search
          </button>

          {/* Quick search */}
          <button
            onClick={() => setQuickSearchOpen(true)}
            title="Quick search with AI"
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2.5 rounded-full border border-primary/30 bg-emerald-50 text-primary text-sm font-medium hover:bg-emerald-100 transition-all shadow-sm whitespace-nowrap sm:flex-none sm:flex-row sm:gap-1.5 sm:px-3"
          >
            <Sparkles className="hidden h-4 w-4 sm:block" />
            <span className="text-center leading-[1.05] sm:hidden">Quick<br />Search</span>
            <span className="hidden sm:inline">Quick search</span>
          </button>
        </div>
      </div>
    </>
  );
}
