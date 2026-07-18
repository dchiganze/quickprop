import React from 'react';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { AdminLayout } from '@/components/layout/layout';

import NotFound from '@/pages/not-found';
import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import Properties from '@/pages/properties';
import Agencies from '@/pages/agencies';
import Agents from '@/pages/agents';
import Buyers from '@/pages/buyers';
import Leads from '@/pages/leads';
import Coverage from '@/pages/coverage';
import Freshness from '@/pages/freshness';
import Audit from '@/pages/audit';
import Settings from '@/pages/settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function ProtectedRoute({ component: Component, path }: { component: React.ComponentType<any>; path: string }) {
  const { data: user, isLoading, error } = useGetCurrentUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !user) return <Redirect to="/login" />;

  return (
    <Route path={path}>
      {(params) => (
        <AdminLayout>
          <Component params={params} />
        </AdminLayout>
      )}
    </Route>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/properties" component={Properties} />
      <ProtectedRoute path="/agencies" component={Agencies} />
      <ProtectedRoute path="/agents" component={Agents} />
      <ProtectedRoute path="/buyers" component={Buyers} />
      <ProtectedRoute path="/leads" component={Leads} />
      <ProtectedRoute path="/coverage" component={Coverage} />
      <ProtectedRoute path="/freshness" component={Freshness} />
      <ProtectedRoute path="/audit" component={Audit} />
      <ProtectedRoute path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
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
