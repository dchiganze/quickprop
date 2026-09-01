import { useGetPublicMe, useListSavedProperties, getGetPublicMeQueryKey, getListSavedPropertiesQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertyCard } from "@/components/property-card";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Heart, Home, User } from "lucide-react";
import { RentalProfilePanel } from "@/components/rental-profile-panel";
import { PropertyAlertsPanel } from "@/components/property-alerts-panel";

export default function Account() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading, error } = useGetPublicMe({ query: { retry: false, queryKey: getGetPublicMeQueryKey() } });
  const { data: savedProperties, isLoading: savedLoading } = useListSavedProperties({ query: { enabled: !!user, queryKey: getListSavedPropertiesQueryKey() } });

  useEffect(() => {
    // If auth fails, redirect to login
    if (!userLoading && (error || !user)) {
      setLocation("/login");
    }
  }, [user, userLoading, error, setLocation]);

  if (userLoading || !user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 flex justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-gray-50 border-b py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900">My Account</h1>
          <p className="text-gray-500 mt-2">Welcome back, {user.name}</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <Tabs defaultValue="alerts" className="max-w-6xl mx-auto">
          <TabsList className="mb-8 h-auto w-full flex-wrap justify-start gap-1 bg-gray-100">
            <TabsTrigger value="alerts" data-testid="tab-property-alerts" className="px-3 sm:px-6 data-[state=active]:bg-white">
              <Bell className="h-4 w-4 mr-2" />
              Property Alerts
            </TabsTrigger>
            <TabsTrigger value="saved" data-testid="tab-saved-properties" className="px-3 sm:px-6 data-[state=active]:bg-white">
              <Heart className="h-4 w-4 mr-2" />
              Saved Properties
            </TabsTrigger>
            <TabsTrigger value="rental-profile" data-testid="tab-rental-profile" className="px-3 sm:px-6 data-[state=active]:bg-white">
              <Home className="h-4 w-4 mr-2" />
              Rental Profile
            </TabsTrigger>
            <TabsTrigger value="profile" data-testid="tab-profile-details" className="px-3 sm:px-6 data-[state=active]:bg-white">
              <User className="h-4 w-4 mr-2" />
              Profile Details
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="saved">
            {savedLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : savedProperties && savedProperties.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {savedProperties.map(property => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed">
                <Heart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No saved properties</h3>
                <p className="text-gray-500">When you find a property you like, tap the heart icon to save it here.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="profile">
            <Card className="max-w-2xl border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Full Name</p>
                    <p className="text-gray-900 font-medium">{user.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Email Address</p>
                    <p className="text-gray-900 font-medium">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Phone Number</p>
                    <p className="text-gray-900 font-medium">{user.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Account Type</p>
                    <p className="text-gray-900 font-medium capitalize">{user.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rental-profile">
            <RentalProfilePanel />
          </TabsContent>

          <TabsContent value="alerts">
            <PropertyAlertsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
