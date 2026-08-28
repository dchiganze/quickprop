import { useListPublicProperties } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PropertyCard } from "@/components/property-card";
import { SearchBar } from "@/components/SearchBar";
import { useLocation, useSearch } from "wouter";
import { useEffect, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Search() {
  const searchParams = useSearch();
  const [, setLocation] = useLocation();

  const [params, setParams] = useState({
    listingType: "",
    propertyType: "",
    q: "",
    minPrice: "",
    maxPrice: "",
    minBeds: "",
    maxBeds: "",
    minBaths: "",
    sort: "newest",
    page: 1,
  });

  useEffect(() => {
    const p = new URLSearchParams(searchParams);
    setParams({
      listingType: p.get("listingType") || "",
      propertyType: p.get("propertyType") || "",
      q: p.get("q") || "",
      minPrice: p.get("minPrice") || "",
      maxPrice: p.get("maxPrice") || "",
      minBeds: p.get("minBeds") || "",
      maxBeds: p.get("maxBeds") || "",
      minBaths: p.get("minBaths") || "",
      sort: p.get("sort") || "newest",
      page: parseInt(p.get("page") || "1"),
    });
  }, [searchParams]);

  const updateParam = (key: string, value: string | number) => {
    const newParams = { ...params, [key]: value, page: 1 };
    setParams(newParams);
    const search = new URLSearchParams();
    Object.entries(newParams).forEach(([k, v]) => { if (v) search.set(k, String(v)); });
    setLocation(`/search?${search.toString()}`);
  };

  const { data, isLoading } = useListPublicProperties({
    listingType: params.listingType || undefined,
    propertyType: params.propertyType || undefined,
    q: params.q || undefined,
    minPrice: params.minPrice ? parseInt(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? parseInt(params.maxPrice) : undefined,
    minBeds: params.minBeds ? parseInt(params.minBeds) : undefined,
    sort: params.sort,
    page: params.page,
    limit: 12,
  });

  return (
    <Layout>
      {/* Sticky search bar */}
      <div className="bg-white border-b sticky top-16 z-40 shadow-sm">
        <div className="container mx-auto px-4">
          <SearchBar compact />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Results header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            {isLoading ? "Searching…" : `${(data?.total ?? 0).toLocaleString()} ${data?.total === 1 ? "Property" : "Properties"} Found`}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 hidden sm:inline">Sort by</span>
            <Select value={params.sort} onValueChange={(v) => updateParam("sort", v)}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="price_asc">Price: Low → High</SelectItem>
                <SelectItem value="price_desc">Price: High → Low</SelectItem>
                <SelectItem value="freshness">Recently verified</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : data?.properties.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <SearchIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No properties found</h3>
            <p className="text-gray-500 mb-6">Try adjusting your search filters or use Quick Search to describe what you want.</p>
            <Button variant="outline" onClick={() => setLocation("/search")}>
              Clear all filters
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {data?.properties.map(property => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>

            {data && data.total > data.limit && (
              <div className="mt-12 flex justify-center gap-2">
                <Button
                  variant="outline"
                  disabled={params.page <= 1}
                  onClick={() => updateParam("page", params.page - 1)}
                >
                  Previous
                </Button>
                <div className="flex items-center justify-center px-4 font-medium text-sm text-gray-600">
                  Page {params.page} of {Math.ceil(data.total / data.limit)}
                </div>
                <Button
                  variant="outline"
                  disabled={params.page >= Math.ceil(data.total / data.limit)}
                  onClick={() => updateParam("page", params.page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
