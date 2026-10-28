import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AgentContact,
  AgentContactProperty,
  getGetAgentContactsQueryKey,
  useCreateAgentContactMandate,
  useCreateAgentContactReviewInvitation,
  useUpdateAgentContact,
  useUpdateProperty,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  const updateAgentContact = useUpdateAgentContact();
  const updateProperty = useUpdateProperty();
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [contactPhoneDraft, setContactPhoneDraft] = useState('');
  const [contactEmailDraft, setContactEmailDraft] = useState('');

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

  const shareReview = async (
    property: AgentContactProperty,
    channel: 'whatsapp' | 'email',
    recipientEmail?: string | null,
  ) => {
    let email = recipientEmail?.trim() || null;
    if (channel === 'email') {
      const enteredEmail = window.prompt('Email address to use for this review request:', email ?? '');
      if (enteredEmail === null) return;
      email = enteredEmail.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast({
          title: 'Enter a valid email address',
          description: 'The review request was not opened.',
          variant: 'destructive',
        });
        return;
      }
    }
    const popup = window.open('about:blank', '_blank');
    setBusyPropertyId(property.id);
    try {
      const invitation = await requestReview.mutateAsync({ propertyId: property.id });
      const message = `Hi ${invitation.recipientName}, I’d appreciate it if you could leave a review about working with me on ${invitation.propertyTitle} (${invitation.propertyReference}) through QuickProp: ${invitation.url}`;
      let destination: string;
      if (channel === 'email') {
        const subject = `QuickProp review request — ${invitation.propertyReference}`;
        destination = `mailto:${encodeURIComponent(email!)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      } else {
        const phone = invitation.phone?.replace(/\D/g, '').replace(/^00/, '');
        destination = phone
          ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
          : `https://wa.me/?text=${encodeURIComponent(message)}`;
      }
      if (popup) popup.location.href = destination;
      else window.location.assign(destination);
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

  const saveContactDetails = async (contact: AgentContact) => {
    const property = contact.properties[0];
    const phone = contactPhoneDraft.trim();
    const email = contactEmailDraft.trim();
    const phoneDigits = phone.replace(/\D/g, '').length;
    if ((contact.standalone && phoneDigits < 7) || (phoneDigits > 0 && phoneDigits < 7)) {
      toast({ title: 'Check the phone number', description: 'Enter a complete phone number or leave it blank.', variant: 'destructive' });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: 'Check the email address', description: 'Enter a valid email address or leave it blank.', variant: 'destructive' });
      return;
    }
    try {
      if (contact.standalone) {
        await updateAgentContact.mutateAsync({
          contactId: Math.abs(contact.id),
          data: { phone, email: email || null },
        });
      } else if (property) {
        await updateProperty.mutateAsync({
          id: property.id,
          data: {
            sellerName: contact.name,
            sellerPhone: phone,
            sellerEmail: email,
          },
        });
      } else {
        throw new Error('This contact is not linked to a property.');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetAgentContactsQueryKey({ type: 'seller' }) }),
        queryClient.invalidateQueries({ queryKey: getGetAgentContactsQueryKey({ type: 'landlord' }) }),
      ]);
      setEditingContactId(null);
      toast({ title: 'Contact details saved' });
    } catch (error) {
      toast({
        title: 'Could not save contact details',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
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
            {(contact.standalone || contact.properties.length > 0) && (
              editingContactId === contact.id ? (
                <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                    Phone
                    <Input type="tel" value={contactPhoneDraft} onChange={(event) => setContactPhoneDraft(event.target.value)} placeholder="+263 77 123 4567" />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                    Email
                    <Input type="email" value={contactEmailDraft} onChange={(event) => setContactEmailDraft(event.target.value)} placeholder="seller@email.com" />
                  </label>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button size="sm" disabled={updateProperty.isPending || updateAgentContact.isPending} onClick={() => void saveContactDetails(contact)}>
                      {(updateProperty.isPending || updateAgentContact.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save details
                    </Button>
                    <Button size="sm" variant="outline" disabled={updateProperty.isPending || updateAgentContact.isPending} onClick={() => setEditingContactId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-auto w-fit px-0 py-1 text-muted-foreground"
                  onClick={() => {
                    setContactPhoneDraft(contact.phone ?? '');
                    setContactEmailDraft(contact.email ?? '');
                    setEditingContactId(contact.id);
                  }}
                >
                  Edit phone and email
                </Button>
              )
            )}
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
                      <Button size="sm" disabled={busy} onClick={() => void shareReview(property, 'whatsapp', contact.email)}>
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4" />}
                        Request review via WhatsApp
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void shareReview(property, 'email', contact.email)}>
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                        Request review by email
                      </Button>
                    </div>
                    {!contact.email && <p className="mt-2 text-xs text-muted-foreground">No email is saved for this contact. You can enter one when requesting a review.</p>}
                    {!closedMandate(property) && <p className="mt-2 text-xs text-muted-foreground">You can request a review now. QuickProp will still send its automatic request after the mandate closes.</p>}
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
