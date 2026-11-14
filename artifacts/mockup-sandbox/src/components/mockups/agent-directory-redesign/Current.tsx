import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { ArrowRight, BriefcaseBusiness, Building2, Mail, Phone, Search, ShieldCheck, Star, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReviewSummary } from "@/components/review-rating";
import "./_group.css";

type LinkProps = ComponentProps<"a"> & { href: string };

function Link({ href, ...props }: LinkProps) {
  return <a href={href} {...props} />;
}

function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <img src="/__mockup/images/quickprop-logo.png" alt="QuickProp" className="h-8 w-auto" />
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#properties">Buy</a><a href="#properties">Rent</a><a href="#tenants">Tenants</a><a className="text-primary" href="#agents">Agents</a>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <span className="rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">⌕ Quick search</span>
            <span className="text-sm text-muted-foreground">Log in</span>
            <span className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Sign up</span>
          </div>
          <span className="text-sm text-primary md:hidden">Menu</span>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="mt-auto border-t bg-card py-10">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 text-sm text-muted-foreground md:grid-cols-4">
          <div><img src="/__mockup/images/quickprop-logo.png" alt="QuickProp" className="mb-3 h-7 w-auto" /><p className="max-w-xs">Zimbabwe’s trusted property marketplace. Find your next home or connect with verified real estate agents.</p></div>
          <div><strong className="text-foreground">Properties</strong><p className="mt-3">Houses for Sale</p><p className="mt-2">Houses to Rent</p></div>
          <div><strong className="text-foreground">Agents</strong><p className="mt-3">Find an Agent</p><p className="mt-2">Agencies in Harare</p></div>
          <div><strong className="text-foreground">Contact</strong><p className="mt-3">support@quickprop.co.zw</p><p className="mt-2">Harare, Zimbabwe</p></div>
        </div>
      </footer>
    </div>
  );
}

function formatPrice(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

const sampleAgents = [
  { id: 1, name: "Tadiwa Moyo", agencyName: "QuickProp Realty", branchName: "Borrowdale", role: "senior_agent", avatarUrl: null, medianSalePrices: [{ medianPrice: 275000, currency: "USD" }], activeListings: 7, reviewSummary: { averageRating: 4.9, reviewCount: 18 }, phone: "+263 77 123 4567", email: "tadiwa@example.co.zw" },
  { id: 2, name: "Farai Ncube", agencyName: "Harare Property Group", branchName: "Avondale", role: "agent", avatarUrl: null, medianSalePrices: [{ medianPrice: 180000, currency: "USD" }], activeListings: 4, reviewSummary: { averageRating: 4.7, reviewCount: 9 }, phone: "+263 77 234 5678", email: "farai@example.co.zw" },
  { id: 3, name: "Rudo Chigaro", agencyName: "Cedar Properties", branchName: "Mount Pleasant", role: "principal", avatarUrl: null, medianSalePrices: [{ medianPrice: 225000, currency: "USD" }], activeListings: 12, reviewSummary: { averageRating: 5, reviewCount: 31 }, phone: "+263 77 345 6789", email: "rudo@example.co.zw" },
];

function AgentsSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="loading-agents">
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div key={item} className="h-72 rounded-2xl bg-secondary" />
      ))}
    </div>
  );
}

export default function Agents() {
  const agentsQuery = { data: sampleAgents, isLoading: false, isError: false, refetch: () => undefined };
  const agents = agentsQuery.data;
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
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="list-public-agents">
            {filteredAgents.map((agent) => (
              <Card key={agent.id} className="group overflow-hidden border-border bg-card shadow-none transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_hsl(var(--primary)/0.12)]" data-testid={`card-agent-${agent.id}`}>
                <CardContent className="p-0">
                  <div className="relative h-28 overflow-hidden bg-primary">
                    <div aria-hidden="true" className="absolute -right-8 -top-16 h-40 w-40 rounded-full border-[18px] border-accent/40 transition-transform duration-500 group-hover:scale-110" />
                    <div aria-hidden="true" className="absolute -bottom-12 left-7 h-32 w-32 rounded-full border border-primary-foreground/15" />
                    <div className="absolute bottom-3 right-5 rounded-full bg-primary-foreground/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-foreground" data-testid={`text-agent-role-${agent.id}`}>
                      {agent.role.replace(/_/g, " ")}
                    </div>
                  </div>
                  <div className="relative px-5 pb-5">
                    <div className="-mt-10 mb-4 flex items-end justify-between">
                      <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-card bg-accent shadow-md">
                        {agent.avatarUrl ? (
                          <img src={agent.avatarUrl} alt={agent.name} className="h-full w-full object-cover" data-testid={`img-agent-avatar-${agent.id}`} />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary" data-testid={`text-agent-initials-${agent.id}`}>
                            {agent.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                          </div>
                        )}
                      </div>
                      {agent.branchName && (
                        <span className="flex max-w-[60%] items-center gap-1.5 pb-1 text-right text-xs text-muted-foreground" data-testid={`text-agent-branch-${agent.id}`}>
                          <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{agent.branchName}</span>
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-3xl leading-none text-foreground" data-testid={`text-agent-name-${agent.id}`}>{agent.name}</h3>
                    {agent.agencyName && <p className="mt-2 text-sm text-muted-foreground" data-testid={`text-agent-agency-${agent.id}`}>{agent.agencyName}</p>}
                    <div className="mt-4">
                      <ReviewSummary averageRating={agent.reviewSummary.averageRating} reviewCount={agent.reviewSummary.reviewCount} compact />
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 border-y border-border py-4 text-sm">
                      <div>
                        <p className="text-2xl font-semibold text-primary" data-testid={`text-agent-listings-${agent.id}`}>{agent.activeListings}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Active listings</p>
                      </div>
                      <div className="border-l border-border pl-4">
                        <p className="text-2xl font-semibold text-primary" data-testid={`text-agent-reviews-${agent.id}`}>{agent.reviewSummary.reviewCount}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Client reviews</p>
                      </div>
                    </div>
                    <div className="mt-4 text-sm" data-testid={`text-agent-median-${agent.id}`}>
                      <p className="text-xs text-muted-foreground">Median sale price</p>
                      {agent.medianSalePrices && agent.medianSalePrices.length > 0 ? (
                        <p className="font-semibold text-foreground">{agent.medianSalePrices.map((m) => formatPrice(m.medianPrice, m.currency)).join(" · ")}</p>
                      ) : (
                        <p className="text-muted-foreground">No sales recorded yet</p>
                      )}
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        {agent.phone && <Phone className="h-4 w-4" aria-label="Phone available" />}
                        {agent.email && <Mail className="h-4 w-4" aria-label="Email available" />}
                      </div>
                      <Button asChild size="sm" className="gap-2 rounded-lg" data-testid={`button-view-agent-${agent.id}`}>
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