import { useListPublicProperties } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PropertyCard } from "@/components/property-card";
import { useLocation, useSearch } from "wouter";
import { useEffect, useState } from "react";
import { Loader2, Search as SearchIcon, SlidersHorizontal, MapPin } from "lucide-react";
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
    sort: "-createdAt",
    page: 1,
  });

  useEffect(() => {
    const p = new URLSearchParams(searchParams);
    setParams({
      listingType: p.get("listingType") || "",
      propertyType: p.get("propertyType") || "",
      q: p.get("q") || p.get("suburb") || "",
      minPrice: p.get("minPrice") || "",
      maxPrice: p.get("maxPrice") || "",
      minBeds: p.get("minBeds") || "",
      sort: p.get("sort") || "-createdAt",
      page: parseInt(p.get("page") || "1"),
    });
  }, [searchParams]);

  const updateParam = (key: string, value: string | number) => {
    const newParams = { ...params, [key]: value, page: 1 }; // reset page on filter change
    setParams(newParams);
    
    const search = new URLSearchParams();
    Object.entries(newParams).forEach(([k, v]) => {
      if (v) search.set(k, String(v));
    });
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
      <div className="bg-white border-b sticky top-16 z-40 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 flex items-center border rounded-md px-3 bg-gray-50 focus-within:ring-2 focus-within:ring-primary">
              <MapPin className="h-4 w-4 text-gray-400 mr-2" />
              <Input 
                placeholder="Search location, suburb or keyword..." 
                className="border-0 bg-transparent shadow-none px-0"
                value={params.q}
                onChange={(e) => updateParam("q", e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:w-[800px]">
              <Select value={params.listingType} onValueChange={(v) => updateParam("listingType", v === "any" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Buy / Rent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Status</SelectItem>
                  <SelectItem value="sale">For Sale</SelectItem>
                  <SelectItem value="rent">To Rent</SelectItem>
                </SelectContent>
              </Select>

              <Select value={params.propertyType} onValueChange={(v) => updateParam("propertyType", v === "any" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Property Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Type</SelectItem>
                  <SelectItem value="house">House</SelectItem>
                  <SelectItem value="apartment">Apartment</SelectItem>
                  <SelectItem value="townhouse">Townhouse</SelectItem>
                  <SelectItem value="stand">Stand / Land</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                </SelectContent>
              </Select>

              <Select value={params.minBeds} onValueChange={(v) => updateParam("minBeds", v === "any" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Bedrooms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Beds</SelectItem>
                  <SelectItem value="1">1+ Bedrooms</SelectItem>
                  <SelectItem value="2">2+ Bedrooms</SelectItem>
                  <SelectItem value="3">3+ Bedrooms</SelectItem>
                  <SelectItem value="4">4+ Bedrooms</SelectItem>
                  <SelectItem value="5">5+ Bedrooms</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={params.sort} onValueChange={(v) => updateParam("sort", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-createdAt">Newest First</SelectItem>
                  <SelectItem value="price">Price: Low to High</SelectItem>
                  <SelectItem value="-price">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            {isLoading ? "Searching..." : `${data?.total || 0} Properties Found`}
          </h1>
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
            <p className="text-gray-500 mb-6">Try adjusting your search filters to find what you're looking for.</p>
            <Button variant="outline" onClick={() => {
              setParams({ ...params, propertyType: "", listingType: "", q: "", minBeds: "", minPrice: "", maxPrice: "" });
              setLocation("/search");
            }}>
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
