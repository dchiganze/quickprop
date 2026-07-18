import React from 'react';
import { useGetAdminCoverage } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

function CoverageBar({ label, actual, estimated, percent }: { label: string; actual: number; estimated: number; percent: number }) {
  const color =
    percent >= 70 ? 'bg-emerald-500' :
    percent >= 40 ? 'bg-amber-500' :
    'bg-red-500';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{actual} / ~{estimated} listings</span>
          <Badge
            variant="outline"
            className={`text-xs w-12 text-center justify-center ${
              percent >= 70 ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' :
              percent >= 40 ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' :
              'bg-red-500/10 text-red-700 border-red-500/20'
            }`}
          >
            {percent}%
          </Badge>
        </div>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

export default function Coverage() {
  const { data, isLoading } = useGetAdminCoverage();

  const cityTotal = data?.cities?.reduce((s, c) => s + c.actual, 0) ?? 0;
  const cityEstimated = data?.cities?.reduce((s, c) => s + c.estimated, 0) ?? 0;
  const overallPercent = cityEstimated > 0 ? Math.round((cityTotal / cityEstimated) * 100) : 0;

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
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Total Listings</p>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <p className="text-3xl font-bold text-foreground">{cityTotal.toLocaleString()}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Est. Market Size</p>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <p className="text-3xl font-bold text-foreground">{cityEstimated.toLocaleString()}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Overall Coverage</p>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <p className={`text-3xl font-bold ${overallPercent >= 70 ? 'text-emerald-600' : overallPercent >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                {overallPercent}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* City coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coverage by City</CardTitle>
          <CardDescription>Estimated vs actual active listings per major city</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
            : (data?.cities ?? []).map((c) => (
                <CoverageBar key={c.city} label={c.city} actual={c.actual} estimated={c.estimated} percent={c.percent} />
              ))
          }
        </CardContent>
      </Card>

      {/* Suburb coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Suburbs by Listing Count</CardTitle>
          <CardDescription>Top 20 most covered suburbs (of estimated 50 per suburb)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading
            ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)
            : (data?.suburbs ?? []).map((s) => (
                <CoverageBar
                  key={`${s.city}-${s.suburb}`}
                  label={`${s.suburb} (${s.city})`}
                  actual={s.actual}
                  estimated={s.estimated}
                  percent={s.percent}
                />
              ))
          }
        </CardContent>
      </Card>
    </div>
  );
}
