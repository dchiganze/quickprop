import React, { useState } from 'react';
import { useGetAdminAgents, useUpdateUser } from '@workspace/api-client-react';
import { Search, UserCheck, Building2, MoreHorizontal, ShieldOff, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

const ROLE_COLORS: Record<string, string> = {
  principal: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  senior_agent: 'bg-primary/10 text-primary border-primary/20',
  agent: 'bg-muted text-muted-foreground',
};

export default function Agents() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const { data: agents, isLoading, refetch } = useGetAdminAgents();
  const updateUser = useUpdateUser();

  const filtered = (agents ?? []).filter((a) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase()) ||
    (a.branchName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (id: number, current: string, name: string) => {
    const newStatus = current === 'active' ? 'suspended' : 'active';
    updateUser.mutate({ id, data: { status: newStatus } }, {
      onSuccess: () => { toast({ title: `${name} ${newStatus}` }); refetch(); },
      onError: () => toast({ title: 'Failed', variant: 'destructive' }),
    });
  };

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Agents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All registered estate agents and principals</p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">{(agents ?? []).length} agents</Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search agents…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-muted/40" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agent</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agency</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Active</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Leads</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground w-16" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-muted-foreground">No agents found</td></tr>
                ) : (
                  filtered.map((a) => {
                    const initials = a.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
                    return (
                      <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8 flex-shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">{a.name}</p>
                              <p className="text-xs text-muted-foreground">{a.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-xs capitalize border ${ROLE_COLORS[a.role] ?? ''}`}>
                            {a.role.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Building2 className="w-3.5 h-3.5" />
                            {a.branchName ?? '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-emerald-700">{a.activeListings}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{a.totalListings}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{a.totalLeads}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-xs capitalize ${a.status === 'active' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' : 'bg-red-500/10 text-red-700 border-red-500/20'}`}>
                            {a.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {a.status === 'active' ? (
                                <DropdownMenuItem onClick={() => handleToggle(a.id, a.status, a.name)} className="gap-2 text-destructive">
                                  <ShieldOff className="w-3.5 h-3.5" /> Suspend
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleToggle(a.id, a.status, a.name)} className="gap-2 text-emerald-700">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Activate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
