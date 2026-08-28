import React from 'react';
import { Route, Switch, Router as WouterRouter, Redirect, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

import { useGetCurrentUser } from '@workspace/api-client-react';
import { Layout } from '@/components/layout/layout';

import NotFound from '@/pages/not-found';
import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import Inventory from '@/pages/inventory';
import Pipeline from '@/pages/pipeline';
import PropertyDetail from '@/pages/property-detail';
import PropertyBrochure from '@/pages/property-brochure';
import BrochureCatalog from '@/pages/brochure-catalog';
import Buyers from '@/pages/buyers';
import BuyerRequests from '@/pages/buyer-requests';
import Leads from '@/pages/leads';
import Tasks from '@/pages/tasks';
import CalendarPage from '@/pages/calendar';
import Documents from '@/pages/documents';
import Sellers from '@/pages/sellers';
import Analytics from '@/pages/analytics';
import Users from '@/pages/users';
import Audit from '@/pages/audit';
import Settings from '@/pages/settings';
import Housekeeping from '@/pages/housekeeping';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, path }: { component: React.ComponentType<any>, path: string }) {
  const { data: user, isLoading, error } = useGetCurrentUser();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  }

  if (error || !user) {
    return <Redirect to="/login" />;
  }

  return (
    <Route path={path}>
      {(params) => (
        <Layout>
          <Component params={params} />
        </Layout>
      )}
    </Route>
  );
}

/** Layout-free protected route — used for print pages like brochures */
function ProtectedBarePage({ component: Component, path }: { component: React.ComponentType<any>, path: string }) {
  const { data: user, isLoading, error } = useGetCurrentUser();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-white"><div className="w-8 h-8 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" /></div>;
  }

  if (error || !user) {
    return <Redirect to="/login" />;
  }

  return (
    <Route path={path}>
      {(params) => <Component params={params} />}
    </Route>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/inventory" component={Inventory} />
      <ProtectedRoute path="/inventory/pipeline" component={Pipeline} />
      <ProtectedRoute path="/housekeeping" component={Housekeeping} />
      <ProtectedBarePage path="/brochure-catalog" component={BrochureCatalog} />
      <ProtectedBarePage path="/property/:id/brochure" component={PropertyBrochure} />
      <ProtectedRoute path="/property/:id" component={PropertyDetail} />
      <ProtectedRoute path="/buyers" component={Buyers} />
      <ProtectedRoute path="/buyer-requests" component={BuyerRequests} />
      <ProtectedRoute path="/leads" component={Leads} />
      <ProtectedRoute path="/tasks" component={Tasks} />
      <ProtectedRoute path="/calendar" component={CalendarPage} />
      <ProtectedRoute path="/documents" component={Documents} />
      <ProtectedRoute path="/sellers" component={Sellers} />
      <ProtectedRoute path="/analytics" component={Analytics} />
      <ProtectedRoute path="/users" component={Users} />
      <ProtectedRoute path="/audit" component={Audit} />
      <ProtectedRoute path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
