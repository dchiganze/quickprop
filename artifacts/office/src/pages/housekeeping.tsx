import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import {
  getGetListingHousekeepingQueryKey,
  useApplyListingHousekeepingAction,
  useBulkConfirmListingHousekeeping,
  useGetListingHousekeeping,
} from "@workspace/api-client-react";
import type { ListingHousekeepingItem } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  fresh: "Fresh",
  due: "Due for confirmation",
  update_required: "Update required",
  potentially_stale: "Potentially stale",
  stale: "Stale",
  inactive: "Inactive",
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-sky-100 text-sky-800 border-sky-200",
  fresh: "bg-emerald-100 text-emerald-800 border-emerald-200",
  due: "bg-amber-100 text-amber-800 border-amber-200",
  update_required: "bg-orange-100 text-orange-800 border-orange-200",
  potentially_stale: "bg-rose-100 text-rose-800 border-rose-200",
  stale: "bg-red-100 text-red-800 border-red-200",
  inactive: "bg-muted text-muted-foreground border-border",
};

function ListingRow({
  listing,
  selected,
  onSelect,
  onConfirm,
  onAction,
}: {
  listing: ListingHousekeepingItem;
  selected: boolean;
  onSelect: () => void;
  onConfirm: () => void;
  onAction: (action: string) => void;
}) {
  const needsAttention = ["due", "update_required", "potentially_stale", "stale"].includes(listing.freshnessStatus);
  return (
    <div className="flex flex-col gap-3 border-b last:border-0 py-4 md:flex-row md:items-center" data-testid={`housekeeping-row-${listing.id}`}>
      <input aria-label={`Select ${listing.reference}`} type="checkbox" checked={selected} onChange={onSelect} className="h-4 w-4 accent-primary" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{listing.reference}</span>
          <Badge variant="outline" className={STATUS_STYLES[listing.freshnessStatus] ?? ""}>
            {STATUS_LABELS[listing.freshnessStatus] ?? listing.freshnessStatus}
          </Badge>
          {listing.availabilityStatus !== "available" && (
            <Badge variant="secondary">{listing.availabilityStatus.replaceAll("_", " ")}</Badge>
          )}
        </div>
        <p className="truncate text-sm text-foreground">{listing.title}</p>
        <p className="text-xs text-muted-foreground">{listing.suburb}, {listing.city} · {listing.daysSinceConfirmation} days since confirmation</p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground md:w-44">
        <span>Freshness <strong className="text-foreground">{listing.freshnessScore}</strong></span>
        <span>Quality <strong className="text-foreground">{listing.qualityScore}</strong></span>
        <span className="col-span-2">{listing.freshnessLabel}</span>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={onConfirm} disabled={listing.freshnessStatus === "inactive"} data-testid={`button-confirm-${listing.id}`}>
          <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirm
        </Button>
        {needsAttention && (
          <Button size="sm" variant="outline" onClick={() => onAction("update")}>
            Update
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onAction("mark_unavailable")}>
          Mark unavailable
        </Button>
      </div>
    </div>
  );
}

export default function Housekeeping() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useGetListingHousekeeping();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<number[]>([]);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetListingHousekeepingQueryKey() });
  const confirm = useBulkConfirmListingHousekeeping({ mutation: { onSuccess: () => { setSelected([]); invalidate(); } } });
  const action = useApplyListingHousekeepingAction({ mutation: { onSuccess: invalidate } });
  const listings = useMemo(() => (data?.listings ?? []).filter((listing) => filter === "all" || listing.freshnessStatus === filter), [data?.listings, filter]);
  const attentionCount = (data?.summary.due ?? 0) + (data?.summary.updateRequired ?? 0) + (data?.summary.potentiallyStale ?? 0) + (data?.summary.stale ?? 0);
  const toggle = (id: number) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const confirmSelected = () => {
    const rows = (data?.listings ?? []).filter((listing) => selected.includes(listing.id));
    confirm.mutate({ data: {
      relationshipIds: rows.filter((row) => row.relationshipId != null).map((row) => row.relationshipId!),
      propertyIds: rows.filter((row) => row.relationshipId == null).map((row) => row.propertyId),
    } });
  };
  const mutateAction = (listing: ListingHousekeepingItem, actionName: string) => action.mutate({
    data: { propertyId: listing.propertyId, relationshipId: listing.relationshipId ?? undefined, action: actionName },
  });

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary"><Sparkles className="h-5 w-5" /><span className="text-sm font-semibold uppercase tracking-wider">Listing operations</span></div>
          <h1 className="text-3xl font-bold tracking-tight">Listing Housekeeping</h1>
          <p className="mt-1 text-muted-foreground">Keep availability accurate, listings fresh, and marketplace trust high.</p>
        </div>
        <Button variant="outline" onClick={() => invalidate()}><RefreshCw className="mr-2 h-4 w-4" />Refresh queue</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {[
          ["all", "All", data?.summary.total ?? 0],
          ["new", "New", data?.summary.new ?? 0],
          ["fresh", "Fresh", data?.summary.fresh ?? 0],
          ["due", "Due", data?.summary.due ?? 0],
          ["update_required", "Update", data?.summary.updateRequired ?? 0],
          ["potentially_stale", "Potentially stale", data?.summary.potentiallyStale ?? 0],
          ["stale", "Stale", data?.summary.stale ?? 0],
        ].map(([key, label, count]) => (
          <button key={key} onClick={() => setFilter(String(key))} className={`rounded-lg border p-3 text-left transition-colors ${filter === key ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50"}`}>
            <div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold">{count}</div>
          </button>
        ))}
      </div>
      <Card className={attentionCount > 0 ? "border-amber-200" : ""}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg"><Clock3 className="h-5 w-5 text-primary" />Confirmation queue</CardTitle>
          <div className="flex items-center gap-2">
            {attentionCount > 0 && <span className="text-sm text-amber-700"><AlertTriangle className="mr-1 inline h-4 w-4" />{attentionCount} need attention</span>}
            <Button size="sm" disabled={selected.length === 0 || confirm.isPending} onClick={confirmSelected}>Confirm selected ({selected.length})</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading housekeeping queue…</p>}
          {isError && <p className="py-8 text-center text-sm text-destructive">Could not load listing housekeeping.</p>}
          {!isLoading && !isError && listings.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No listings in this view.</p>}
          {listings.map((listing) => <ListingRow key={`${listing.propertyId}-${listing.relationshipId ?? "property"}`} listing={listing} selected={selected.includes(listing.id)} onSelect={() => toggle(listing.id)} onConfirm={() => mutateAction(listing, "confirm")} onAction={(name) => mutateAction(listing, name)} />)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><SlidersHorizontal className="h-4 w-4" />Current policy</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
          <span>First confirmation: <strong className="text-foreground">{data?.thresholds.firstConfirmationDays ?? 14} days</strong></span>
          <span>Recurring confirmation: <strong className="text-foreground">{data?.thresholds.recurringConfirmationDays ?? 30} days</strong></span>
          <span>Stale after: <strong className="text-foreground">{data?.thresholds.staleOverdueDays ?? 30} overdue days</strong></span>
        </CardContent>
      </Card>
    </div>
  );
}