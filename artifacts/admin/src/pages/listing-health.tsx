import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  getGetAdminListingHealthQueryKey,
  useGetAdminListingHealth,
  useRunAdminListingHousekeeping,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const statusLabel: Record<string, string> = {
  new: "New",
  fresh: "Fresh",
  due: "Due",
  update_required: "Update required",
  potentially_stale: "Potentially stale",
  stale: "Stale",
  inactive: "Inactive",
};

export default function ListingHealth() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useGetAdminListingHealth();
  const run = useRunAdminListingHousekeeping({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAdminListingHealthQueryKey() }) },
  });
  const summary = data?.summary ?? {};
  const attention = (summary.due ?? 0) + (summary.update_required ?? 0) + (summary.potentially_stale ?? 0) + (summary.stale ?? 0);
  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sidebar-primary"><ShieldCheck className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[0.18em]">Marketplace health</span></div>
          <h1 className="text-3xl font-bold tracking-tight">Listing Health</h1>
          <p className="mt-1 text-muted-foreground">Monitor freshness, quality, and confirmation activity across all agencies.</p>
        </div>
        <Button onClick={() => run.mutate()} disabled={run.isPending}><Play className="mr-2 h-4 w-4" />{run.isPending ? "Running…" : "Run housekeeping now"}</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Total", summary.total ?? 0, "text-foreground"],
          ["Fresh", summary.fresh ?? 0, "text-emerald-600"],
          ["Due", (summary.due ?? 0) + (summary.update_required ?? 0), "text-amber-600"],
          ["Potentially stale", summary.potentially_stale ?? 0, "text-rose-600"],
          ["Stale", summary.stale ?? 0, "text-red-600"],
        ].map(([label, value, color]) => <Card key={String(label)}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div></CardContent></Card>)}
      </div>
      {attention > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertTriangle className="mr-2 inline h-4 w-4" />{attention} listings require an agent confirmation or update.</div>}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle>Agent scorecard</CardTitle><Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: getGetAdminListingHealthQueryKey() })}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></CardHeader>
        <CardContent>
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading health report…</p>}
          {isError && <p className="py-8 text-center text-sm text-destructive">Could not load listing health.</p>}
          <div className="divide-y">
            {(data?.agents ?? []).map((agent) => <div key={agent.agentId} className="flex items-center justify-between py-4"><div><p className="font-semibold">Agent #{agent.agentId}</p><p className="text-xs text-muted-foreground">{agent.total} listings · {agent.due} due · {agent.stale} stale</p></div><div className="text-right"><p className="text-xl font-bold">{agent.averageFreshnessScore}</p><p className="text-xs text-muted-foreground">avg freshness</p></div></div>)}
            {!isLoading && !data?.agents?.length && <p className="py-8 text-center text-sm text-muted-foreground">No agent listing data yet.</p>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Listings needing review</CardTitle></CardHeader>
        <CardContent><div className="divide-y">{(data?.listings ?? []).filter((listing) => ["due", "update_required", "potentially_stale", "stale"].includes(listing.freshnessStatus)).slice(0, 30).map((listing) => <div key={`${listing.propertyId}-${listing.relationshipId ?? "property"}`} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{listing.reference} · {listing.title}</p><p className="text-xs text-muted-foreground">{listing.suburb} · Agent #{listing.agentId ?? "unassigned"}</p></div><Badge variant="outline">{statusLabel[listing.freshnessStatus] ?? listing.freshnessStatus}</Badge></div>)}{!isLoading && !(data?.listings ?? []).some((listing) => ["due", "update_required", "potentially_stale", "stale"].includes(listing.freshnessStatus)) && <p className="py-8 text-center text-sm text-emerald-700"><CheckCircle2 className="mr-2 inline h-4 w-4" />All active listings are fresh.</p>}</div></CardContent>
      </Card>
    </div>
  );
}