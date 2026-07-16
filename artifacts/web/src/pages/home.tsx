import { useGetMarketplaceStats, useListPublicProperties } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { PropertyCard } from "@/components/property-card";
import { SearchBar } from "@/components/SearchBar";
import { ShieldCheck, TrendingUp, Users } from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const { data: stats } = useGetMarketplaceStats();
  const { data: featuredData } = useListPublicProperties({ limit: 6, sort: "-views" });
  const [, setLocation] = useLocation();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative bg-primary pt-20 pb-0 md:pt-28 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute top-1/2 -left-24 w-64 h-64 rounded-full bg-white blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white mb-8">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 leading-tight">
              Find your next home in <span className="text-emerald-200">Zimbabwe</span>
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 font-medium">
              The most trusted property marketplace. Verified agents, real listings.
            </p>
          </div>

          {stats && (
            <div className="mb-8 flex flex-wrap justify-center gap-6 md:gap-12 text-white/90">
              <div className="text-center">
                <p className="text-3xl font-bold">{stats.totalListings.toLocaleString()}</p>
                <p className="text-sm font-medium opacity-80 uppercase tracking-wider">Active Listings</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{stats.forSale.toLocaleString()}</p>
                <p className="text-sm font-medium opacity-80 uppercase tracking-wider">For Sale</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{stats.forRent.toLocaleString()}</p>
                <p className="text-sm font-medium opacity-80 uppercase tracking-wider">To Rent</p>
              </div>
            </div>
          )}
        </div>

        {/* Search bar sits at bottom of hero on a white card */}
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto bg-white rounded-t-2xl shadow-2xl px-6 pt-2 pb-0">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-12 bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center max-w-5xl mx-auto">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-emerald-50 text-primary rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Verified Agents Only</h3>
              <p className="text-gray-500 text-sm">Every listing on QuickProp comes from a registered, verified estate agent.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-emerald-50 text-primary rounded-full flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Real-Time Updates</h3>
              <p className="text-gray-500 text-sm">Market moves fast. We update listings the moment agents publish them.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-emerald-50 text-primary rounded-full flex items-center justify-center mb-4">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Direct Connection</h3>
              <p className="text-gray-500 text-sm">Enquire directly with the agent managing the mandate via email or WhatsApp.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Featured Properties</h2>
              <p className="text-gray-500">Most viewed listings across Zimbabwe right now.</p>
            </div>
            <Button variant="outline" className="hidden md:flex" onClick={() => setLocation("/search")}>
              View All
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {featuredData?.properties.map(property => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>

          <div className="mt-10 text-center md:hidden">
            <Button variant="outline" className="w-full" onClick={() => setLocation("/search")}>
              View All Properties
            </Button>
          </div>
        </div>
      </section>

      {/* Popular Suburbs */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Popular Suburbs</h2>
          <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
            {stats?.suburbs.slice(0, 15).map(suburb => (
              <Button
                key={suburb}
                variant="secondary"
                className="bg-gray-100 hover:bg-primary hover:text-white rounded-full transition-colors"
                onClick={() => setLocation(`/search?q=${encodeURIComponent(suburb)}`)}
              >
                {suburb}
              </Button>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
