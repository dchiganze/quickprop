import { useListPublicAgents } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Phone, Mail, MapPin } from "lucide-react";

export default function Agents() {
  const { data: agents, isLoading } = useListPublicAgents();

  return (
    <Layout>
      <div className="bg-primary/5 py-16 border-b">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Find an Agent</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Connect with verified real estate professionals who know the local market inside out.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {agents?.map((agent) => (
              <Card key={agent.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className="bg-gray-50 h-32 relative">
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
                      <div className="h-20 w-20 rounded-full border-4 border-white overflow-hidden bg-white shadow-sm">
                        {agent.avatarUrl ? (
                          <img src={agent.avatarUrl} alt={agent.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-emerald-100 text-emerald-700 font-bold text-2xl">
                            {agent.name.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-14 pb-6 px-6 text-center">
                    <h3 className="text-lg font-bold text-gray-900">{agent.name}</h3>
                    <p className="text-sm text-gray-500 mb-4">{agent.branchName || 'Independent Agent'}</p>
                    
                    <div className="flex items-center justify-center gap-4 text-sm text-gray-600 mb-6">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-primary text-lg">{agent.activeListings}</span>
                        <span className="text-xs uppercase tracking-wider">Listings</span>
                      </div>
                    </div>

                    <Button asChild className="w-full" variant="outline">
                      <Link href={`/agents/${agent.id}`}>View Profile</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
