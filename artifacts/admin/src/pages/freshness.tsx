import React, { useState } from 'react';
import { useGetAdminFreshness, useModerateProperty } from '@workspace/api-client-react';
import { Clock, AlertTriangle, AlertCircle, RotateCcw, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

function FreshnessTable({ entries, severity, onAction, isPending }: {
  entries: any[]; severity: 'warn' | 'critical' | 'danger';
  onAction: (id: number, action: string, title: string) => void;
  isPending: boolean;
}) {
  const cfg = {
    warn: { label: '30–60 days stale', color: 'text-amber-700', badge: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
    critical: { label: '60–90 days stale', color: 'text-orange-700', badge: 'bg-orange-500/10 text-orange-700 border-orange-500/20' },
    danger: { label: '90+ days stale', color: 'text-red-700', badge: 'bg-red-500/10 text-red-700 border-red-500/20' },
  }[severity];

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No listings in this category ✓
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Listing</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Location</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Status</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Days stale</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-32">Last updated</th>
            <th className="text-right px-4 py-2.5 w-36" />
          </tr>
        </thead>
        <tbody>
          {entries.map((e: any) => (
            <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-foreground truncate max-w-xs">{e.title}</p>
                <p className="text-xs font-mono text-muted-foreground">{e.reference}</p>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{e.suburb}, {e.city}</td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="text-xs capitalize">{e.status?.replace('_', ' ')}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className={`text-xs border ${cfg.badge}`}>
                  {e.daysStale}d
                </Badge>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {e.updatedAt ? new Date(e.updatedAt).toLocaleDateString() : '—'}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    disabled={isPending}
                    onClick={() => onAction(e.id, 'expire', e.title)}
                  >
                    <EyeOff className="w-3 h-3" /> Expire
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    disabled={isPending}
                    onClick={() => onAction(e.id, 'restore', e.title)}
                  >
                    <RotateCcw className="w-3 h-3" /> Restore
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Freshness() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useGetAdminFreshness();
  const moderate = useModerateProperty();

  const handleAction = (id: number, action: string, title: string) => {
    moderate.mutate({ id, data: { action } }, {
      onSuccess: () => { toast({ title: `Listing ${action}d`, description: title }); refetch(); },
      onError: () => toast({ title: 'Action failed', variant: 'destructive' }),
    });
  };

  const total30 = (data?.stale30 ?? []).length;
  const total60 = (data?.stale60 ?? []).length;
  const total90 = (data?.stale90 ?? []).length;

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Freshness Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Listings that haven't been updated recently</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              {isLoading ? <Skeleton className="h-7 w-12 mb-1" /> : <p className="text-2xl font-bold text-foreground">{total30}</p>}
              <p className="text-xs text-muted-foreground">30–60 days stale</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              {isLoading ? <Skeleton className="h-7 w-12 mb-1" /> : <p className="text-2xl font-bold text-foreground">{total60}</p>}
              <p className="text-xs text-muted-foreground">60–90 days stale</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              {isLoading ? <Skeleton className="h-7 w-12 mb-1" /> : <p className="text-2xl font-bold text-foreground">{total90}</p>}
              <p className="text-xs text-muted-foreground">90+ days stale</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 30-60 day stale */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" /> 30–60 Days Stale
          </CardTitle>
          <CardDescription>Needs a nudge — contact agents to refresh</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <Skeleton className="h-32 m-4" /> : (
            <FreshnessTable entries={data?.stale30 ?? []} severity="warn" onAction={handleAction} isPending={moderate.isPending} />
          )}
        </CardContent>
      </Card>

      {/* 60-90 day stale */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" /> 60–90 Days Stale
          </CardTitle>
          <CardDescription>Overdue for an update — consider expiring if unresponsive</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <Skeleton className="h-32 m-4" /> : (
            <FreshnessTable entries={data?.stale60 ?? []} severity="critical" onAction={handleAction} isPending={moderate.isPending} />
          )}
        </CardContent>
      </Card>

      {/* 90+ day stale */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" /> 90+ Days Stale
          </CardTitle>
          <CardDescription>Strongly consider expiring — these listings harm marketplace quality</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <Skeleton className="h-32 m-4" /> : (
            <FreshnessTable entries={data?.stale90 ?? []} severity="danger" onAction={handleAction} isPending={moderate.isPending} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
