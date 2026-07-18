import React, { useState } from 'react';
import { useGetAdminAgencies } from '@workspace/api-client-react';
import { Search, Building2, Users, BarChart3, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function Agencies() {
  const [search, setSearch] = useState('');
  const { data: agencies, isLoading } = useGetAdminAgencies();

  const filtered = (agencies ?? []).filter((a) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Agencies</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All registered branches on the platform</p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">{(agencies ?? []).length} total</Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search agencies…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-muted/40"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agency</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Agents</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-36">Active Listings</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-36">Total Listings</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Total Leads</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-sm text-muted-foreground">No agencies found</td>
                  </tr>
                ) : (
                  filtered.map((a) => (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{a.name}</p>
                            {a.address && <p className="text-xs text-muted-foreground mt-0.5">{a.address}</p>}
                            {a.phone && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" />{a.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          {a.agentCount}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {a.activeListings}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground font-medium">{a.totalListings}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                          <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                          {a.totalLeads}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs capitalize bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                          {a.status ?? 'active'}
                        </Badge>
                      </td>
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
