import { Link } from "wouter";
import { useGetPublicMe, getGetPublicMeQueryKey, useGetRentalProfile, getGetRentalProfileQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, BadgeCheck, Building2, FileCheck2, Home, LockKeyhole, ShieldCheck } from "lucide-react";

export default function Tenants() {
  const { data: user, isLoading: userLoading } = useGetPublicMe({ query: { retry: false, queryKey: getGetPublicMeQueryKey() } });
  const profile = useGetRentalProfile({ query: { enabled: !!user, retry: false, queryKey: getGetRentalProfileQueryKey() } });
  const verified = profile.data?.verifiedCount ?? 0;
  const total = profile.data?.totalCount ?? 0;

  return (
    <Layout>
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border/60 bg-[#e9eee5]">
          <div className="absolute -right-24 -top-28 h-[28rem] w-[28rem] rounded-full border border-primary/10" />
          <div className="absolute -right-8 -top-12 h-[21rem] w-[21rem] rounded-full border border-primary/10" />
          <div className="container relative mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-700">
              <p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-primary"><span className="h-px w-8 bg-primary" />A stronger way to rent</p>
              <h1 className="max-w-2xl font-display text-5xl leading-[1.02] text-foreground sm:text-7xl">Your next home starts with <em className="text-primary">your story.</em></h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">Find a place in Zimbabwe, then bring your rental history with you. A verified profile helps landlords understand the person behind the application.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full px-6"><Link href="/search?listingType=rent">Explore homes to rent <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                {user ? <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-primary/25 bg-background/70 px-6"><Link href="/account">Open my rental profile</Link></Button> : <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-primary/25 bg-background/70 px-6"><Link href="/login">Sign in to build your profile</Link></Button>}
              </div>
              <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4 text-primary" />You decide what to share, and when.</div>
            </div>
            <div className="relative mx-auto w-full max-w-lg animate-in fade-in slide-in-from-bottom-5 duration-700">
              <div className="absolute -inset-4 rotate-[-3deg] rounded-[2rem] bg-[#d2ddd0]" />
              <Card className="relative overflow-hidden rounded-[1.6rem] border-primary/10 bg-[#fbfaf4] shadow-xl shadow-primary/10">
                <div className="flex items-center justify-between border-b border-border/70 px-6 py-5">
                  <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Home className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Rental profile</p><p className="font-semibold text-foreground">{userLoading ? "Your profile" : user?.name ?? "A profile that moves with you"}</p></div></div>
                  <BadgeCheck className="h-6 w-6 text-primary" />
                </div>
                <CardContent className="p-6">
                  {user ? (
                    <>
                      <div className="mb-6 flex items-end justify-between"><div><p className="font-display text-5xl text-primary">{profile.isLoading ? "—" : verified}</p><p className="mt-1 text-sm text-muted-foreground">verified {verified === 1 ? "tenancy" : "tenancies"}</p></div><p className="rounded-full bg-[#e6eee5] px-3 py-1.5 text-xs font-semibold text-primary">{total} {total === 1 ? "stay" : "stays"} listed</p></div>
                      <div className="space-y-3">
                        {profile.isError ? <div className="rounded-xl border border-destructive/20 bg-destructive/[.04] p-4 text-sm"><p className="font-semibold text-destructive">Your rental profile couldn’t load.</p><button type="button" data-testid="button-retry-tenant-profile" onClick={() => profile.refetch()} className="mt-2 font-semibold text-primary underline underline-offset-2">Try again</button></div> : null}
                        {!profile.isError ? profile.data?.tenancies.slice(0, 2).map((stay) => <div key={stay.id} className="flex items-center gap-3 rounded-xl border border-border/65 bg-background/70 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary"><Building2 className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{stay.propertyAddress}</p><p className="text-xs text-muted-foreground">{stay.suburb}, {stay.city}</p></div><span className="text-xs font-semibold capitalize text-primary">{stay.verificationStatus.replace("_", " ")}</span></div>) : null}
                        {total === 0 && !profile.isLoading && !profile.isError ? <div className="rounded-xl border border-dashed border-primary/25 bg-primary/[.035] p-5 text-sm text-muted-foreground">Your first home story belongs here. Add a previous tenancy and invite a referee to verify it.</div> : null}
                        {profile.isLoading ? <div className="h-14 animate-pulse rounded-xl bg-muted" /> : null}
                      </div>
                      <Button asChild variant="ghost" className="mt-4 px-0 text-primary hover:bg-transparent"><Link href="/account">Manage rental history <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                    </>
                  ) : (
                    <div className="py-2">
                      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary"><FileCheck2 className="h-6 w-6" /></div>
                      <h2 className="font-display text-3xl">A record you carry forward.</h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">Build your rental profile once. Add stays and request a reference from a former landlord or an agency in the EAC directory.</p>
                      <Button asChild className="mt-5 rounded-full"><Link href="/register">Create your account <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        <section className="container mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="mb-10 max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Built around trust</p><h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">A clearer rental journey, from first search to signed keys.</h2></div>
          <div className="grid gap-4 md:grid-cols-[1.2fr_.8fr]">
            <article className="rounded-2xl bg-primary p-7 text-primary-foreground sm:p-9"><ShieldCheck className="h-7 w-7" /><h3 className="mt-8 font-display text-3xl">References with real context</h3><p className="mt-3 max-w-lg text-sm leading-6 text-primary-foreground/80">Invite a past landlord or registered agency to confirm a tenancy through a secure link. Their reference adds detail, not noise.</p></article>
            <article className="rounded-2xl border border-border/75 bg-card p-7 sm:p-9"><LockKeyhole className="h-7 w-7 text-accent" /><h3 className="mt-8 font-display text-3xl">Private by design</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Your history stays yours. Share your profile with prospective landlords only when you choose.</p></article>
          </div>
        </section>
      </main>
    </Layout>
  );
}
