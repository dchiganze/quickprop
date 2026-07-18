import React, { useState } from 'react';
import { useListProperties, useModerateProperty } from '@workspace/api-client-react';
import { Search, Filter, MoreHorizontal, CheckCircle, EyeOff, Flag, Clock, RotateCcw, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

const STATUS_COLORS: Record<string, string> = {
  public: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  draft: 'bg-muted text-muted-foreground',
  under_offer: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  sold: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  rented: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  archived: 'bg-gray-500/10 text-gray-600',
  withdrawn: 'bg-red-500/10 text-red-700 border-red-500/20',
  internal_only: 'bg-blue-500/10 text-blue-700',
  coming_soon: 'bg-indigo-500/10 text-indigo-700',
  private_listing: 'bg-orange-500/10 text-orange-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`text-xs capitalize border ${STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

export default function Properties() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { data: props, isLoading, refetch } = useListProperties();
  const moderate = useModerateProperty();

  const handleModerate = (id: number, action: string, title: string) => {
    moderate.mutate({ id, data: { action } }, {
      onSuccess: () => {
        toast({ title: `Property ${action}d`, description: title });
        refetch();
      },
      onError: () => toast({ title: 'Action failed', variant: 'destructive' }),
    });
  };

  const filtered = (props ?? []).filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || p.title.toLowerCase().includes(q) || p.suburb.toLowerCase().includes(q) || p.city.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Properties</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and moderate all platform listings</p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">{(props ?? []).length} total</Badge>
      </div>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, suburb, ref…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 bg-muted/40"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="under_offer">Under offer</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
                <SelectItem value="internal_only">Internal only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Ref</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-24">Price</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-24">Views</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground w-16">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground text-sm">
                      No properties match your filters
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.reference}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground truncate max-w-xs">{p.title}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{p.suburb}, {p.city}</td>
                      <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{p.propertyType}</td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground">
                        {p.currency} {Number(p.price).toLocaleString()}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{p.views}</td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => handleModerate(p.id, 'approve', p.title)} className="gap-2">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleModerate(p.id, 'hide', p.title)} className="gap-2">
                              <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> Hide
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleModerate(p.id, 'flag', p.title)} className="gap-2">
                              <Flag className="w-3.5 h-3.5 text-amber-600" /> Flag for review
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleModerate(p.id, 'expire', p.title)} className="gap-2">
                              <Clock className="w-3.5 h-3.5 text-orange-600" /> Expire
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleModerate(p.id, 'restore', p.title)} className="gap-2">
                              <RotateCcw className="w-3.5 h-3.5 text-primary" /> Restore
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
