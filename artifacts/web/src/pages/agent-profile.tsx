import { useGetPublicAgent } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { PropertyCard } from "@/components/property-card";
import { useParams } from "wouter";
import { Phone, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AgentProfile() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { data, isLoading } = useGetPublicAgent(id, { query: { enabled: !!id } });

  if (isLoading || !data) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 flex justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </Layout>
    );
  }

  const { agent, listings } = data;

  return (
    <Layout>
      <div className="bg-gray-50 border-b">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="h-32 w-32 md:h-40 md:w-40 rounded-full border-4 border-white overflow-hidden bg-gray-100 shadow-md flex-shrink-0">
              {agent.avatarUrl ? (
                <img src={agent.avatarUrl} alt={agent.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-emerald-100 text-emerald-700 font-bold text-4xl">
                  {agent.name.charAt(0)}
                </div>
              )}
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{agent.name}</h1>
              <p className="text-lg text-gray-500 mb-6">{agent.branchName || 'Independent Agent'}</p>
              
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                {agent.phone && (
                  <Button className="bg-[#25D366] hover:bg-[#128C7E] text-white" asChild>
                    <a href={`https://wa.me/${agent.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      WhatsApp
                    </a>
                  </Button>
                )}
                {agent.phone && (
                  <Button variant="outline" asChild>
                    <a href={`tel:${agent.phone}`}>
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </a>
                  </Button>
                )}
                {agent.email && (
                  <Button variant="outline" asChild>
                    <a href={`mailto:${agent.email}`}>
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-6 bg-emerald-50 rounded-xl min-w-[120px]">
              <span className="text-4xl font-bold text-primary">{agent.activeListings}</span>
              <span className="text-sm font-medium text-emerald-800 uppercase tracking-wider mt-1">Listings</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Properties by {agent.name}</h2>
        
        {listings.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No active properties listed at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {listings.map(property => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
