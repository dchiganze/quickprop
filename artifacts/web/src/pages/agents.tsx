import { getListPublicAgentsQueryKey, useListPublicAgents } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, Building2, Search, ShieldCheck, Star, X } from "lucide-react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const [search, setSearch] = useState("");
  const filteredAgents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return agents;
    return agents.filter((agent) =>
      [agent.name, agent.agencyName, agent.branchName, agent.role]
        .some((value) => value?.toLocaleLowerCase().includes(term)),
    );
  }, [agents, search]);

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
              <div className="flex max-w-md items-center gap-3 rounded-xl border border-border bg-card p-2 shadow-sm shadow-primary/5 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
                <Search className="ml-2 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <label htmlFor="agent-directory-search" className="sr-only">Search agents by name, agency, branch or role</label>
                <input
                  id="agent-directory-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, agency or branch"
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  data-testid="input-agent-search"
                />
                {search && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Clear agent search"
                    onClick={() => setSearch("")}
                    className="h-9 w-9 shrink-0 rounded-lg"
                    data-testid="button-clear-agent-search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="h-4 w-4 fill-accent text-accent" aria-hidden="true" />
                <span>Reviews from completed mandates</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-10 sm:py-14">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">The directory</p>
            <h2 className="mt-2 font-display text-3xl text-foreground">Agents you can trust</h2>
          </div>
          {!agentsQuery.isLoading && !agentsQuery.isError && agents.length > 0 && (
            <span className="text-sm text-muted-foreground" data-testid="text-agent-count" aria-live="polite">
              {search.trim()
                ? `${filteredAgents.length} of ${agents.length} professionals`
                : `${agents.length} ${agents.length === 1 ? "professional" : "professionals"}`}
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
        ) : filteredAgents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center" data-testid="status-agents-no-results">
            <Search className="mx-auto h-8 w-8 text-primary/70" aria-hidden="true" />
            <h3 className="mt-4 font-display text-2xl text-foreground">No matching professionals.</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Try another name, agency, branch or role.
            </p>
            <Button type="button" variant="outline" onClick={() => setSearch("")} className="mt-5" data-testid="button-reset-agent-search">
              Clear search
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