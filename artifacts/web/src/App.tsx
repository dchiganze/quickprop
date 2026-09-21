import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import Home from '@/pages/home';
import Search from '@/pages/search';
import PropertyDetail from '@/pages/property-detail';
import Agents from '@/pages/agents';
import AgentProfile from '@/pages/agent-profile';
import Review from '@/pages/review';
import Login from '@/pages/login';
import Register from '@/pages/register';
import Account from '@/pages/account';
import Support from '@/pages/support';
import MobileMarketing from '@/pages/mobile-marketing';
import Privacy from '@/pages/privacy';
import Terms from '@/pages/terms';
import NotFound from '@/pages/not-found';
import RentalReference from '@/pages/rental-reference';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/search" component={Search} />
      <Route path="/properties/:id" component={PropertyDetail} />
      <Route path="/agents" component={Agents} />
      <Route path="/review/:token" component={Review} />
      <Route path="/rental-reference/:token" component={RentalReference} />
      <Route path="/agents/:id" component={AgentProfile} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/account" component={Account} />
      <Route path="/support" component={Support} />
      <Route path="/app" component={MobileMarketing} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
