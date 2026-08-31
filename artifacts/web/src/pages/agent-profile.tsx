import { useGetPublicAgent, getGetPublicAgentQueryKey } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { ArrowLeft, BadgeCheck, Mail, MessageSquare, Phone, Quote, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/layout";
import { PropertyCard } from "@/components/property-card";
import { ReviewSummary, RatingStars } from "@/components/review-rating";
import { Button } from "@/components/ui/button";

function ProfileSkeleton() {
  return (
    <div className="container mx-auto animate-pulse px-4 py-12" data-testid="loading-agent-profile">
      <div className="h-5 w-28 rounded-full bg-secondary" />
      <div className="mt-8 h-72 rounded-[2rem] bg-secondary" />
      <div className="mt-12 h-8 w-64 rounded-full bg-secondary" />
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
        {[1, 2, 3].map((item) => <div key={item} className="h-44 rounded-2xl bg-secondary" />)}
      </div>
    </div>
  );
}

function formatReviewDate(createdAt: string) {
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? createdAt : parsed.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function formatOutcome(outcome: string) {
  return outcome.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AgentProfile() {
  const params = useParams();
  const id = Number(params.id || 0);
  const profileQuery = useGetPublicAgent(id, {
    query: { enabled: Boolean(id), queryKey: getGetPublicAgentQueryKey(id) },
  });
  const data = profileQuery.data;

  if (profileQuery.isLoading) {
    return <Layout><ProfileSkeleton /></Layout>;
  }

  if (profileQuery.isError || !data) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center" data-testid="status-agent-profile-error">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Profile unavailable</p>
          <h1 className="mt-3 font-display text-4xl text-foreground">We could not find that agent.</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">The profile may have been removed or is temporarily unavailable.</p>
          <div className="mt-7 flex justify-center gap-3">
            <Button type="button" variant="outline" onClick={() => profileQuery.refetch()} data-testid="button-retry-agent-profile">Try again</Button>
            <Button asChild data-testid="button-browse-agents"><Link href="/agents">Browse agents</Link></Button>
          </div>
        </div>
      </Layout>
    );
  }

  const { agent, listings, reviews } = data;

  return (
    <Layout>
      <div className="border-b border-border bg-secondary/30">
        <div className="container mx-auto px-4 py-4">
          <Link href="/agents" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary" data-testid="link-back-agents">
            <ArrowLeft className="h-3.5 w-3.5" />
            All agents
          </Link>
        </div>
      </div>

      <section className="border-b border-border bg-secondary/30">
        <div className="container mx-auto px-4 pb-14 pt-8 sm:pb-20">
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
              <div className="h-32 w-32 shrink-0 overflow-hidden rounded-[1.6rem] border-4 border-card bg-accent shadow-[0_12px_30px_hsl(var(--primary)/0.14)] sm:h-40 sm:w-40">
                {agent.avatarUrl ? (
                  <img src={agent.avatarUrl} alt={agent.name} className="h-full w-full object-cover" data-testid="img-profile-avatar" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-primary" data-testid="text-profile-initials">
                    {agent.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                  </div>
                )}
              </div>
              <div className="pb-1">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  <ShieldCheck className="h-4 w-4" />
                  Public profile
                </div>
                <h1 className="font-display text-5xl leading-[0.92] text-foreground sm:text-7xl" data-testid="text-profile-name">{agent.name}</h1>
                <p className="mt-4 text-sm text-muted-foreground">{agent.branchName || "Independent real estate professional"}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {agent.phone && <Button asChild size="sm" className="gap-2 rounded-lg" data-testid="button-profile-whatsapp"><a href={`https://wa.me/${agent.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"><MessageSquare className="h-4 w-4" />WhatsApp</a></Button>}
                  {agent.phone && <Button asChild size="sm" variant="outline" className="gap-2 rounded-lg" data-testid="button-profile-call"><a href={`tel:${agent.phone}`}><Phone className="h-4 w-4" />Call</a></Button>}
                  {agent.email && <Button asChild size="sm" variant="outline" className="gap-2 rounded-lg" data-testid="button-profile-email"><a href={`mailto:${agent.email}`}><Mail className="h-4 w-4" />Email</a></Button>}
                </div>
              </div>
            </div>
            <div className="flex gap-8 border-t border-border pt-6 sm:border-t-0 sm:pt-0 lg:border-l lg:pl-8">
              <div>
                <p className="text-3xl font-semibold text-primary" data-testid="text-profile-listing-count">{agent.activeListings}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Listings</p>
              </div>
              <div className="border-l border-border pl-8">
                <p className="text-3xl font-semibold text-primary">{agent.reviewSummary.reviewCount}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">Reviews</p>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 sm:w-fit" data-testid="profile-review-summary">
            <ReviewSummary averageRating={agent.reviewSummary.averageRating} reviewCount={agent.reviewSummary.reviewCount} />
            {agent.reviewSummary.reviewCount > 0 && <span className="hidden h-5 w-px bg-border sm:block" />}
            <span className="text-xs text-muted-foreground">Recognition from completed mandates</span>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-12 sm:py-16">
        <section>
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Client recognition</p>
              <h2 className="mt-2 font-display text-4xl text-foreground">The work, in their words.</h2>
            </div>
            <span className="hidden text-sm text-muted-foreground sm:block">{reviews.length} verified {reviews.length === 1 ? "review" : "reviews"}</span>
          </div>
          {reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center" data-testid="status-reviews-empty">
              <Quote className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-4 font-display text-2xl text-foreground">No public reviews yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">Recognition from completed mandates will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {reviews.map((review, index) => (
                <article key={`${review.createdAt}-${index}`} className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8" data-testid={`card-review-${index}`}>
                  <Quote className="absolute right-6 top-6 h-12 w-12 text-accent/20" />
                  <div className="relative">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <RatingStars rating={review.rating} />
                      {review.verified && <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary" data-testid={`badge-review-verified-${index}`}><BadgeCheck className="h-3.5 w-3.5" />Verified</span>}
                    </div>
                    <blockquote className="mt-6 max-w-xl font-display text-2xl leading-snug text-foreground" data-testid={`text-review-excerpt-${index}`}>“{review.reviewText}”</blockquote>
                    <div className="mt-7 flex items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
                      <span>{formatOutcome(review.outcome)}</span>
                      <span>{formatReviewDate(review.createdAt)}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-16 border-t border-border pt-12 sm:mt-20 sm:pt-16">
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Current portfolio</p>
            <h2 className="mt-2 font-display text-4xl text-foreground">Properties by {agent.name}</h2>
          </div>
          {listings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center" data-testid="status-listings-empty">
              <p className="font-display text-2xl text-foreground">No active properties right now.</p>
              <p className="mt-2 text-sm text-muted-foreground">Check back soon for new listings.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((property) => <PropertyCard key={property.id} property={property} />)}
            </div>
          )}
        </section>
      </main>
    </Layout>
  );
}