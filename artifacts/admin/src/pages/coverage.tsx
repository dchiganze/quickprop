import React from 'react';
import { useGetAdminCoverage } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
function ListingCountRow({ label, actual }: { label: string; actual: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 py-3 last:border-0">
      <span className="font-medium text-foreground">{label}</span>
      <span className="shrink-0 text-sm text-muted-foreground">{actual.toLocaleString()} public listings</span>
    </div>
  );
}

export default function Coverage() {
  const { data, isLoading } = useGetAdminCoverage();

  const cityTotal = data?.cities?.reduce((sum, city) => sum + city.actual, 0) ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Marketplace Coverage</h1>
        <p className="text-sm text-muted-foreground mt-0.5">How well QuickProp covers each city and suburb</p>
      </div>

      {/* Overall stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Public Listings</p>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <p className="text-3xl font-bold text-foreground">{cityTotal.toLocaleString()}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Cities with Listings</p>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <p className="text-3xl font-bold text-foreground">{data?.cities.length ?? 0}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Suburbs Listed</p>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <p className="text-3xl font-bold text-foreground">{data?.suburbs.length ?? 0}</p>}
          </CardContent>
        </Card>
      </div>

      {/* City coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Public Listings by City</CardTitle>
          <CardDescription>Current public property listings in each city</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />) : (
            data?.cities.length ? data.cities.map((city) => (
              <ListingCountRow key={city.city} label={city.city} actual={city.actual} />
            )) : <p className="py-8 text-center text-sm text-muted-foreground">No public listings yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Suburb coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Suburbs by Listing Count</CardTitle>
          <CardDescription>Suburbs ranked by current public listing count</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />) : (
            data?.suburbs.length ? data.suburbs.map((suburb) => (
              <ListingCountRow key={`${suburb.city}-${suburb.suburb}`} label={`${suburb.suburb} (${suburb.city})`} actual={suburb.actual} />
            )) : <p className="py-8 text-center text-sm text-muted-foreground">No public listings yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
