import React, { useState } from 'react';
import { useListAuditLog } from '@workspace/api-client-react';
import { Search, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  update: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  delete: 'bg-red-500/10 text-red-700 border-red-500/20',
  approve: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  hide: 'bg-muted text-muted-foreground',
  flag: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  expire: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  restore: 'bg-primary/10 text-primary border-primary/20',
  login: 'bg-muted text-muted-foreground',
  logout: 'bg-muted text-muted-foreground',
};

export default function Audit() {
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const { data: entries, isLoading } = useListAuditLog();

  const filtered = (entries ?? []).filter((e: any) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (e.action ?? '').toLowerCase().includes(q) ||
      (e.entityType ?? '').toLowerCase().includes(q) ||
      (e.detail ?? '').toLowerCase().includes(q) ||
      (e.userName ?? '').toLowerCase().includes(q);
    const matchEntity = entityFilter === 'all' || e.entityType === entityFilter;
    return matchSearch && matchEntity;
  });

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Complete record of every platform action</p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">{(entries ?? []).length} entries</Badge>
      </div>

      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3 space-y-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search action, user, detail…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-muted/40"
            />
          </div>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="All entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              <SelectItem value="property">Property</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="branch">Branch</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="buyer">Buyer</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-36">Timestamp</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Entity type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-20">Entity ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Detail</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-36">User</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-sm text-muted-foreground">
                      <Shield className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
                      No audit entries found
                    </td>
                  </tr>
                ) : (
                  filtered.map((e: any, i: number) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs capitalize border ${ACTION_COLORS[e.action] ?? 'bg-muted text-muted-foreground'}`}>
                          {e.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{e.entityType ?? '—'}</td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{e.entityId ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-foreground max-w-md truncate">{e.detail ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{e.userName ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
