import { useListPublicAgents } from "@workspace/api-client-react";
import { Link } from "wouter";
import { ArrowRight, BriefcaseBusiness, Mail, MapPin, Phone, ShieldCheck, Star } from "lucide-react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReviewSummary } from "@/components/review-rating";

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
  const agentsQuery = useListPublicAgents();
  const agents = agentsQuery.data ?? [];

  return (
    <Layout>
      <section className="border-b border-border bg-secondary/30">
        <div className="container mx-auto px-4 pb-12 pt-4 sm:pb-16 sm:pt-10">
          <div className="flex max-w-6xl flex-col justify-between gap-8 md:flex-row md:items-end">
            <div className="min-w-0 flex-1">
              <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                <ShieldCheck className="h-4 w-4" />
                People behind the property
              </div>
              <h1 className="whitespace-nowrap font-display text-[clamp(2rem,5vw,4.5rem)] leading-[0.95] text-foreground">Meet your local experts.</h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
                Find a real estate professional with the experience, local knowledge, and client recognition to move your next decision forward.
              </p>
            </div>
            <div className="hidden shrink-0 items-center gap-3 border-l border-border pl-5 text-sm text-muted-foreground sm:flex">
              <Star className="h-5 w-5 fill-accent text-accent" />
              <span>Reviews from completed mandates</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-10 sm:py-14">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">The directory</p>
            <h2 className="mt-2 font-display text-3xl text-foreground">Agents you can trust</h2>
          </div>
          {agents.length > 0 && <span className="text-sm text-muted-foreground" data-testid="text-agent-count">{agents.length} professionals</span>}
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
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <Card key={agent.id} className="group overflow-hidden border-border bg-card shadow-none transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_hsl(var(--primary)/0.12)]" data-testid={`card-agent-${agent.id}`}>
                <CardContent className="p-0">
                  <div className="relative h-28 overflow-hidden bg-primary">
                    <div className="absolute -right-8 -top-16 h-40 w-40 rounded-full border-[18px] border-accent/40" />
                    <div className="absolute -bottom-12 left-7 h-32 w-32 rounded-full border border-primary-foreground/15" />
                    <div className="absolute bottom-3 left-5 rounded-full bg-primary-foreground/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-foreground">
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
                      <span className="flex items-center gap-1.5 pb-1 text-xs text-muted-foreground" data-testid={`text-agent-location-${agent.id}`}>
                        <MapPin className="h-3.5 w-3.5" />
                        {agent.branchName || "Independent"}
                      </span>
                    </div>
                    <h3 className="font-display text-3xl leading-none text-foreground" data-testid={`text-agent-name-${agent.id}`}>{agent.name}</h3>
                    <div className="mt-4">
                      <ReviewSummary averageRating={agent.reviewSummary.averageRating} reviewCount={agent.reviewSummary.reviewCount} compact />
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 border-y border-border py-4 text-sm">
                      <div>
                        <p className="text-2xl font-semibold text-primary" data-testid={`text-agent-listings-${agent.id}`}>{agent.activeListings}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Active listings</p>
                      </div>
                      <div className="border-l border-border pl-4">
                        <p className="text-2xl font-semibold text-primary">{agent.reviewSummary.reviewCount}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Client reviews</p>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        {agent.phone && <Phone className="h-4 w-4" aria-label="Phone available" />}
                        {agent.email && <Mail className="h-4 w-4" aria-label="Email available" />}
                      </div>
                      <Button asChild size="sm" className="gap-2 rounded-lg" data-testid={`button-view-agent-${agent.id}`}>
                        <Link href={`/agents/${agent.id}`}>
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