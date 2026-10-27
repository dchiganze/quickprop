import { useMemo, useState, type ReactNode } from 'react';
import {
  useCreateRentalApplicationInvite,
  useListRentalApplications,
  type Property,
  type RentalApplication,
} from '@workspace/api-client-react';
import {
  AlertCircle, ArrowUpRight, BriefcaseBusiness, CalendarDays, ChevronDown,
  Copy, FileText, Home, Mail, MessageCircle, Search, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

function dateLabel(value?: string | null) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function moneyLabel(amount: number | null, currency: string | null) {
  if (amount == null) return 'Not provided';
  return `${currency || 'USD'} ${amount.toLocaleString('en-US')}`;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

export function RentalApplicationsList({ propertyId }: { propertyId?: number }) {
  const params = propertyId == null ? undefined : { propertyId };
  const { data: applications, isLoading, isError, refetch } = useListRentalApplications(params);
  const [search, setSearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const { toast } = useToast();
  const allApplications = applications ?? [];
  const properties = useMemo(() => Array.from(new Map(allApplications.map((app) => [app.propertyId, { id: app.propertyId, title: app.propertyTitle, reference: app.propertyReference }])).values()), [allApplications]);
  const filtered = allApplications.filter((app) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [app.applicantName, app.email, app.phone, app.propertyTitle, app.propertyReference, app.employerName ?? ''].some((value) => value.toLowerCase().includes(term));
    return matchesSearch && (propertyFilter === 'all' || String(app.propertyId) === propertyFilter);
  }).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  const copyContact = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: 'Could not copy', description: 'Your browser did not allow clipboard access.', variant: 'destructive' });
    }
  };

  return (
    <section className="application-enter space-y-5">
      <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Lettings / applications</p>
          <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-[2.55rem]">Rental applications</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Every applicant, with the listing context close at hand.</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-lg border border-border bg-card px-3 py-2 lg:self-auto">
          <span className="font-mono text-xl font-semibold text-primary">{allApplications.length}</span>
          <span className="text-xs text-muted-foreground">received</span>
          <span className="mx-1 h-6 w-px bg-border" />
          <span className="font-mono text-xl font-semibold">{properties.length}</span>
          <span className="text-xs text-muted-foreground">listings</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people, contact or property" className="h-11 border-border bg-card pl-9" data-testid="input-search-applications" />
        </label>
        {!propertyId && <label className="sr-only" htmlFor="application-property-filter">Filter by listing</label>}
        {!propertyId && <select id="application-property-filter" value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)} className="h-11 rounded-md border border-input bg-card px-3 text-sm text-foreground sm:w-64" data-testid="select-application-property">
          <option value="all">All rental listings</option>
          {properties.map((property) => <option key={property.id} value={property.id}>{property.reference} · {property.title}</option>)}
        </select>}
      </div>

      {isLoading ? (
        <div className="space-y-3" aria-label="Loading applications">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-28 w-full rounded-xl" />)}</div>
      ) : isError ? (
        <Card className="border-destructive/30 bg-destructive/[0.03]"><CardContent className="flex flex-col items-center py-12 text-center">
          <AlertCircle className="mb-3 h-8 w-8 text-destructive" /><h2 className="font-semibold">Applications did not load</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your listing access is unchanged. Try loading the list again.</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()} data-testid="button-retry-applications">Try again</Button>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border bg-card/60"><CardContent className="flex flex-col items-center px-5 py-14 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
          <h2 className="font-semibold">{allApplications.length === 0 ? 'No applications yet' : 'No matching applicants'}</h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{allApplications.length === 0 ? 'When someone applies to one of your rental listings, their details will be collected here.' : 'Try another search or choose a different listing.'}</p>
          {search || propertyFilter !== 'all' ? <Button variant="ghost" className="mt-3" onClick={() => { setSearch(''); setPropertyFilter('all'); }}>Clear filters</Button> : null}
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((application) => <ApplicationRow key={application.id} application={application} onCopy={copyContact} />)}
        </div>
      )}
    </section>
  );
}

function ApplicationRow({ application: app, onCopy }: { application: RentalApplication; onCopy: (value: string, label: string) => void }) {
  return (
    <Card className="application-row overflow-hidden border-border bg-card transition-colors hover:border-primary/35" data-testid={`card-application-${app.id}`}>
      <CardContent className="p-0">
        <details className="group">
        <summary className="grid cursor-pointer list-none gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_minmax(170px,.8fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e7eee8] font-semibold text-[#275646]">{initials(app.applicantName)}</div>
            <div className="min-w-0">
              <h2 className="truncate font-semibold tracking-tight" data-testid={`text-applicant-${app.id}`}>{app.applicantName}</h2>
              <a className="mt-0.5 block truncate text-sm text-muted-foreground hover:text-primary" href={`mailto:${encodeURIComponent(app.email)}`}>{app.email}</a>
            </div>
          </div>
          <div className="min-w-0 border-l-0 pl-0 sm:border-l sm:border-border sm:pl-4">
            <p className="flex items-center gap-1.5 truncate text-sm font-medium"><Home className="h-3.5 w-3.5 shrink-0 text-primary" />{app.propertyTitle}</p>
            <p className="mt-1 pl-5 font-mono text-[11px] tracking-wide text-muted-foreground">{app.propertyReference} <span className="font-sans">· {app.status}</span></p>
          </div>
          <div className="flex gap-5 sm:gap-7 lg:block lg:space-y-1.5">
            <p className="text-xs text-muted-foreground"><span className="font-mono text-sm font-semibold text-foreground">{app.occupants}</span> occupant{app.occupants === 1 ? '' : 's'}</p>
            <p className="text-xs text-muted-foreground">Move-in <span className="ml-1 font-medium text-foreground">{dateLabel(app.moveInDate)}</span></p>
          </div>
          <span className="flex items-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold text-primary hover:bg-primary/5 lg:justify-self-end">
              Details <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="border-t border-border/70">
          <div className="grid gap-x-8 gap-y-5 bg-[#f5f7f4] px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            <DetailBlock icon={MessageCircle} label="Phone"><a className="hover:text-primary" href={`tel:${app.phone}`}>{app.phone}</a></DetailBlock>
            <DetailBlock icon={CalendarDays} label="Submitted">{dateLabel(app.submittedAt)}</DetailBlock>
            <DetailBlock icon={Users} label="Household">{app.occupants} occupant{app.occupants === 1 ? '' : 's'}</DetailBlock>
            <DetailBlock icon={BriefcaseBusiness} label="Employment">{app.employmentStatus.replaceAll('_', ' ')}{app.jobTitle ? ` · ${app.jobTitle}` : ''}</DetailBlock>
            <DetailBlock icon={BriefcaseBusiness} label="Employer">{app.employerName || 'Not provided'}</DetailBlock>
            <DetailBlock icon={BriefcaseBusiness} label="Monthly income">{moneyLabel(app.monthlyIncome, app.incomeCurrency)}</DetailBlock>
            <DetailBlock icon={Home} label="Move-in date">{dateLabel(app.moveInDate)}</DetailBlock>
            <div className="sm:col-span-2 lg:col-span-4"><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Applicant note</p><p className="text-sm leading-6">{app.applicantNote || 'No note included.'}</p></div>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
              <Button size="sm" variant="outline" onClick={() => onCopy(app.phone, 'Phone number')}><Copy className="mr-1.5 h-3.5 w-3.5" />Copy phone</Button>
              <Button size="sm" variant="outline" asChild><a href={`https://wa.me/${app.phone.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-1.5 h-3.5 w-3.5" />WhatsApp</a></Button>
              <Button size="sm" variant="outline" asChild><a href={`mailto:${encodeURIComponent(app.email)}`}><Mail className="mr-1.5 h-3.5 w-3.5" />Email applicant</a></Button>
            </div>
          </div>
        </div>
        </details>
      </CardContent>
    </Card>
  );
}

function DetailBlock({ icon: Icon, label, children }: { icon: typeof Home; label: string; children: ReactNode }) {
  return <div><p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground"><Icon className="h-3 w-3" />{label}</p><p className="text-sm capitalize">{children}</p></div>;
}

export function PropertyApplications({ property }: { property: Property }) {
  const invite = useCreateRentalApplicationInvite();
  const { toast } = useToast();
  const canInvite = property.listingType === 'rent' && property.status === 'public';
  const inviteUrl = invite.data?.applicationUrl;
  const expires = invite.data?.expiresAt;

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast({ title: 'Application link copied', description: 'It is ready to share with a prospective tenant.' });
    } catch {
      toast({ title: 'Could not copy link', description: 'Your browser did not allow clipboard access.', variant: 'destructive' });
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <RentalApplicationsList propertyId={property.id} />
      <aside className="space-y-4">
        <Card className="overflow-hidden border-primary/25">
          <div className="h-1.5 bg-primary" />
          <CardContent className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Share an application</p>
            <h2 className="mt-2 text-lg font-bold tracking-tight">Bring the right tenant forward.</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Create a secure application link tied to <span className="font-medium text-foreground">{property.reference}</span>. Keep the home in view while reviewing every response.</p>
            {!canInvite ? (
              <div className="mt-5 flex gap-2 rounded-md bg-muted/70 p-3 text-xs leading-5 text-muted-foreground"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Only published rental listings can receive application links.</div>
            ) : inviteUrl ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-md border border-border bg-background p-3">
                  <p className="truncate font-mono text-xs text-foreground" title={inviteUrl}>{inviteUrl}</p>
                  {expires && <p className="mt-2 text-[11px] text-muted-foreground">Link expires {dateLabel(expires)}</p>}
                </div>
                <Button className="w-full" onClick={copyInvite} data-testid="button-copy-application-link"><Copy className="mr-2 h-4 w-4" />Copy application link</Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Apply for ${property.title} (${property.reference}): ${inviteUrl}`)}`, '_blank', 'noopener,noreferrer')} data-testid="button-share-application-whatsapp"><MessageCircle className="mr-1.5 h-4 w-4" />WhatsApp</Button>
                  <Button variant="outline" onClick={() => { window.location.href = `mailto:?subject=${encodeURIComponent(`Application for ${property.title}`)}&body=${encodeURIComponent(`Apply for ${property.title} (${property.reference}): ${inviteUrl}`)}`; }} data-testid="button-share-application-email"><Mail className="mr-1.5 h-4 w-4" />Email</Button>
                </div>
              </div>
            ) : (
              <Button className="mt-5 w-full" onClick={() => invite.mutate({ id: property.id }, {
                onSuccess: () => toast({ title: 'Application link created', description: 'Your secure link is ready to share.' }),
                onError: (error) => toast({ title: 'Could not create link', description: error.message || 'Check that this rental is published, then try again.', variant: 'destructive' }),
              })} disabled={invite.isPending || !canInvite} data-testid="button-create-application-link">
                {invite.isPending ? <><span className="mr-2 h-4 w-4 animate-pulse rounded-full bg-current/30" />Preparing secure link</> : <><ArrowUpRight className="mr-2 h-4 w-4" />Create application link</>}
              </Button>
            )}
            {invite.isError && <p className="mt-3 text-xs text-destructive">The link could not be created. Please try again.</p>}
          </CardContent>
        </Card>
        <div className="rounded-lg border border-border bg-[#f1f4ef] p-4">
          <p className="text-xs font-semibold text-foreground">Listing context stays attached</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{property.title}<br />{property.suburb}, {property.city}</p>
          <Badge variant="secondary" className="mt-3 font-mono text-[10px]">{property.reference}</Badge>
        </div>
      </aside>
    </div>
  );
}
