import React from 'react';
import { useGetAgentContacts } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AgentContactDirectory } from '@/components/agent-contact-directory';

export default function Sellers() {
  const { data: sellers, isLoading, isError, refetch } = useGetAgentContacts({ type: 'seller' });

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sellers</h1>
          <p className="text-muted-foreground mt-1">Seller contacts, mandate records, and review requests for your listings.</p>
        </div>
      </div>

      {isLoading ? <div className="grid gap-4 md:grid-cols-2">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-48 w-full" />)}</div>
        : isError ? <div className="rounded-xl border p-8 text-center"><p className="mb-3 text-sm text-muted-foreground">Could not load sellers.</p><button className="text-sm font-semibold text-primary" onClick={() => refetch()}>Try again</button></div>
          : <AgentContactDirectory contacts={sellers ?? []} kind="seller" />}
    </div>
  );
}