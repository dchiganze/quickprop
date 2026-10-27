import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AgentContact,
  AgentContactProperty,
  getGetAgentContactsQueryKey,
  useCreateAgentContactMandate,
  useCreateAgentContactReviewInvitation,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, FileText, Loader2, Mail, MapPin, Phone, ScanLine, Star } from 'lucide-react';

type ContactKind = 'seller' | 'landlord';

function closedMandate(property: AgentContactProperty) {
  return ['sold', 'rented', 'withdrawn', 'archived'].includes(property.status)
    || ['sold', 'let', 'withdrawn'].includes(property.availabilityStatus ?? '');
}

export function AgentContactDirectory({ contacts, kind }: { contacts: AgentContact[]; kind: ContactKind }) {
  const [busyPropertyId, setBusyPropertyId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedPropertyRef = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const saveMandate = useCreateAgentContactMandate();
  const requestReview = useCreateAgentContactReviewInvitation();

  const chooseMandate = (propertyId: number) => {
    selectedPropertyRef.current = propertyId;
    fileInputRef.current?.click();
  };

  const uploadMandate = async (file: File) => {
    const propertyId = selectedPropertyRef.current;
    if (!propertyId) return;
    setBusyPropertyId(propertyId);
    try {
      if (!file.size || file.size > 25 * 1024 * 1024) {
        throw new Error('Choose a mandate under 25 MB.');
      }
      const contentType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      const response = await fetch('/api/storage/uploads/request-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size, contentType }),
      });
      const target = await response.json().catch(() => null) as {
        uploadURL?: string;
        objectPath?: string;
        error?: string;
      } | null;
      if (!response.ok || !target?.uploadURL || !target.objectPath) {
        throw new Error(target?.error || 'Could not prepare the mandate upload.');
      }
      const upload = await fetch(target.uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });
      if (!upload.ok) throw new Error('The mandate could not be uploaded. Please try again.');
      await saveMandate.mutateAsync({
        propertyId,
        data: { name: file.name, objectPath: target.objectPath, sizeKb: Math.max(1, Math.ceil(file.size / 1024)) },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetAgentContactsQueryKey({ type: 'seller' }) }),
        queryClient.invalidateQueries({ queryKey: getGetAgentContactsQueryKey({ type: 'landlord' }) }),
      ]);
      toast({ title: 'Mandate stored with the property' });
    } catch (error) {
      toast({
        title: 'Could not save mandate',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusyPropertyId(null);
      selectedPropertyRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const shareReview = async (property: AgentContactProperty) => {
    const popup = window.open('about:blank', '_blank');
    setBusyPropertyId(property.id);
    try {
      const invitation = await requestReview.mutateAsync({ propertyId: property.id });
      const message = `Hi ${invitation.recipientName}, I’d appreciate it if you could leave a review about working with me on ${invitation.propertyReference} through QuickProp: ${invitation.url}`;
      const phone = invitation.phone?.replace(/\D/g, '').replace(/^00/, '');
      const whatsAppUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;
      if (popup) popup.location.href = whatsAppUrl;
      else window.location.assign(whatsAppUrl);
    } catch (error) {
      popup?.close();
      toast({
        title: 'Could not create review link',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusyPropertyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void uploadMandate(file);
        }}
      />
      {contacts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No {kind === 'seller' ? 'seller' : 'landlord'} contacts are linked to these listings yet.
          </CardContent>
        </Card>
      ) : contacts.map((contact) => (
        <Card key={contact.id}>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">
                {contact.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{contact.name}</h3>
                {contact.idNumber && <p className="text-xs text-muted-foreground">ID: {contact.idNumber}</p>}
                {contact.standalone && <p className="text-xs text-muted-foreground">Standalone contact</p>}
              </div>
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {contact.phone && <a className="flex items-center gap-2 hover:text-primary" href={`tel:${contact.phone}`}><Phone className="h-4 w-4" />{contact.phone}</a>}
              {contact.email && <a className="flex items-center gap-2 break-all hover:text-primary" href={`mailto:${contact.email}`}><Mail className="h-4 w-4" />{contact.email}</a>}
              {contact.postalAddress && <p className="flex items-start gap-2 sm:col-span-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{contact.postalAddress}</p>}
            </div>
            {contact.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{contact.notes}</p>}

            {contact.properties.length > 0 && <div className="space-y-3 border-t pt-4">
              {contact.properties.map((property) => {
                const busy = busyPropertyId === property.id;
                return (
                  <div key={property.id} className="rounded-xl border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{property.title}</p>
                        <p className="text-xs text-muted-foreground">{property.reference} · {property.suburb}, {property.city}</p>
                        <p className="mt-1 text-xs capitalize text-muted-foreground">{property.status.replace(/_/g, ' ')} · {property.mandateType ?? 'Mandate type not set'}{property.mandateExpiry ? ` · Expires ${property.mandateExpiry}` : ''}</p>
                      </div>
                      <span className="font-semibold text-primary">{property.currency ?? ''} {property.price?.toLocaleString() ?? ''}</span>
                    </div>
                    {property.documents.map((document) => (
                      <a
                        key={document.id}
                        href={document.url ? `/api/storage${document.url}` : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <FileText className="h-4 w-4" /> {document.name} <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ))}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => chooseMandate(property.id)}>
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                        Scan / store mandate
                      </Button>
                      <Button size="sm" disabled={busy || !closedMandate(property)} onClick={() => void shareReview(property)} title={!closedMandate(property) ? 'Available after a sale, lease, or mandate closure' : undefined}>
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4" />}
                        Request review by WhatsApp
                      </Button>
                    </div>
                    {!closedMandate(property) && <p className="mt-2 text-xs text-muted-foreground">Review requests are available after the sale, lease, or mandate closes.</p>}
                  </div>
                );
              })}
            </div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
