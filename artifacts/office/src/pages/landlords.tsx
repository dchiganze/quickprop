import React from 'react';
import { Link } from 'wouter';
import { useListProperties } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Banknote, Building2, CheckCircle2, ClipboardCheck, Home, ShieldCheck } from 'lucide-react';

const activeStatuses = new Set(['public', 'under_offer', 'coming_soon']);

function formatRent(price: number, currency: string) {
  return `${currency} ${price.toLocaleString()}/mo`;
}

export default function Landlords() {
  const { data: rentals, isLoading } = useListProperties({ listingType: 'rent' });
  const activeRentals = rentals?.filter((property) => activeStatuses.has(property.status)) ?? [];
  const publishedCount = activeRentals.filter((property) => property.status === 'public').length;
  const viewingReadyCount = activeRentals.filter((property) => (property.photos?.length ?? 0) > 0 && (property.proposedViewingTimes?.length ?? 0) > 0).length;
  const averageRent = activeRentals.length
    ? Math.round(activeRentals.reduce((total, property) => total + property.price, 0) / activeRentals.length)
    : 0;

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary"><Home className="h-6 w-6" /></div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Landlords</h1>
              <p className="mt-1 text-muted-foreground">Manage rental properties and keep landlords confident from listing to lease.</p>
            </div>
          </div>
        </div>
        <Link href="/inventory" className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
          Add rental property <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active rentals" value={activeRentals.length} icon={Building2} />
        <StatCard label="Published" value={publishedCount} icon={CheckCircle2} />
        <StatCard label="Viewing-ready" value={viewingReadyCount} icon={ClipboardCheck} />
        <StatCard label="Average asking rent" value={averageRent ? `USD ${averageRent.toLocaleString()}` : '—'} icon={Banknote} />
      </div>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Landlord essentials</h2>
          <p className="mt-1 text-sm text-muted-foreground">The information that keeps a rental mandate moving and reduces avoidable delays.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <InfoCard icon={ClipboardCheck} title="Set clear expectations" body="Keep the asking rent, deposit, availability date, fees, and viewing times current before enquiries arrive." />
          <InfoCard icon={ShieldCheck} title="Keep records private" body="Store landlord contact details and internal notes in Office while only publishing the information prospective tenants need." />
          <InfoCard icon={CheckCircle2} title="Confirm every handover" body="Use viewing notes, tenant screening, and rental references to keep a clear record from first enquiry to signed lease." />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Rental portfolio</h2>
            <p className="mt-1 text-sm text-muted-foreground">Current rental listings in your agency inventory.</p>
          </div>
          <Link href="/inventory" className="text-sm font-semibold text-primary hover:underline">View inventory</Link>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-32 w-full rounded-xl" />)}
          </div>
        ) : activeRentals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-14 text-center">
              <Home className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <h3 className="font-semibold">No active rental listings</h3>
              <p className="mt-1 text-sm text-muted-foreground">Add a rental property to start building your landlord portfolio.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {activeRentals.slice(0, 6).map((property) => (
              <Link key={property.id} href={`/property/${property.id}`} className="group">
                <Card className="h-full transition-colors group-hover:border-primary/50">
                  <CardContent className="flex items-start justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{property.reference}</span>
                        <Badge variant="secondary" className="text-[10px] capitalize">{property.status.replace(/_/g, ' ')}</Badge>
                      </div>
                      <h3 className="truncate font-semibold group-hover:text-primary">{property.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{property.suburb}, {property.city}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold text-primary">{formatRent(property.price, property.currency)}</p>
                      <ArrowRight className="ml-auto mt-3 h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="rounded-lg bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoCard({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Icon className="h-5 w-5 text-primary" />
        <CardTitle className="pt-2 text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-6 text-muted-foreground">{body}</CardContent>
    </Card>
  );
}