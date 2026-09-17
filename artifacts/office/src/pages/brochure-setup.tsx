import React, { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Home,
  Layers3,
  ListChecks,
  Loader2,
  Map as MapIcon,
  SlidersHorizontal,
  User,
  Users,
} from 'lucide-react';
import {
  getListPropertiesQueryKey,
  getListUsersQueryKey,
  useGetCurrentUser,
  useListProperties,
  useListUsers,
} from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

type BrochureMode = 'my' | 'company' | 'custom';
type FilterKey = 'sale' | 'rent';
type GroupKey = 'residential_commercial' | 'land';

const PUBLIC_STATUSES = ['public', 'under_offer', 'coming_soon'];
const LAND_TYPES = ['stand', 'mine', 'mining', 'farm', 'other_land', 'land', 'plot', 'vacant_land'];

function propertyGroup(propertyType: string): GroupKey {
  return LAND_TYPES.includes(propertyType.toLowerCase()) ? 'land' : 'residential_commercial';
}

function formatPrice(price: number, currency: string, listingType: string) {
  const value = price >= 1_000_000
    ? `${(price / 1_000_000).toFixed(1)}M`
    : price.toLocaleString();
  return `${currency} ${value}${listingType === 'rent' ? ' / mo' : ''}`;
}

function initials(name?: string | null) {
  return name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'AG';
}

export default function BrochureSetup() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<BrochureMode>('my');
  const [listingTypes, setListingTypes] = useState<Set<FilterKey>>(new Set(['sale', 'rent']));
  const [propertyGroups, setPropertyGroups] = useState<Set<GroupKey>>(new Set(['residential_commercial', 'land']));
  const [selectedPropIds, setSelectedPropIds] = useState<Set<number>>(new Set());
  const [expandedAgents, setExpandedAgents] = useState<Set<number>>(new Set());

  const { data: currentUser, isLoading: currentUserLoading } = useGetCurrentUser();
  const { data: users, isLoading: usersLoading, isError: usersError } = useListUsers({
    query: { queryKey: getListUsersQueryKey(), enabled: true },
  });
  const { data: allPropsData, isLoading: propertiesLoading, isError: propertiesError } = useListProperties(undefined, {
    query: { queryKey: getListPropertiesQueryKey(), enabled: true },
  });

  const agents = useMemo(
    () => (users ?? []).filter((user) => user.role === 'agent' || user.role === 'admin'),
    [users],
  );
  const publicProperties = useMemo(
    () => (allPropsData ?? []).filter((property) => PUBLIC_STATUSES.includes(property.status)),
    [allPropsData],
  );
  const propsByAgent = useMemo(() => {
    const map = new Map<number, typeof publicProperties>();
    agents.forEach((agent) => map.set(agent.id, publicProperties.filter((property) => property.agentId === agent.id)));
    return map;
  }, [agents, publicProperties]);

  const baseProperties = useMemo(() => {
    if (mode === 'my') return publicProperties.filter((property) => property.agentId === currentUser?.id);
    if (mode === 'custom') return publicProperties.filter((property) => selectedPropIds.has(property.id));
    return publicProperties;
  }, [currentUser?.id, mode, publicProperties, selectedPropIds]);

  const filteredProperties = useMemo(
    () => baseProperties.filter((property) =>
      listingTypes.has(property.listingType as FilterKey) &&
      propertyGroups.has(propertyGroup(property.propertyType)),
    ),
    [baseProperties, listingTypes, propertyGroups],
  );

  const toggleSetValue = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        if (next.size === 1) return current;
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const toggleAgent = (agentId: number) => {
    const agentProperties = propsByAgent.get(agentId) ?? [];
    setSelectedPropIds((current) => {
      const next = new Set(current);
      const allSelected = agentProperties.length > 0 && agentProperties.every((property) => next.has(property.id));
      agentProperties.forEach((property) => {
        if (allSelected) next.delete(property.id);
        else next.add(property.id);
      });
      return next;
    });
  };

  const toggleProperty = (propertyId: number) => {
    setSelectedPropIds((current) => {
      const next = new Set(current);
      if (next.has(propertyId)) next.delete(propertyId);
      else next.add(propertyId);
      return next;
    });
  };

  const toggleAgentExpanded = (agentId: number) => {
    setExpandedAgents((current) => {
      const next = new Set(current);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const handleGenerate = () => {
    const params = new URLSearchParams({
      mode,
      listingTypes: [...listingTypes].join(','),
      propertyGroups: [...propertyGroups].join(','),
    });
    if (mode === 'custom') params.set('props', [...selectedPropIds].join(','));
    setLocation(`/brochure-catalog?${params.toString()}`);
  };

  const isLoading = currentUserLoading || usersLoading || propertiesLoading;
  const hasError = usersError || propertiesError;
  const canGenerate = filteredProperties.length > 0;

  React.useEffect(() => {
    document.title = 'Set up brochure | QuickProp Office';
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[70dvh] p-6 lg:p-10">
        <div className="mx-auto max-w-6xl space-y-6 animate-pulse">
          <div className="h-6 w-36 rounded bg-muted" />
          <div className="h-14 w-3/4 rounded bg-muted" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="h-[520px] rounded-xl bg-muted" />
            <div className="h-[420px] rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex min-h-[70dvh] items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-destructive/25 bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold">We could not load your listings</h1>
          <p className="mt-2 text-sm text-muted-foreground">Refresh the page and try again. Your brochure setup will be ready when the listing data is available.</p>
          <Button data-testid="button-retry-brochure-setup" className="mt-5" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="ledger-grid border-b border-border/70">
        <div className="mx-auto max-w-6xl px-5 pb-8 pt-7 sm:px-8 lg:px-10 lg:pb-10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <FileText className="h-4 w-4" />
            Brochure studio
          </div>
          <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <h1 data-testid="text-brochure-setup-title" className="max-w-2xl text-3xl font-extrabold tracking-[-0.05em] text-foreground sm:text-4xl">
                Build a catalogue your clients can act on.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                Choose a starting set, tighten the brief, and generate a print-ready brochure in a few clicks.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Live listing inventory
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-7">
            <div>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">01 / Starting point</p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight">Choose what to include</h2>
                </div>
                <Badge variant="secondary" className="hidden sm:inline-flex">{filteredProperties.length} matching listings</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <ModeCard
                  mode="my"
                  selected={mode === 'my'}
                  icon={User}
                  label="My Listings"
                  description="Your published properties"
                  count={publicProperties.filter((property) => property.agentId === currentUser?.id).length}
                  onClick={() => setMode('my')}
                />
                <ModeCard
                  mode="company"
                  selected={mode === 'company'}
                  icon={Building2}
                  label="Company Catalogue"
                  description="Every published listing"
                  count={publicProperties.length}
                  onClick={() => setMode('company')}
                />
                <ModeCard
                  mode="custom"
                  selected={mode === 'custom'}
                  icon={Users}
                  label="Custom selection"
                  description="Pick agents and properties"
                  count={selectedPropIds.size}
                  onClick={() => setMode('custom')}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">02 / Refine the brief</p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight">What should the catalogue show?</h2>
                </div>
                <SlidersHorizontal className="mt-1 h-5 w-5 text-primary" />
              </div>
              <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
                <FilterGroup title="Listing type" icon={ListChecks}>
                  <FilterButton
                    data-testid="checkbox-listing-type-sale"
                    checked={listingTypes.has('sale')}
                    onClick={() => toggleSetValue(setListingTypes, 'sale')}
                    label="For Sale"
                    detail={`${baseProperties.filter((property) => property.listingType === 'sale').length} available`}
                  />
                  <FilterButton
                    data-testid="checkbox-listing-type-rent"
                    checked={listingTypes.has('rent')}
                    onClick={() => toggleSetValue(setListingTypes, 'rent')}
                    label="To Rent"
                    detail={`${baseProperties.filter((property) => property.listingType === 'rent').length} available`}
                  />
                </FilterGroup>
                <FilterGroup title="Property group" icon={Layers3}>
                  <FilterButton
                    data-testid="checkbox-property-group-residential-commercial"
                    checked={propertyGroups.has('residential_commercial')}
                    onClick={() => toggleSetValue(setPropertyGroups, 'residential_commercial')}
                    label="Residential & Commercial"
                    detail="Homes, apartments, commercial"
                  />
                  <FilterButton
                    data-testid="checkbox-property-group-land"
                    checked={propertyGroups.has('land')}
                    onClick={() => toggleSetValue(setPropertyGroups, 'land')}
                    label="Stands / Mines / Farms / Other land"
                    detail="Land and agricultural listings"
                  />
                </FilterGroup>
              </div>
            </div>

            {mode === 'custom' && (
              <div className="rounded-xl border border-border bg-card shadow-sm">
                <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">03 / Specific listings</p>
                    <h2 className="mt-1 text-xl font-bold tracking-tight">Pick agents and properties</h2>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <button data-testid="button-select-all-properties" className="text-primary hover:underline" onClick={() => setSelectedPropIds(new Set(publicProperties.map((property) => property.id)))}>
                      Select all
                    </button>
                    <span className="text-border">|</span>
                    <button data-testid="button-clear-all-properties" className="text-muted-foreground hover:text-foreground hover:underline" onClick={() => setSelectedPropIds(new Set())}>
                      Clear
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {agents.length === 0 ? (
                    <div data-testid="empty-brochure-agents" className="px-6 py-10 text-center text-sm text-muted-foreground">No agents with published listings were found.</div>
                  ) : agents.map((agent) => {
                    const agentProperties = propsByAgent.get(agent.id) ?? [];
                    const selectedCount = agentProperties.filter((property) => selectedPropIds.has(property.id)).length;
                    const expanded = expandedAgents.has(agent.id);
                    return (
                      <div key={agent.id}>
                        <div className="flex items-center gap-3 px-5 py-3 sm:px-6">
                          <Checkbox
                            data-testid={`checkbox-agent-${agent.id}`}
                            checked={agentProperties.length > 0 && selectedCount === agentProperties.length}
                            onCheckedChange={() => toggleAgent(agent.id)}
                            aria-label={`Select ${agent.name}`}
                          />
                          <Avatar className="h-8 w-8 border border-primary/10">
                            <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{initials(agent.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p data-testid={`text-agent-name-${agent.id}`} className="truncate text-sm font-semibold">{agent.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{agent.email}</p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-xs">{selectedCount}/{agentProperties.length}</Badge>
                          <button
                            data-testid={`button-toggle-agent-${agent.id}`}
                            onClick={() => toggleAgentExpanded(agent.id)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${agent.name} listings`}
                          >
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </div>
                        {expanded && (
                          <div className="bg-muted/30 px-5 pb-3 pl-14 sm:px-6 sm:pl-[4.5rem]">
                            {agentProperties.length === 0 ? (
                              <p className="py-2 text-xs text-muted-foreground">No published listings for this agent.</p>
                            ) : agentProperties.map((property) => (
                              <label key={property.id} className="flex cursor-pointer items-center gap-3 border-t border-border/70 py-2.5">
                                <Checkbox
                                  data-testid={`checkbox-property-${property.id}`}
                                  checked={selectedPropIds.has(property.id)}
                                  onCheckedChange={() => toggleProperty(property.id)}
                                />
                                <Home className="h-3.5 w-3.5 shrink-0 text-primary" />
                                <span data-testid={`text-property-title-${property.id}`} className="min-w-0 flex-1 truncate text-xs font-semibold">{property.title}</span>
                                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{property.reference}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="overflow-hidden rounded-xl border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg">
              <div className="border-b border-sidebar-border px-5 py-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-sidebar-primary">
                  <MapIcon className="h-4 w-4" />
                  Catalogue check
                </div>
                <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em]">Ready when you are.</h2>
                <p className="mt-2 text-sm leading-5 text-sidebar-foreground/65">
                  Your brochure will include the live matching set below.
                </p>
              </div>
              <div className="grid grid-cols-3 divide-x divide-sidebar-border border-b border-sidebar-border">
                <SummaryStat value={filteredProperties.length} label="Listings" testId="text-brochure-listing-count" />
                <SummaryStat value={filteredProperties.filter((property) => property.listingType === 'sale').length} label="For sale" testId="text-brochure-sale-count" />
                <SummaryStat value={filteredProperties.filter((property) => property.listingType === 'rent').length} label="To rent" testId="text-brochure-rent-count" />
              </div>
              <div className="space-y-3 px-5 py-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-sidebar-foreground/60">Source</span>
                  <span data-testid="text-brochure-source" className="font-semibold">{mode === 'my' ? 'My listings' : mode === 'company' ? 'Company catalogue' : 'Custom selection'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-sidebar-foreground/60">Filters</span>
                  <span data-testid="text-brochure-filter-count" className="font-semibold">{listingTypes.size + propertyGroups.size} active</span>
                </div>
                <Separator className="bg-sidebar-border" />
                <Button
                  data-testid="button-generate-brochure"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="w-full justify-between bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 disabled:opacity-45"
                >
                  {canGenerate ? 'Generate brochure' : 'No matching listings'}
                  {canGenerate ? <ArrowRight className="h-4 w-4" /> : <Loader2 className="h-4 w-4" />}
                </Button>
                <p className="text-center text-[11px] leading-4 text-sidebar-foreground/45">The catalogue opens in the Office print view.</p>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>Only published, public listings are available for brochures. Under offer and coming soon listings stay eligible.</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function ModeCard({
  mode,
  selected,
  icon: Icon,
  label,
  description,
  count,
  onClick,
}: {
  mode: BrochureMode;
  selected: boolean;
  icon: React.ElementType;
  label: string;
  description: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      data-testid={`button-mode-${mode}`}
      onClick={onClick}
      className={`group relative flex min-h-[120px] flex-col items-start rounded-xl border-2 p-4 text-left transition-all ${
        selected ? 'border-primary bg-primary/[0.06] shadow-sm' : 'border-border bg-card hover:border-primary/35 hover:bg-muted/30'
      }`}
      aria-pressed={selected}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:text-primary'}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent'}`}>
          <Check className="h-3 w-3" />
        </span>
      </div>
      <span className="mt-4 text-sm font-bold">{label}</span>
      <span className="mt-1 text-xs text-muted-foreground">{description}</span>
      <span className="absolute bottom-4 right-4 font-mono text-[10px] font-medium text-muted-foreground">{count}</span>
    </button>
  );
}

function FilterGroup({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FilterButton({
  checked,
  onClick,
  label,
  detail,
  'data-testid': dataTestId,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
  detail: string;
  'data-testid': string;
}) {
  return (
    <button
      data-testid={dataTestId}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${checked ? 'border-primary/45 bg-primary/[0.06]' : 'border-border hover:bg-muted/40'}`}
      aria-pressed={checked}
    >
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-transparent'}`}>
        <Check className="h-3 w-3" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold">{label}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}

function SummaryStat({ value, label, testId }: { value: number; label: string; testId: string }) {
  return (
    <div className="px-3 py-4 text-center">
      <span data-testid={testId} className="block text-xl font-bold tracking-[-0.05em]">{value}</span>
      <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/50">{label}</span>
    </div>
  );
}