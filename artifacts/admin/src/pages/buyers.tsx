import React, { useState } from 'react';
import { useListBuyers, useUpdateBuyer } from '@workspace/api-client-react';
import { Search, MoreHorizontal, ShieldOff, ShieldCheck, Mail, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

export default function Buyers() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const { data: buyers, isLoading, refetch } = useListBuyers();
  const updateBuyer = useUpdateBuyer();

  const filtered = (buyers ?? []).filter((b) =>
    !search || b.name.toLowerCase().includes(search.toLowerCase()) || (b.email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (id: number, current: string, name: string) => {
    // Buyers don't have a status field in BuyerUpdate — log a note action instead
    toast({ title: `${name} — account management coming soon` });
  };

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Buyers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Registered buyer accounts on the marketplace</p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">{(buyers ?? []).length} total</Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search buyers…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-muted/40" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Buyer</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Budget</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Joined</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground w-16" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-16 text-center text-sm text-muted-foreground">No buyers found</td></tr>
                ) : (
                  filtered.map((b) => {
                    const initials = b.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                    const status = (b as any).status ?? 'active';
                    return (
                      <tr key={b.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="bg-amber-500/10 text-amber-700 text-xs font-semibold">{initials}</AvatarFallback>
                            </Avatar>
                            <p className="font-medium text-foreground">{b.name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="w-3 h-3" />{b.email}
                            </div>
                            {b.phone && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="w-3 h-3" />{b.phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {(b as any).budgetMax ? `$${Number((b as any).budgetMax).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {(b as any).createdAt ? new Date((b as any).createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-xs capitalize ${status === 'active' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' : 'bg-red-500/10 text-red-700 border-red-500/20'}`}>
                            {status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {status === 'active' ? (
                                <DropdownMenuItem onClick={() => handleToggle(b.id, status, b.name)} className="gap-2 text-destructive">
                                  <ShieldOff className="w-3.5 h-3.5" /> Disable account
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleToggle(b.id, status, b.name)} className="gap-2 text-emerald-700">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Enable account
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
