import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Search, Filter, Plus, Home, MapPin, DollarSign, LayoutGrid, List, ArrowUpDown, ChevronDown, Sparkles
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListProperties,
  useOfficeSearch,
  useCreateProperty,
  useCheckPropertyDuplicate,
  useAddPropertyAgencyRelationship,
  getListPropertiesQueryKey,
  getOfficeSearchQueryKey,
  getGetPipelineQueryKey,
  Property,
} from '@workspace/api-client-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

function AddPropertyDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', propertyType: 'house', listingType: 'sale', price: '', suburb: '', city: 'Harare',
    bedrooms: '', bathrooms: '', description: '',
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createProperty = useCreateProperty({
    mutation: {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPipelineQueryKey() });
        toast({ title: 'Mandate created', description: `${created.reference} — ${created.title}` });
        setOpen(false);
        setForm({ title: '', propertyType: 'house', listingType: 'sale', price: '', suburb: '', city: 'Harare', bedrooms: '', bathrooms: '', description: '' });
      },
      onError: () => toast({ title: 'Could not create property', variant: 'destructive' }),
    },
  });
  const duplicateCheck = useCheckPropertyDuplicate();
  const addAgency = useAddPropertyAgencyRelationship();

  const submit = async () => {
    if (!form.title || !form.price || !form.suburb) {
      toast({ title: 'Title, price and suburb are required', variant: 'destructive' });
      return;
    }
    const input = {
      title: form.title,
      propertyType: form.propertyType,
      listingType: form.listingType,
      price: Number(form.price),
      suburb: form.suburb,
      city: form.city || 'Harare',
      bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
      description: form.description || undefined,
    };
    try {
      const duplicate = await duplicateCheck.mutateAsync({
        data: {
          address: form.suburb,
          suburb: form.suburb,
          city: form.city || 'Harare',
          propertyType: form.propertyType,
          bedrooms: input.bedrooms,
          bathrooms: input.bathrooms,
          price: input.price,
          description: input.description,
        },
      });
      const match = duplicate.matches[0];
      if (match && duplicate.decision !== 'continue') {
        const useExisting = window.confirm(
          `Possible duplicate (${match.confidenceScore}% match): ${match.title} at ${match.suburb}.\n\nPress OK to add this office as an agency offer, or Cancel to create a separate record for admin review.`
        );
        if (useExisting) {
          await addAgency.mutateAsync({
            id: match.id,
            data: {
              askingPrice: input.price,
              currency: 'USD',
              mandateType: 'non_exclusive',
              description: input.description,
              verificationStatus: 'pending',
            },
          });
          toast({ title: 'Agency offer added', description: `${match.reference} remains the canonical property.` });
          setOpen(false);
          return;
        }
      }
    } catch {
      // The create request remains available if duplicate checking is temporarily unavailable.
    }
    createProperty.mutate({
      data: {
        ...input,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shrink-0 font-semibold shadow-sm" data-testid="button-add-property">
          <Plus className="w-4 h-4 mr-2" />
          Add Property
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Mandate</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="np-title">Title</Label>
            <Input id="np-title" data-testid="input-property-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. 3-Bed Home in Avondale" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Property Type</Label>
              <Select value={form.propertyType} onValueChange={(v) => setForm({ ...form, propertyType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['house','apartment','townhouse','stand','commercial','industrial','farm'].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Listing Type</Label>
              <Select value={form.listingType} onValueChange={(v) => setForm({ ...form, listingType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">For Sale</SelectItem>
                  <SelectItem value="rent">To Rent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="np-price">Price (USD)</Label>
              <Input id="np-price" data-testid="input-property-price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="np-beds">Bedrooms</Label>
              <Input id="np-beds" type="number" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="np-baths">Bathrooms</Label>
              <Input id="np-baths" type="number" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="np-suburb">Suburb</Label>
              <Input id="np-suburb" data-testid="input-property-suburb" value={form.suburb} onChange={(e) => setForm({ ...form, suburb: e.target.value })} placeholder="e.g. Borrowdale" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="np-city">City</Label>
              <Input id="np-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="np-desc">Description</Label>
            <Textarea id="np-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={createProperty.isPending} data-testid="button-save-property">
            {createProperty.isPending ? 'Creating...' : 'Create Mandate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PropertyCard({ property }: { property: Property }) {
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'public': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'under_offer': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'sold': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Link href={`/property/${property.id}`} className="group">
      <Card className="overflow-hidden hover-elevate transition-all duration-200 h-full flex flex-col border-border/60">
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {property.coverImage ? (
            <img src={property.coverImage} alt={property.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50 bg-muted/50">
              <Home className="w-10 h-10 mb-2" />
              <span className="text-xs font-medium uppercase tracking-wider">No Image</span>
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge className={`font-semibold capitalize shadow-sm ${getStatusColor(property.status)}`}>
              {property.status.replace('_', ' ')}
            </Badge>
            <Badge variant="secondary" className="shadow-sm bg-background/90 backdrop-blur text-foreground capitalize">
              {property.listingType}
            </Badge>
          </div>
          <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-background/90 backdrop-blur rounded text-sm font-bold shadow-sm">
            {property.currency} {property.price.toLocaleString()}
          </div>
        </div>
        <CardContent className="p-4 flex-1 flex flex-col">
          <div className="text-xs font-mono text-muted-foreground mb-1">{property.reference}</div>
          <h3 className="font-semibold text-foreground line-clamp-1 mb-2 group-hover:text-primary transition-colors">{property.title}</h3>
          <div className="flex items-center text-sm text-muted-foreground mb-4 gap-1">
            <MapPin className="w-3.5 h-3.5" />
            <span className="line-clamp-1">{property.suburb}, {property.city}</span>
          </div>
          
          <div className="mt-auto flex items-center justify-between pt-4 border-t border-border/50 text-sm">
            <div className="flex items-center gap-4 text-muted-foreground font-medium">
              {property.bedrooms != null && <span>{property.bedrooms} <span className="text-xs">Beds</span></span>}
              {property.bathrooms != null && <span>{property.bathrooms} <span className="text-xs">Baths</span></span>}
            </div>
            <div className="text-xs text-muted-foreground capitalize">
              {property.propertyType.replace('_', ' ')}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [listingType, setListingType] = useState<string>('all');
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const searching = debouncedSearch.length > 0;

  const { data: listData, isLoading: listLoading } = useListProperties(
    {
      status: status !== 'all' ? status : undefined,
      listingType: listingType !== 'all' ? listingType : undefined,
    },
    {
      query: {
        enabled: !searching,
        queryKey: getListPropertiesQueryKey({
          status: status !== 'all' ? status : undefined,
          listingType: listingType !== 'all' ? listingType : undefined,
        }),
      },
    },
  );

  const { data: searchData, isLoading: searchLoading } = useOfficeSearch(
    { q: debouncedSearch },
    { query: { enabled: searching, queryKey: getOfficeSearchQueryKey({ q: debouncedSearch }) } },
  );

  const properties = searching
    ? searchData?.properties?.filter(
        (p) =>
          (status === 'all' || p.status === status) &&
          (listingType === 'all' || p.listingType === listingType),
      )
    : listData;
  const isLoading = searching ? searchLoading : listLoading;

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground mt-1">Manage your property portfolio</p>
        </div>
        <AddPropertyDialog />
      </div>

      <div className="bg-card p-4 rounded-lg border border-border shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search natural language (e.g. 'Houses in Borrowdale under 300k')..." 
            className="pl-9 h-11 bg-muted/50 border-muted-foreground/20 focus-visible:ring-primary/50 text-base"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px] h-11 bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="under_offer">Under Offer</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
            </SelectContent>
          </Select>

          <Select value={listingType} onValueChange={setListingType}>
            <SelectTrigger className="w-[140px] h-11 bg-background">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="sale">For Sale</SelectItem>
              <SelectItem value="rent">To Rent</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="hidden sm:flex border border-border rounded-md p-1 bg-muted/50">
            <Button variant="ghost" size="icon" className={`h-8 w-8 rounded ${viewMode === 'grid' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`} onClick={() => setViewMode('grid')}>
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className={`h-8 w-8 rounded ${viewMode === 'list' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`} onClick={() => setViewMode('list')}>
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {searching && searchData?.interpretation && (
        <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 border border-primary/20 rounded-md px-3 py-2" data-testid="text-search-interpretation">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{searchData.interpretation}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground font-medium">
          Showing <span className="text-foreground font-bold">{properties?.length || 0}</span> properties
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <ArrowUpDown className="w-4 h-4 mr-2" />
          Sort by: Newest First
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : properties?.length === 0 ? (
        <div className="text-center py-24 bg-card rounded-lg border border-dashed">
          <Home className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No properties found</h3>
          <p className="text-muted-foreground">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
          : "flex flex-col gap-4"
        }>
          {properties?.map(property => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  );
}