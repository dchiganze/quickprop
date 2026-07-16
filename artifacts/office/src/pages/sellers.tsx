import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useListSellers, useCreateSeller, getListSellersQueryKey, Seller } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Briefcase, Phone, Mail, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

function AddSellerDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', idNumber: '', phone: '', email: '', postalAddress: '', notes: '' });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createSeller = useCreateSeller({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSellersQueryKey() });
        toast({ title: 'Seller added' });
        setOpen(false);
        setForm({ name: '', idNumber: '', phone: '', email: '', postalAddress: '', notes: '' });
      },
      onError: () => toast({ title: 'Could not add seller', variant: 'destructive' }),
    },
  });

  const submit = () => {
    if (!form.name) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    createSeller.mutate({
      data: {
        name: form.name,
        idNumber: form.idNumber || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        postalAddress: form.postalAddress || undefined,
        notes: form.notes || undefined,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-sm" data-testid="button-add-seller">
          <Plus className="w-4 h-4 mr-2" />
          Add Seller
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Seller</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="s-name">Name</Label>
            <Input id="s-name" data-testid="input-seller-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="s-id">National ID</Label>
              <Input id="s-id" placeholder="e.g. 63-123456A63" value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-phone">Phone</Label>
              <Input id="s-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="s-email">Email</Label>
            <Input id="s-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="s-addr">Postal Address</Label>
            <Input id="s-addr" value={form.postalAddress} onChange={(e) => setForm({ ...form, postalAddress: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="s-notes">Notes</Label>
            <Textarea id="s-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={createSeller.isPending} data-testid="button-save-seller">
            {createSeller.isPending ? 'Adding...' : 'Add Seller'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Sellers() {
  const [search, setSearch] = useState('');
  const { data: sellers, isLoading } = useListSellers({ q: search || undefined });

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sellers</h1>
          <p className="text-muted-foreground mt-1">Manage property owners and mandates.</p>
        </div>
        <AddSellerDialog />
      </div>

      <div className="bg-card p-4 rounded-lg border border-border shadow-sm flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, email, or ID..." 
            className="pl-9 bg-muted/50 border-muted-foreground/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({length: 6}).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
        ) : sellers?.length === 0 ? (
          <div className="col-span-full text-center py-24 bg-card rounded-lg border border-dashed">
            <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No sellers found</h3>
            <p className="text-muted-foreground">Try adjusting your search query.</p>
          </div>
        ) : (
          sellers?.map(seller => (
            <Card key={seller.id} className="hover-elevate transition-all">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4 border-b border-border/50 pb-4">
                  <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center font-bold">
                    {seller.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">{seller.name}</h4>
                    {seller.idNumber && <div className="text-xs text-muted-foreground">ID: {seller.idNumber}</div>}
                  </div>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {seller.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" /> {seller.phone}
                    </div>
                  )}
                  {seller.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" /> {seller.email}
                    </div>
                  )}
                  {seller.postalAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 shrink-0" /> <span className="line-clamp-2">{seller.postalAddress}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-border/50 flex justify-end">
                  <Button variant="outline" size="sm">View Profile</Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}