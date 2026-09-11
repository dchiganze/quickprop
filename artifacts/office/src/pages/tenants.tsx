import React from 'react';
import { Link } from 'wouter';
import { useListProperties } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, BadgeCheck, FileCheck2, Home, Search, ShieldCheck } from 'lucide-react';

function formatRent(price: number, currency: string) {
  return `${currency} ${price.toLocaleString()}/mo`;
}

export default function Tenants() {
  const { data: rentals, isLoading } = useListProperties({ listingType: 'rent', status: 'public' });
  const availableRentals = rentals ?? [];

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><Home className="h-6 w-6" /></div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tenants</h1>
            <p className="mt-1 text-muted-foreground">Help renters find a suitable home and prepare a complete application.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InfoCard icon={Search} title="Find the right rental" body="Compare available homes by area, price, size, and practical features before booking a viewing." />
        <InfoCard icon={FileCheck2} title="Prepare your application" body="Have identification, proof of income, references, and a clear move-in date ready for the letting agent." />
        <InfoCard icon={BadgeCheck} title="Build rental trust" body="Verified rental history and references can help landlords make decisions with better information." />
      </div>

      <Card className="border-primary/20 bg-primary/[0.04]">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="rounded-lg bg-primary/10 p-3 text-primary"><ShieldCheck className="h-5 w-5" /></div>
          <div className="flex-1">
            <h2 className="font-semibold">Tenant checklist</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Confirm the total monthly cost, deposit, utilities, lease length, maintenance process, and required documents before paying or signing.
            </p>
          </div>
          <Link href="/matches" className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-primary hover:underline">
            Explore matches <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Available rentals</h2>
            <p className="mt-1 text-sm text-muted-foreground">Published rental properties currently available through QuickProp.</p>
          </div>
          <span className="text-sm text-muted-foreground">{availableRentals.length} listing{availableRentals.length === 1 ? '' : 's'}</span>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => <Skeleton key={item} className="h-36 w-full rounded-xl" />)}
          </div>
        ) : availableRentals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-14 text-center">
              <Home className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <h3 className="font-semibold">No published rentals right now</h3>
              <p className="mt-1 text-sm text-muted-foreground">Check back soon as new rental properties are added.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableRentals.map((property) => (
              <Link key={property.id} href={`/property/${property.id}`} className="group">
                <Card className="h-full overflow-hidden transition-colors group-hover:border-primary/50">
                  {property.coverImage ? (
                    <img src={property.coverImage} alt="" className="h-36 w-full object-cover" />
                  ) : (
                    <div className="flex h-36 items-center justify-center bg-muted text-muted-foreground/30"><Home className="h-10 w-10" /></div>
                  )}
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold group-hover:text-primary">{property.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{property.suburb}, {property.city}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">To rent</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold text-primary">{formatRent(property.price, property.currency)}</span>
                      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-primary">View <ArrowRight className="h-3.5 w-3.5" /></span>
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