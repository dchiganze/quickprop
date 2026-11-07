import { useEffect, useMemo, useState } from 'react';
import {
  useGetAdminAgencies,
  useGetAdminAgents,
  useGetAdminMyBranch,
  useListProperties,
  useListLeads,
  useSetAdminMyBranch,
} from '@workspace/api-client-react';
import type { AdminAgent, Property, Lead } from '@workspace/api-client-react';
import { Link } from 'wouter';
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  GitBranch,
  Mail,
  MapPin,
  Phone,
  Search,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

type Props = { params: { id?: string } };
type Tab = 'listings' | 'agents' | 'leads';

const statusTone: Record<string, string> = {
  public: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  active: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  new: 'border-sky-200 bg-sky-50 text-sky-800',
  draft: 'border-border bg-muted text-muted-foreground',
  archived: 'border-border bg-muted text-muted-foreground',
  under_offer: 'border-amber-200 bg-amber-50 text-amber-800',
  sold: 'border-violet-200 bg-violet-50 text-violet-800',
  rented: 'border-cyan-200 bg-cyan-50 text-cyan-800',
};

function Status({ value }: { value: string }) {
  return <Badge variant="outline" className={`capitalize ${statusTone[value] ?? 'border-border bg-muted/70 text-muted-foreground'}`}>{value.replaceAll('_', ' ')}</Badge>;
}

function formatPrice(property: Property) {
  if (property.priceOnApplication) return 'Price on application';
  return `${property.currency} ${Number(property.price).toLocaleString()}`;
}

function dateLabel(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AgencyDetail({ params }: Props) {
  const { toast } = useToast();
  const agencyId = Number(params.id);
  const validId = Number.isSafeInteger(agencyId) && agencyId > 0;
  const agenciesQuery = useGetAdminAgencies();
  const agentsQuery = useGetAdminAgents();
  const propertiesQuery = useListProperties();
  const leadsQuery = useListLeads();
  const myBranchQuery = useGetAdminMyBranch();
  const setMyBranch = useSetAdminMyBranch();
  const [tab, setTab] = useState<Tab>('listings');
  const [search, setSearch] = useState('');
  const [branchSelection, setBranchSelection] = useState('');

  const agency = useMemo(
    () => validId ? agenciesQuery.data?.agencies.find((item) => item.id === agencyId) : undefined,
    [agenciesQuery.data, agencyId, validId],
  );
  const branchIds = useMemo(() => new Set((agency?.branches ?? []).map((branch) => branch.id)), [agency?.branches]);
  const branchNames = useMemo(() => new Map((agency?.branches ?? []).map((branch) => [branch.id, branch.name])), [agency?.branches]);
  const scopedAgents = useMemo(
    () => (agentsQuery.data ?? []).filter((agent) => agent.branchId != null && branchIds.has(agent.branchId)),
    [agentsQuery.data, branchIds],
  );
  const agentIds = useMemo(() => new Set(scopedAgents.map((agent) => agent.id)), [scopedAgents]);
  const agentNames = useMemo(() => new Map(scopedAgents.map((agent) => [agent.id, agent.name])), [scopedAgents]);
  const listings = useMemo(
    () => (propertiesQuery.data ?? []).filter((property) => property.branchId != null && branchIds.has(property.branchId)),
    [propertiesQuery.data, branchIds],
  );
  const propertyIds = useMemo(() => new Set(listings.map((property) => property.id)), [listings]);
  const leads = useMemo(
    () => (leadsQuery.data ?? []).filter((lead) =>
      (lead.agentId != null && agentIds.has(lead.agentId)) ||
      (lead.propertyId != null && propertyIds.has(lead.propertyId))
    ),
    [agentIds, leadsQuery.data, propertyIds],
  );

  const searchTerm = search.trim().toLowerCase();
  const filteredListings = listings.filter((item) =>
    !searchTerm || [item.reference, item.title, item.suburb, item.city, item.status].some((value) => value?.toLowerCase().includes(searchTerm))
  );
  const filteredAgents = scopedAgents.filter((agent) =>
    !searchTerm || [agent.name, agent.email, agent.phone, agent.branchName, agent.role].some((value) => value?.toLowerCase().includes(searchTerm))
  );
  const filteredLeads = leads.filter((lead) =>
    !searchTerm || [lead.name, lead.email, lead.phone, lead.source, lead.stage].some((value) => value?.toLowerCase().includes(searchTerm)) ||
      (lead.propertyId != null && listings.find((property) => property.id === lead.propertyId)?.title.toLowerCase().includes(searchTerm))
  );

  const tabLoading = tab === 'listings' ? propertiesQuery.isLoading : tab === 'agents' ? agentsQuery.isLoading : leadsQuery.isLoading;
  const tabError = tab === 'listings' ? propertiesQuery.error : tab === 'agents' ? agentsQuery.error : leadsQuery.error;
  const tabRefetch = tab === 'listings' ? propertiesQuery.refetch : tab === 'agents' ? agentsQuery.refetch : leadsQuery.refetch;
  // The supplied admin-my-branch endpoint returns active branches only.
  const activeBranches = (myBranchQuery.data?.branches ?? []).filter((branch) => branchIds.has(branch.id));
  const selectedBranch = activeBranches.find((branch) => String(branch.id) === branchSelection);
  const currentBranchId = myBranchQuery.data?.currentBranchId;

  useEffect(() => {
    if (activeBranches.some((branch) => String(branch.id) === branchSelection)) return;
    if (activeBranches.length === 0) {
      if (branchSelection) setBranchSelection('');
      return;
    }
    const defaultBranch = activeBranches.find((branch) => branch.id === currentBranchId) ?? activeBranches[0];
    setBranchSelection(String(defaultBranch.id));
  }, [activeBranches, branchSelection, currentBranchId]);

  const canOpenImport = Boolean(selectedBranch && selectedBranch.id === currentBranchId && agency?.status === 'active');

  const saveBranchForImport = () => {
    const branchId = Number(branchSelection);
    if (!Number.isSafeInteger(branchId) || branchId < 1) return;
    setMyBranch.mutate({ data: { branchId } }, {
      onSuccess: () => {
        void myBranchQuery.refetch();
        toast({ title: 'Import branch assignment saved', description: `${selectedBranch?.name ?? 'Selected branch'} will be used for imports.` });
      },
      onError: (error) => toast({
        title: 'Could not update branch assignment',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      }),
    });
  };

  if (agenciesQuery.isLoading) {
    return <main className="mx-auto max-w-screen-2xl space-y-5 p-4 sm:p-6" data-testid="agency-detail-loading">
      <Skeleton className="h-8 w-64" /><Skeleton className="h-36 w-full" /><Skeleton className="h-72 w-full" />
    </main>;
  }

  if (agenciesQuery.error) {
    return <main className="mx-auto max-w-screen-2xl p-4 sm:p-6">
      <ErrorPanel title="Agency details could not be loaded" onRetry={() => void agenciesQuery.refetch()} testId="agency-detail-error" />
    </main>;
  }

  if (!validId || !agency) {
    return <main className="mx-auto max-w-screen-2xl space-y-5 p-4 sm:p-6" data-testid="agency-not-found">
      <Link href="/agencies" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-agencies">
        <ArrowLeft className="h-4 w-4" /> All agencies
      </Link>
      <Card><CardContent className="py-14 text-center">
        <Building2 className="mx-auto h-9 w-9 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">Agency not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">This agency may have been removed or the link is invalid.</p>
      </CardContent></Card>
    </main>;
  }

  return (
    <main className="mx-auto max-w-screen-2xl space-y-5 p-4 sm:p-6" data-testid={`agency-detail-${agency.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/agencies" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" data-testid="link-back-agencies">
          <ArrowLeft className="h-4 w-4" /> Agencies
        </Link>
        <Badge variant="outline" className={agency.status === 'active' ? statusTone.active : ''} data-testid="status-agency">
          {agency.status}
        </Badge>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card" data-testid="agency-profile">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-accent/60 text-accent-foreground">
            {agency.logoUrl ? <img src={agency.logoUrl} alt={`${agency.name} logo`} className="h-full w-full object-contain p-1" /> : <Building2 className="h-6 w-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Agency operations</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground" data-testid="text-agency-name">{agency.name}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {agency.email && <a href={`mailto:${agency.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground" data-testid="link-agency-email"><Mail className="h-3.5 w-3.5" />{agency.email}</a>}
              {agency.phone && <a href={`tel:${agency.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground" data-testid="link-agency-phone"><Phone className="h-3.5 w-3.5" />{agency.phone}</a>}
              {agency.website && <a href={agency.website.startsWith('http') ? agency.website : `https://${agency.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground" data-testid="link-agency-website">{agency.website}<ExternalLink className="h-3 w-3" /></a>}
            </div>
            {agency.aboutText && <p className="mt-4 max-w-4xl text-sm leading-6 text-muted-foreground" data-testid="text-agency-about">{agency.aboutText}</p>}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border bg-muted/25 p-4 sm:min-w-64">
            <Metric label="Branches" value={agency.branchCount} />
            <Metric label="Team" value={agency.teamCount} />
            <Metric label="Active listings" value={agency.activeListings} />
            <Metric label="Total listings" value={agency.totalListings} />
            <Metric label="Total leads" value={agency.totalLeads} />
          </div>
        </div>
        <div className="border-t bg-muted/15 px-5 py-3 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branches</p>
          {agency.branches.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground" data-testid="empty-agency-branches">No branches are assigned to this agency.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {agency.branches.map((branch) => (
                <span key={branch.id} className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs text-foreground" data-testid={`branch-chip-${branch.id}`}>
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />{branch.name}
                  {branch.isMain && <span className="text-muted-foreground">Main</span>}
                  {branch.status !== 'active' && <span className="capitalize text-muted-foreground">{branch.status}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-primary/20 bg-primary/[0.035] p-4 sm:p-5" data-testid="bulk-import-entry">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Bulk listing import</h2>
              <Badge variant="secondary">Office</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose an active branch before opening the import workspace. This changes your admin account’s branch assignment, and that assignment is used for imports.
            </p>
            <p className="mt-2 text-xs text-muted-foreground" data-testid="text-current-import-branch">
              Current assignment: {myBranchQuery.isLoading ? 'Loading…' : myBranchQuery.error ? 'Could not load' : myBranchQuery.data?.currentBranchName ?? 'None'}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <Select value={branchSelection} onValueChange={setBranchSelection} disabled={myBranchQuery.isLoading || setMyBranch.isPending || activeBranches.length === 0 || agency.status !== 'active'}>
              <SelectTrigger className="w-full sm:w-64" data-testid="select-import-branch">
                <SelectValue placeholder="Choose an active branch" />
              </SelectTrigger>
              <SelectContent>
                {activeBranches.map((branch) => <SelectItem key={branch.id} value={String(branch.id)}>{branch.agencyName} — {branch.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={saveBranchForImport}
              disabled={!selectedBranch || setMyBranch.isPending || selectedBranch.id === currentBranchId || agency.status !== 'active'}
              data-testid="button-save-import-branch"
            >
              {setMyBranch.isPending ? 'Saving…' : 'Set branch'}
            </Button>
            <a href={canOpenImport ? '/office/imports/' : undefined} className={`inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 ${canOpenImport ? '' : 'pointer-events-none opacity-50'}`} aria-disabled={!canOpenImport} data-testid="link-office-imports">
              Open imports <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
        {myBranchQuery.error && <p className="mt-3 text-sm text-destructive" data-testid="error-import-branch">Active branches could not be loaded. Retry the page or return to agencies.</p>}
        {!myBranchQuery.isLoading && !myBranchQuery.error && activeBranches.length === 0 && <p className="mt-3 text-sm text-muted-foreground" data-testid="empty-import-branches">No active branches are available for import assignment.</p>}
      </section>

      <section className="overflow-hidden rounded-xl border bg-card" data-testid="agency-records">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Agency records</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Listings and leads are scoped to this agency’s branches and assigned agents.</p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${tab}…`} className="pl-9" data-testid="input-agency-record-search" />
          </div>
        </div>
        <div className="flex gap-1 border-b px-4 pt-3" role="tablist" aria-label="Agency records">
          <TabButton active={tab === 'listings'} label="Listings" count={listings.length} onClick={() => setTab('listings')} testId="tab-agency-listings" />
          <TabButton active={tab === 'agents'} label="Agents" count={scopedAgents.length} onClick={() => setTab('agents')} testId="tab-agency-agents" />
          <TabButton active={tab === 'leads'} label="Leads" count={leads.length} onClick={() => setTab('leads')} testId="tab-agency-leads" />
        </div>
        {tabLoading ? <RecordSkeleton /> : tabError ? (
          <div className="p-5"><ErrorPanel title={`${tab[0].toUpperCase()}${tab.slice(1)} could not be loaded`} onRetry={() => void tabRefetch()} testId={`error-agency-${tab}`} /></div>
        ) : (
          <>
            {tab === 'listings' && <ListingsTable items={filteredListings} branchNames={branchNames} />}
            {tab === 'agents' && <AgentsTable items={filteredAgents} />}
            {tab === 'leads' && <LeadsTable items={filteredLeads} agentNames={agentNames} listings={listings} />}
          </>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <span className="block font-mono text-xl font-semibold tabular-nums text-foreground">{value.toLocaleString()}</span>
    <span className="mt-0.5 block text-[11px] text-muted-foreground">{label}</span>
  </div>;
}

function TabButton({ active, label, count, onClick, testId }: { active: boolean; label: string; count: number; onClick: () => void; testId: string }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`} data-testid={testId}>
    {label}<span className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{count.toLocaleString()}</span>
  </button>;
}

function RecordSkeleton() {
  return <div className="space-y-3 p-4" aria-label="Loading records">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>;
}

function ErrorPanel({ title, onRetry, testId }: { title: string; onRetry: () => void; testId: string }) {
  return <div className="rounded-lg border border-destructive/25 bg-destructive/[0.035] px-5 py-8 text-center" data-testid={testId}>
    <p className="font-medium text-foreground">{title}</p>
    <p className="mt-1 text-sm text-muted-foreground">The records are unavailable right now. No records are being shown.</p>
    <Button variant="outline" size="sm" onClick={onRetry} className="mt-4" data-testid={`button-retry-${testId}`}>Retry</Button>
  </div>;
}

function EmptyRows({ colSpan, title, detail, testId }: { colSpan: number; title: string; detail: string; testId: string }) {
  return <tr><td colSpan={colSpan} className="px-5 py-14 text-center" data-testid={testId}>
    <p className="font-medium text-foreground">{title}</p><p className="mt-1 text-sm text-muted-foreground">{detail}</p>
  </td></tr>;
}

function ListingsTable({ items, branchNames }: { items: Property[]; branchNames: Map<number, string> }) {
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[760px] text-sm">
      <thead><tr className="border-b bg-muted/25 text-left text-xs text-muted-foreground">
        <th className="px-4 py-3 font-medium">Reference</th><th className="px-4 py-3 font-medium">Listing</th><th className="px-4 py-3 font-medium">Location</th><th className="px-4 py-3 font-medium">Branch</th><th className="px-4 py-3 font-medium">Price</th><th className="px-4 py-3 font-medium">Status</th>
      </tr></thead>
      <tbody>
        {items.length === 0 ? <EmptyRows colSpan={6} title="No listings for this agency" detail="Listings assigned to the agency’s branches will appear here." testId="empty-agency-listings" /> : items.map((item) => (
          <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`row-agency-listing-${item.id}`}>
            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{item.reference}</td>
            <td className="max-w-[260px] px-4 py-3"><p className="truncate font-medium">{item.title}</p><p className="mt-0.5 text-xs capitalize text-muted-foreground">{item.listingType} · {item.propertyType.replaceAll('_', ' ')}</p></td>
            <td className="px-4 py-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{[item.suburb, item.city].filter(Boolean).join(', ') || '—'}</span></td>
            <td className="px-4 py-3 text-xs text-muted-foreground">{item.branchId == null ? '—' : branchNames.get(item.branchId) ?? 'Branch'}</td>
            <td className="whitespace-nowrap px-4 py-3 text-xs font-medium">{formatPrice(item)}</td>
            <td className="px-4 py-3"><Status value={item.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>;
}

function AgentsTable({ items }: { items: AdminAgent[] }) {
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[760px] text-sm">
      <thead><tr className="border-b bg-muted/25 text-left text-xs text-muted-foreground">
        <th className="px-4 py-3 font-medium">Agent</th><th className="px-4 py-3 font-medium">Branch</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Listings</th><th className="px-4 py-3 font-medium">Open leads</th><th className="px-4 py-3 font-medium">Status</th>
      </tr></thead>
      <tbody>
        {items.length === 0 ? <EmptyRows colSpan={6} title="No agents assigned" detail="Agency team members assigned to its branches will appear here." testId="empty-agency-agents" /> : items.map((agent) => (
          <tr key={agent.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`row-agency-agent-${agent.id}`}>
            <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{agent.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="min-w-0"><span className="block truncate font-medium">{agent.name}</span><span className="block truncate text-xs text-muted-foreground">{agent.email || agent.phone || 'No contact details'}</span></span></div></td>
            <td className="px-4 py-3 text-xs text-muted-foreground">{agent.branchName}</td>
            <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{agent.role.replaceAll('_', ' ')}</td>
            <td className="px-4 py-3 text-xs tabular-nums">{agent.activeListings} active <span className="text-muted-foreground">/ {agent.totalListings} total</span></td>
            <td className="px-4 py-3 font-mono text-xs tabular-nums">{agent.openLeads}</td>
            <td className="px-4 py-3"><Status value={agent.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>;
}

function LeadsTable({ items, agentNames, listings }: { items: Lead[]; agentNames: Map<number, string>; listings: Property[] }) {
  const propertyNames = new Map(listings.map((property) => [property.id, property.title]));
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[740px] text-sm">
      <thead><tr className="border-b bg-muted/25 text-left text-xs text-muted-foreground">
        <th className="px-4 py-3 font-medium">Lead</th><th className="px-4 py-3 font-medium">Property</th><th className="px-4 py-3 font-medium">Assigned agent</th><th className="px-4 py-3 font-medium">Source</th><th className="px-4 py-3 font-medium">Stage</th><th className="px-4 py-3 font-medium">Created</th>
      </tr></thead>
      <tbody>
        {items.length === 0 ? <EmptyRows colSpan={6} title="No leads for this agency" detail="Leads assigned to its agents or linked to branch listings will appear here." testId="empty-agency-leads" /> : items.map((lead) => (
          <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`row-agency-lead-${lead.id}`}>
            <td className="px-4 py-3"><p className="font-medium">{lead.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{lead.email || lead.phone || 'No contact details'}</p></td>
            <td className="max-w-[220px] truncate px-4 py-3 text-xs text-muted-foreground">{lead.propertyId == null ? '—' : propertyNames.get(lead.propertyId) ?? '—'}</td>
            <td className="px-4 py-3 text-xs text-muted-foreground">{lead.agentId == null ? '—' : agentNames.get(lead.agentId) ?? '—'}</td>
            <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{lead.source?.replaceAll('_', ' ') || '—'}</td>
            <td className="px-4 py-3"><Status value={lead.stage} /></td>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{dateLabel(lead.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>;
}
