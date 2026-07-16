import React, { useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListBuyers,
  useCreateBuyer,
  useGetBuyerMatches,
  getListBuyersQueryKey,
  getGetBuyerMatchesQueryKey,
  Buyer,
} from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Search, Plus, User, Phone, Mail, Home, MapPin, Sparkles, ArrowUpRight } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

function MatchesDialog({ buyer }: { buyer: Buyer }) {
  const [open, setOpen] = useState(false);
  const { data: matches, isLoading } = useGetBuyerMatches(buyer.id, {
    query: { enabled: open, queryKey: getGetBuyerMatchesQueryKey(buyer.id) },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto" data-testid={`button-view-matches-${buyer.id}`}>
          View Matches
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Property Matches for {buyer.name}
          </DialogTitle>
          <DialogDescription>
            Ranked against budget, preferred areas, property type and features.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          ) : !matches || matches.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Home className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-semibold text-foreground">No matches in current inventory</p>
              <p className="text-sm text-muted-foreground">New mandates matching this buyer will appear here.</p>
            </div>
          ) : (
            matches.map((m) => (
              <Card key={m.property.id} className="overflow-hidden" data-testid={`card-match-${m.property.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-muted-foreground">{m.property.reference}</span>
                        <Badge variant="secondary" className="capitalize text-[10px]">{m.property.status.replace(/_/g, ' ')}</Badge>
                      </div>
                      <Link href={`/property/${m.property.id}`} className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1">
                        {m.property.title}
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                      </Link>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.property.suburb}</span>
                        <span className="font-semibold text-foreground">{m.property.currency} {m.property.price.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 w-28">
                      <div className="text-2xl font-bold text-primary">{m.matchPercent}%</div>
                      <Progress value={m.matchPercent} className="h-1.5 mt-1" />
                    </div>
                  </div>
                  {m.reasons.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {m.reasons.map((r, i) => (
                        <li key={i} className="text-[11px] bg-primary/5 text-primary border border-primary/15 rounded px-1.5 py-0.5">{r}</li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddBuyerDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', budgetMin: '', budgetMax: '', preferredAreas: '',
    propertyType: 'house', bedroomsMin: '', financing: 'cash', urgency: 'warm',
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createBuyer = useCreateBuyer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBuyersQueryKey() });
        toast({ title: 'Buyer added' });
        setOpen(false);
        setForm({ name: '', phone: '', email: '', budgetMin: '', budgetMax: '', preferredAreas: '', propertyType: 'house', bedroomsMin: '', financing: 'cash', urgency: 'warm' });
      },
      onError: () => toast({ title: 'Could not add buyer', variant: 'destructive' }),
    },
  });

  const submit = () => {
    if (!form.name) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    createBuyer.mutate({
      data: {
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        budgetMin: form.budgetMin ? Number(form.budgetMin) : undefined,
        budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
        preferredAreas: form.preferredAreas
          ? form.preferredAreas.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        propertyType: form.propertyType,
        bedroomsMin: form.bedroomsMin ? Number(form.bedroomsMin) : undefined,
        financing: form.financing,
        urgency: form.urgency,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shrink-0 shadow-sm" data-testid="button-add-buyer">
          <Plus className="w-4 h-4 mr-2" />
          Add Buyer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Buyer</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="b-name">Name</Label>
            <Input id="b-name" data-testid="input-buyer-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="b-phone">Phone</Label>
              <Input id="b-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="b-email">Email</Label>
              <Input id="b-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="b-bmin">Budget Min (USD)</Label>
              <Input id="b-bmin" type="number" value={form.budgetMin} onChange={(e) => setForm({ ...form, budgetMin: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="b-bmax">Budget Max (USD)</Label>
              <Input id="b-bmax" type="number" value={form.budgetMax} onChange={(e) => setForm({ ...form, budgetMax: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="b-areas">Preferred Areas (comma-separated)</Label>
            <Input id="b-areas" placeholder="e.g. Borrowdale, Highlands" value={form.preferredAreas} onChange={(e) => setForm({ ...form, preferredAreas: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Property Type</Label>
              <Select value={form.propertyType} onValueChange={(v) => setForm({ ...form, propertyType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['house', 'apartment', 'townhouse', 'stand', 'commercial', 'industrial', 'farm'].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="b-beds">Min Bedrooms</Label>
              <Input id="b-beds" type="number" value={form.bedroomsMin} onChange={(e) => setForm({ ...form, bedroomsMin: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Financing</Label>
              <Select value={form.financing} onValueChange={(v) => setForm({ ...form, financing: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mortgage">Mortgage</SelectItem>
                  <SelectItem value="diaspora">Diaspora</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Urgency</Label>
              <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot">Hot</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="cold">Cold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={createBuyer.isPending} data-testid="button-save-buyer">
            {createBuyer.isPending ? 'Adding...' : 'Add Buyer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BuyerRow({ buyer }: { buyer: Buyer }) {
  return (
    <Card className="hover-elevate transition-all group overflow-hidden" data-testid={`card-buyer-${buyer.id}`}>
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">{buyer.name}</h4>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              {buyer.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {buyer.phone}</span>}
              {buyer.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {buyer.email}</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap md:flex-nowrap items-center gap-4 text-sm">
          <div className="w-32">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Budget</div>
            <div className="font-semibold text-foreground">
              {buyer.budgetMin ? `$${(buyer.budgetMin / 1000).toFixed(0)}k` : '$0'} - {buyer.budgetMax ? `$${(buyer.budgetMax / 1000).toFixed(0)}k` : 'Any'}
            </div>
          </div>
          <div className="w-40">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Preferences</div>
            <div className="flex items-center gap-1">
              {buyer.propertyType && <Badge variant="secondary" className="text-[10px] capitalize">{buyer.propertyType.replace('_', ' ')}</Badge>}
              {buyer.bedroomsMin && <span className="text-muted-foreground text-xs">{buyer.bedroomsMin}+ beds</span>}
            </div>
          </div>
          <div className="w-24">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Urgency</div>
            <Badge variant={buyer.urgency === 'hot' ? 'destructive' : buyer.urgency === 'warm' ? 'default' : 'secondary'} className="capitalize">
              {buyer.urgency || 'Cold'}
            </Badge>
          </div>

          <MatchesDialog buyer={buyer} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Buyers() {
  const [search, setSearch] = useState('');
  const { data: buyers, isLoading } = useListBuyers({ q: search || undefined });

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Buyers Database</h1>
          <p className="text-muted-foreground mt-1">Manage active buyers and their matching preferences.</p>
        </div>
        <AddBuyerDialog />
      </div>

      <div className="bg-card p-4 rounded-lg border border-border shadow-sm flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            className="pl-9 bg-muted/50 border-muted-foreground/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : buyers?.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-lg border border-dashed">
            <User className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No buyers found</h3>
            <p className="text-muted-foreground">Try adjusting your search query.</p>
          </div>
        ) : (
          buyers?.map((buyer) => (
            <BuyerRow key={buyer.id} buyer={buyer} />
          ))
        )}
      </div>
    </div>
  );
}
