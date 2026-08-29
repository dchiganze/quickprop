import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  CollaborationMatchRequest,
  Property,
  getListCollaborationDiscoveryQueryKey,
  getListCollaborationRequestsQueryKey,
  useCreateCollaborationRequest,
  useGetCurrentUser,
  useListCollaborationDiscovery,
  useListCollaborationRequests,
  useUpdateCollaborationRequest,
} from '@workspace/api-client-react';
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Home,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

type Section = 'discover' | 'incoming' | 'outgoing';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatMoney(value: number, currency = 'USD') {
  return `${currency} ${value.toLocaleString()}`;
}

function propertyLabel(property: Property) {
  const listingType = property.listingType === 'rent' ? 'Rental' : 'For sale';
  return `${property.bedrooms ? `${property.bedrooms}-bed ` : ''}${listingType} in ${property.suburb}`;
}

function formatRequestStatus(status: CollaborationMatchRequest['status']) {
  return status === 'pending' ? 'Pending' : status.charAt(0).toUpperCase() + status.slice(1);
}

function requestStatusClass(status: CollaborationMatchRequest['status']) {
  if (status === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'declined' || status === 'cancelled') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '').replace(/^\+/, '');
}

function openWhatsApp(phone: string, name: string, property: Property) {
  const message = `Hi ${name || 'there'}, our collaboration request for ${property.reference} was accepted. Shall we coordinate the next steps?`;
  window.open(`https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
}

function PropertyImage({ property }: { property: Property }) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = property.coverImage || property.photos?.[0];

  if (!image || imageFailed) {
    return (
      <div className="flex h-full min-h-44 w-full items-center justify-center bg-primary/5 text-primary">
        <Home className="h-10 w-10" />
      </div>
    );
  }

  return (
    <img
      src={image}
      alt=""
      className="h-full min-h-44 w-full object-cover"
      onError={() => setImageFailed(true)}
    />
  );
}

function DiscoveryCard({
  property,
  currentUserId,
  request,
  isRequesting,
  onRequest,
}: {
  property: Property;
  currentUserId?: number;
  request?: CollaborationMatchRequest;
  isRequesting: boolean;
  onRequest: (property: Property) => void;
}) {
  const ownListing = property.agentId === currentUserId;
  const canRequest = !ownListing && (!request || request.status === 'declined' || request.status === 'cancelled');

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md" data-testid={`card-match-property-${property.id}`}>
      <div className="grid md:grid-cols-[220px_1fr]">
        <div className="min-h-44 md:min-h-full">
          <PropertyImage property={property} />
        </div>
        <CardContent className="flex flex-col justify-between gap-5 p-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{property.reference}</span>
              <Badge variant="secondary" className="capitalize text-[10px]">
                {property.status.replace(/_/g, ' ')}
              </Badge>
              {property.collaborationEnabled && !ownListing && (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  <Users className="mr-1 h-3 w-3" />
                  Open to collaborate
                </Badge>
              )}
            </div>
            <div>
              <Link
                href={`/property/${property.id}`}
                className="group inline-flex items-center gap-1 text-lg font-semibold text-foreground hover:text-primary"
              >
                {propertyLabel(property)}
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {property.address || property.suburb}, {property.city}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="font-semibold text-foreground">{formatMoney(property.price, property.currency)}</span>
              {property.bedrooms ? <span className="text-muted-foreground">{property.bedrooms} beds</span> : null}
              {property.bathrooms ? <span className="text-muted-foreground">{property.bathrooms} baths</span> : null}
              {(property.buildingSize || property.landSize) ? (
                <span className="text-muted-foreground">{(property.buildingSize || property.landSize)?.toLocaleString()} m²</span>
              ) : null}
            </div>
            {property.features && property.features.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {property.features.slice(0, 4).map((feature) => (
                  <span key={feature} className="rounded border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                    {feature}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            {ownListing ? (
              <span className="rounded-md bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">Your listing</span>
            ) : request ? (
              <span className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold ${requestStatusClass(request.status)}`}>
                {request.status === 'approved' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                {request.status === 'approved' ? 'Collaboration accepted' : `Request ${request.status}`}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Share this listing with your qualified buyers.</span>
            )}
            {canRequest && (
              <Button onClick={() => onRequest(property)} disabled={isRequesting} data-testid={`button-request-${property.id}`}>
                {isRequesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {request ? 'Request again' : 'Request collaboration'}
              </Button>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function RequestCard({
  request,
  direction,
  isUpdating,
  onRespond,
}: {
  request: CollaborationMatchRequest;
  direction: 'incoming' | 'outgoing';
  isUpdating: boolean;
  onRespond: (request: CollaborationMatchRequest, status: 'approved' | 'declined') => void;
}) {
  const isIncoming = direction === 'incoming';
  const contactName = isIncoming ? request.requesterName : request.ownerName;
  const contactPhone = isIncoming ? request.requesterPhone : request.ownerPhone;
  const property = request.property;

  return (
    <Card className="transition-shadow hover:shadow-md" data-testid={`card-collaboration-request-${request.id}`}>
      <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${request.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
          {request.status === 'approved' ? <CheckCircle2 className="h-7 w-7" /> : <Users className="h-7 w-7" />}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/property/${property.id}`} className="font-semibold text-foreground hover:text-primary">
              {propertyLabel(property)}
            </Link>
            <Badge variant="outline" className={requestStatusClass(request.status)}>
              {formatRequestStatus(request.status)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {isIncoming ? `${request.requesterName || 'An agent'} wants to collaborate` : `Request sent to ${request.ownerName || 'the listing agent'}`}
            <span className="mx-2 text-border">•</span>
            {property.reference}
          </p>
          {request.message && <p className="max-w-2xl rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground">{request.message}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{formatMoney(property.price, property.currency)}</span>
            <span>{property.address || property.suburb}</span>
            <span>Sent {new Date(request.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
          {request.status === 'pending' && isIncoming ? (
            <>
              <Button variant="outline" onClick={() => onRespond(request, 'declined')} disabled={isUpdating} data-testid={`button-decline-${request.id}`}>
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                Decline
              </Button>
              <Button onClick={() => onRespond(request, 'approved')} disabled={isUpdating} data-testid={`button-approve-${request.id}`}>
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Accept
              </Button>
            </>
          ) : request.status === 'approved' ? (
            contactPhone ? (
              <Button
                className="bg-[#25D366] text-white hover:bg-[#1fbd5b]"
                onClick={() => openWhatsApp(contactPhone, contactName, property)}
                data-testid={`button-whatsapp-${request.id}`}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp {contactName || 'agent'}
              </Button>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                Contact not available
              </span>
            )
          ) : (
            <span className="rounded-md bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
              {request.status === 'pending' ? 'Awaiting a response' : `Request ${request.status}`}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-48 w-full rounded-lg" />
      ))}
    </div>
  );
}

function EmptyState({ section }: { section: Section }) {
  const content = {
    discover: {
      title: 'No properties found',
      body: 'Search your agency inventory and external listings that are open for collaboration.',
      icon: Search,
    },
    incoming: {
      title: 'No incoming requests',
      body: 'Requests from other agents will appear here when they want to collaborate on your listings.',
      icon: Users,
    },
    outgoing: {
      title: 'No sent requests',
      body: 'Collaboration requests you send will appear here so you can track their progress.',
      icon: Send,
    },
  }[section];
  const Icon = content.icon;

  return (
    <div className="rounded-lg border border-dashed bg-card px-6 py-20 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{content.title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{content.body}</p>
    </div>
  );
}

export default function Matches() {
  const [section, setSection] = useState<Section>('discover');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const { data: user } = useGetCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), search ? 350 : 0);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const discoveryParams = { q: debouncedSearch || undefined };
  const { data: listings, isLoading: loadingListings, isError: listingsError } = useListCollaborationDiscovery(discoveryParams);
  const {
    data: incoming,
    isLoading: loadingIncoming,
    isError: incomingError,
  } = useListCollaborationRequests({ direction: 'incoming' });
  const {
    data: outgoing,
    isLoading: loadingOutgoing,
    isError: outgoingError,
  } = useListCollaborationRequests({ direction: 'outgoing' });

  const outgoingByProperty = useMemo(() => {
    const map = new Map<number, CollaborationMatchRequest>();
    for (const request of outgoing || []) {
      if (!map.has(request.propertyId)) map.set(request.propertyId, request);
    }
    return map;
  }, [outgoing]);

  const pendingIncomingCount = incoming?.filter((request) => request.status === 'pending').length || 0;
  const invalidateMatches = () => {
    queryClient.invalidateQueries({ queryKey: getListCollaborationDiscoveryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCollaborationRequestsQueryKey() });
  };

  const sendRequest = (property: Property) => {
    setRequestingId(property.id);
    createRequest.mutate(
      { data: { propertyId: property.id, message: `Hi, I would like to collaborate on ${property.reference}.` } },
      {
        onSuccess: () => {
          invalidateMatches();
          toast({ title: 'Request sent', description: 'The listing agent can now accept or decline your collaboration request.' });
        },
        onError: (error) => toast({ title: 'Could not send request', description: getErrorMessage(error, 'Please try again.'), variant: 'destructive' }),
        onSettled: () => setRequestingId(null),
      },
    );
  };

  const createRequest = useCreateCollaborationRequest();
  const updateRequest = useUpdateCollaborationRequest();

  const respondToRequest = (request: CollaborationMatchRequest, status: 'approved' | 'declined') => {
    setUpdatingId(request.id);
    updateRequest.mutate(
      { id: request.id, data: { status } },
      {
        onSuccess: () => {
          invalidateMatches();
          toast({
            title: status === 'approved' ? 'Collaboration accepted' : 'Request declined',
            description: status === 'approved' ? 'The requesting agent can now contact you securely.' : 'The request has been declined.',
          });
        },
        onError: (error) => toast({ title: 'Could not update request', description: getErrorMessage(error, 'Please try again.'), variant: 'destructive' }),
        onSettled: () => setUpdatingId(null),
      },
    );
  };

  const isLoading = section === 'discover' ? loadingListings : section === 'incoming' ? loadingIncoming : loadingOutgoing;
  const isError = section === 'discover' ? listingsError : section === 'incoming' ? incomingError : outgoingError;
  const currentItems = section === 'discover' ? listings : section === 'incoming' ? incoming : outgoing;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 md:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <Users className="h-4 w-4" />
            Collaboration workspace
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Matches</h1>
          <p className="mt-1 text-muted-foreground">Discover listings, collaborate with agents, and track your requests.</p>
        </div>
        <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-primary">
          <span className="font-semibold">{listings?.length || 0}</span> listings available to explore
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search road, suburb, amenities, size, beds, or price..."
              className="h-11 bg-muted/30 pl-9"
              aria-label="Search collaboration listings"
              data-testid="input-match-search"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={section} onValueChange={(value) => setSection(value as Section)}>
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 md:w-fit">
          <TabsTrigger value="discover" className="gap-2 px-4 py-2.5">
            <Search className="h-4 w-4" />
            Discover
          </TabsTrigger>
          <TabsTrigger value="incoming" className="gap-2 px-4 py-2.5">
            <Users className="h-4 w-4" />
            Incoming
            {pendingIncomingCount > 0 && <Badge className="ml-1 h-5 min-w-5 justify-center px-1 text-[10px]">{pendingIncomingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="gap-2 px-4 py-2.5">
            <Send className="h-4 w-4" />
            Sent
          </TabsTrigger>
        </TabsList>

        <TabsContent value={section} className="mt-5">
          {isLoading ? (
            <LoadingCards count={section === 'discover' ? 4 : 3} />
          ) : isError ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-6 py-16 text-center">
              <X className="mx-auto mb-3 h-8 w-8 text-destructive" />
              <h3 className="font-semibold text-foreground">Matches are unavailable</h3>
              <p className="mt-1 text-sm text-muted-foreground">We could not load this view. Please refresh and try again.</p>
            </div>
          ) : !currentItems || currentItems.length === 0 ? (
            <EmptyState section={section} />
          ) : section === 'discover' ? (
            <div className="space-y-4">
              {(listings || []).map((property) => (
                <DiscoveryCard
                  key={property.id}
                  property={property}
                  currentUserId={user?.id}
                  request={outgoingByProperty.get(property.id)}
                  isRequesting={requestingId === property.id}
                  onRequest={sendRequest}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(section === 'incoming' ? incoming || [] : outgoing || []).map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  direction={section === 'incoming' ? 'incoming' : 'outgoing'}
                  isUpdating={updatingId === request.id}
                  onRespond={respondToRequest}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}