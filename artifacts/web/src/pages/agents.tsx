import { getListPublicAgentsQueryKey, useListPublicAgents } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, Building2, CalendarDays, ChevronDown, MapPin, Search, ShieldCheck, SlidersHorizontal, Star, X } from "lucide-react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPrice } from "@/lib/utils";
import { ReviewSummary } from "@/components/review-rating";

function AgentsSkeleton() {
  return (
    <div className="animate-pulse space-y-4" data-testid="loading-agents">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-40 rounded-2xl bg-secondary" />
      ))}
    </div>
  );
}

export default function Agents() {
  const agentsQuery = useListPublicAgents({ query: { queryKey: getListPublicAgentsQueryKey(), staleTime: 60_000, refetchOnMount: "always" } });
  const agents = agentsQuery.data ?? [];
  const [directoryMode, setDirectoryMode] = useState<"agents" | "agencies">("agents");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reviewedOnly, setReviewedOnly] = useState(false);
  const [activeListingsOnly, setActiveListingsOnly] = useState(false);
  const [minimumRating, setMinimumRating] = useState("any");

  const filteredAgents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return agents.filter((agent) =>
      (!term || (
        directoryMode === "agents"
          ? [agent.name, agent.agencyName, agent.branchName, agent.role]
          : [agent.agencyName, agent.branchName]
      ).some((value) => value?.toLocaleLowerCase().includes(term))) &&
      (!reviewedOnly || agent.reviewSummary.reviewCount > 0) &&
      (!activeListingsOnly || agent.activeListings > 0) &&
      (minimumRating === "any" || (agent.reviewSummary.averageRating ?? 0) >= Number(minimumRating)),
    );
  }, [agents, directoryMode, search, reviewedOnly, activeListingsOnly, minimumRating]);

  const agencyGroups = useMemo(() => {
    const groups = new Map<string, typeof agents>();
    for (const agent of filteredAgents) {
      const name = agent.agencyName?.trim();
      if (!name) continue;
      const group = groups.get(name) ?? [];
      group.push(agent);
      groups.set(name, group);
    }
    return Array.from(groups, ([name, members]) => ({ name, agents: members }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredAgents]);

  const totalAgencyCount = useMemo(
    () => new Set(agents.map((agent) => agent.agencyName?.trim()).filter((name): name is string => Boolean(name))).size,
    [agents],
  );
  const activeFilterCount = Number(reviewedOnly) + Number(activeListingsOnly) + Number(minimumRating !== "any");

  const clearFilters = () => {
    setReviewedOnly(false);
    setActiveListingsOnly(false);
    setMinimumRating("any");
  };

  return (
    <Layout>
      <section className="relative overflow-hidden border-b border-border bg-secondary/40">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-36 h-96 w-96 rounded-full border-[1px] border-primary/10 sm:right-[8%] sm:top-[-18rem] sm:h-[34rem] sm:w-[34rem]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 top-20 h-52 w-52 rounded-full border-[24px] border-accent/10 sm:right-[16%] sm:top-24" />
        <div className="container relative mx-auto px-4 pb-10 pt-6 sm:pb-14 sm:pt-12">
          <div className="grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
            <div className="min-w-0">
              <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                <ShieldCheck className="h-4 w-4" />
                People behind the property
              </div>
              <h1 className="max-w-3xl font-display text-[clamp(2.5rem,5vw,4rem)] leading-[0.98] tracking-[-0.035em] text-foreground">
                Meet your local experts.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                Find a real estate professional with the experience, local knowledge, and client recognition to move your next decision forward.
              </p>
            </div>
            <div className="relative z-10 lg:justify-self-end lg:pb-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="h-4 w-4 fill-accent text-accent" aria-hidden="true" />
                <span>Reviews from completed mandates</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-10 sm:py-14">
        <div className="mb-8 rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4" data-testid="agent-search-toolbar">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex shrink-0 rounded-xl border border-border bg-secondary/60 p-1" role="group" aria-label="Search agents or agencies">
              <button
                type="button"
                aria-pressed={directoryMode === "agents"}
                onClick={() => setDirectoryMode("agents")}
                className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors ${directoryMode === "agents" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                data-testid="button-directory-agents"
              >
                Agent
              </button>
              <button
                type="button"
                aria-pressed={directoryMode === "agencies"}
                onClick={() => setDirectoryMode("agencies")}
                className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors ${directoryMode === "agencies" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                data-testid="button-directory-agencies"
              >
                Agency
              </button>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-background px-3 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
              <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="agent-directory-search" className="sr-only">
                Search by agent, agency, or branch
              </label>
              <input
                id="agent-directory-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={directoryMode === "agents" ? "Agent, agency or branch" : "Agency or branch"}
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                data-testid="input-agent-search"
              />
              {search && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Clear directory search"
                  onClick={() => setSearch("")}
                  className="h-9 w-9 shrink-0 rounded-lg"
                  data-testid="button-clear-agent-search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled
                title="Time-based agent statistics are not available yet."
                aria-describedby="agent-period-unavailable"
                className="min-h-11 flex-1 gap-2 rounded-xl px-3 text-muted-foreground sm:flex-none"
                data-testid="button-agent-period"
              >
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                12 months
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span id="agent-period-unavailable" className="sr-only">
                Time-based agent statistics are not available yet.
              </span>
              <Button
                type="button"
                variant={filtersOpen || activeFilterCount > 0 ? "default" : "outline"}
                aria-expanded={filtersOpen}
                aria-controls="agent-directory-filters"
                onClick={() => setFiltersOpen((open) => !open)}
                className="min-h-11 flex-1 gap-2 rounded-xl px-3 sm:flex-none"
                data-testid="button-agent-filters"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground/20 px-1 text-xs font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {filtersOpen && (
            <div
              id="agent-directory-filters"
              role="region"
              aria-label="Agent directory filters"
              className="mt-4 border-t border-border pt-4"
              data-testid="panel-agent-filters"
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <Checkbox id="filter-reviewed-only" checked={reviewedOnly} onCheckedChange={(checked) => setReviewedOnly(checked === true)} />
                  <label htmlFor="filter-reviewed-only" className="cursor-pointer">Has client reviews</label>
                </div>
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <Checkbox id="filter-active-listings" checked={activeListingsOnly} onCheckedChange={(checked) => setActiveListingsOnly(checked === true)} />
                  <label htmlFor="filter-active-listings" className="cursor-pointer">Has active listings</label>
                </div>
                <label className="flex flex-col gap-1.5 text-sm text-foreground">
                  <span>Minimum client rating</span>
                  <select
                    value={minimumRating}
                    onChange={(event) => setMinimumRating(event.target.value)}
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="select-agent-minimum-rating"
                  >
                    <option value="any">Any rating</option>
                    <option value="4">4.0 or higher</option>
                    <option value="4.5">4.5 or higher</option>
                  </select>
                </label>
              </div>
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>Filters use ratings and listing counts available on public profiles.</span>
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters} disabled={activeFilterCount === 0} data-testid="button-clear-agent-filters">
                  Clear filters
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">The directory</p>
            <h2 className="mt-2 font-display text-3xl text-foreground">{directoryMode === "agents" ? "Agents you can trust" : "Agencies you can trust"}</h2>
          </div>
          {!agentsQuery.isLoading && !agentsQuery.isError && agents.length > 0 && (
            <span className="text-sm text-muted-foreground" data-testid="text-agent-count" aria-live="polite">
              {directoryMode === "agents"
                ? `${filteredAgents.length} of ${agents.length} professionals`
                : `${agencyGroups.length} of ${totalAgencyCount} agencies`}
            </span>
          )}
        </div>

        {agentsQuery.isLoading ? (
          <AgentsSkeleton />
        ) : agentsQuery.isError ? (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-8 text-center" role="alert" data-testid="status-agents-error">
            <p className="font-semibold text-foreground">We could not load the agent directory.</p>
            <p className="mt-2 text-sm text-muted-foreground">Check your connection, then give it another try.</p>
            <Button type="button" onClick={() => agentsQuery.refetch()} variant="outline" className="mt-5" data-testid="button-retry-agents">Try again</Button>
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center" data-testid="status-agents-empty">
            <BriefcaseBusiness className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-4 font-display text-2xl text-foreground">The directory is growing.</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">There are no public agent profiles available right now. Please check back soon.</p>
          </div>
        ) : directoryMode === "agencies" ? (
          agencyGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center" data-testid="status-agencies-empty">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <h3 className="mt-4 font-display text-2xl text-foreground">
                {totalAgencyCount === 0 ? "Agency profiles are not available yet." : "No agencies match these filters."}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Agent profiles are available, but this directory currently groups agencies only when an agency name is provided.
              </p>
              <Button type="button" variant="outline" onClick={() => setDirectoryMode("agents")} className="mt-5" data-testid="button-browse-agents">
                Browse agents
              </Button>
            </div>
          ) : (
            <div className="space-y-3" data-testid="list-public-agencies">
              {agencyGroups.map((group) => (
                <Card
                  key={group.name}
                  className="overflow-hidden border-border bg-card shadow-none transition-shadow hover:shadow-[0_12px_28px_hsl(var(--primary)/0.08)]"
                  data-testid={`card-agency-${group.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                >
                  <CardContent className="p-0">
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 marker:hidden sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Agency</p>
                          <h3 className="mt-1 truncate font-display text-2xl text-foreground">{group.name}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {group.agents.length} {group.agents.length === 1 ? "agent profile" : "agent profiles"}
                          </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-primary">
                          View agents
                          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                        </span>
                      </summary>
                      <div className="space-y-2 border-t border-border bg-secondary/20 p-3 sm:p-4">
                        {group.agents.map((agent) => (
                          <Link
                            key={agent.id}
                            href={`/agents/${agent.id}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3 transition-colors hover:border-primary/30 hover:bg-background sm:px-4"
                            data-testid={`link-agency-agent-${agent.id}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-foreground">{agent.name}</span>
                              <span className="mt-1 block truncate text-xs capitalize text-muted-foreground">
                                {[agent.role.replace(/_/g, " "), agent.branchName].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                            <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                          </Link>
                        ))}
                      </div>
                    </details>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : filteredAgents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center" data-testid="status-agents-no-results">
            <Search className="mx-auto h-8 w-8 text-primary/70" aria-hidden="true" />
            <h3 className="mt-4 font-display text-2xl text-foreground">No matching professionals.</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Try another name, agency, branch or role.
            </p>
            <Button type="button" variant="outline" onClick={() => { setSearch(""); clearFilters(); }} className="mt-5" data-testid="button-reset-agent-search">
              Clear search and filters
            </Button>
          </div>
        ) : (
          <div className="space-y-3" data-testid="list-public-agents">
            {filteredAgents.map((agent, index) => (
              <Card
                key={agent.id}
                className="group overflow-hidden border-border bg-card shadow-none transition-all duration-300 hover:border-primary/30 hover:shadow-[0_12px_28px_hsl(var(--primary)/0.08)]"
                data-testid={`card-agent-${agent.id}`}
              >
                <CardContent className="p-0">
                  <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-stretch">
                    <div className="flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:px-6 sm:py-5">
                      <div className="flex min-w-0 items-center gap-4 sm:w-[36%] sm:shrink-0">
                        <div className={`relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border ${index === 1 ? "bg-accent/20" : "bg-secondary"}`}>
                          {agent.avatarUrl ? (
                            <img src={agent.avatarUrl} alt={agent.name} className="h-full w-full object-cover" data-testid={`img-agent-avatar-${agent.id}`} />
                          ) : (
                            <span className="font-display text-2xl text-primary" data-testid={`text-agent-initials-${agent.id}`}>
                              {agent.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate font-display text-2xl leading-tight text-foreground" data-testid={`text-agent-name-${agent.id}`}>{agent.name}</h3>
                          {agent.agencyName && (
                            <p className="mt-1 truncate text-sm text-muted-foreground" data-testid={`text-agent-agency-${agent.id}`}>
                              {agent.agencyName}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold capitalize text-primary" data-testid={`text-agent-role-${agent.id}`}>
                              {agent.role.replace(/_/g, " ")}
                            </span>
                            {agent.branchName && (
                              <span className="inline-flex items-center gap-1">
                                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                                <span data-testid={`text-agent-branch-${agent.id}`}>{agent.branchName}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid flex-1 grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                        <div className="col-span-2 sm:col-span-1 sm:pl-1">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Client rating</p>
                          <div className="mt-1.5">
                            <ReviewSummary averageRating={agent.reviewSummary.averageRating} reviewCount={agent.reviewSummary.reviewCount} compact />
                          </div>
                        </div>
                        <div className="sm:border-l sm:border-border sm:pl-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Active listings</p>
                          <p className="mt-1 text-xl font-semibold tabular-nums text-primary" data-testid={`text-agent-listings-${agent.id}`}>{agent.activeListings}</p>
                        </div>
                        <div className="col-span-2 sm:col-span-1 sm:border-l sm:border-border sm:pl-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Median sale price</p>
                          <p className="mt-1 text-base font-semibold text-foreground" data-testid={`text-agent-median-${agent.id}`}>
                            {agent.medianSalePrices?.length
                              ? agent.medianSalePrices.map((m) => formatPrice(m.medianPrice, m.currency)).join(" · ")
                              : "No sales recorded yet"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end border-t border-border bg-secondary/30 px-4 py-3 sm:border-l sm:border-t-0 sm:px-5">
                      <Button asChild size="sm" className="w-full gap-2 rounded-lg sm:w-auto" data-testid={`button-view-agent-${agent.id}`}>
                        <Link href={`/agents/${agent.id}`} data-testid={`link-agent-profile-${agent.id}`}>
                          View profile
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}