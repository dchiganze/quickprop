import React, { useMemo, useState } from 'react';
import {
  getListAdminRentalReferencesQueryKey,
  useListAdminRentalReferences,
  useListRentalAgencies,
  useResendRentalReference,
  useUpdateRentalAgency,
  useUpdateRentalDispute,
} from '@workspace/api-client-react';
import type { AdminRentalHistory, RentalAgency } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Building2, CheckCircle2, Clock3, ExternalLink, FileCheck2, Mail, Search, ShieldCheck, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type Filter = 'all' | 'pending' | 'verified' | 'disputed' | 'not_verified';

function statusBadge(status: string) {
  if (status === 'verified') return <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>;
  if (status === 'pending') return <Badge className="gap-1 border-amber-200 bg-amber-50 text-amber-700"><Clock3 className="h-3 w-3" /> Pending</Badge>;
  if (status === 'not_verified') return <Badge className="gap-1 border-rose-200 bg-rose-50 text-rose-700"><XCircle className="h-3 w-3" /> Not verified</Badge>;
  return <Badge variant="secondary">{status.replace('_', ' ')}</Badge>;
}

function agencyBadge(status: string) {
  if (status === 'verified') return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Verified</Badge>;
  if (status === 'rejected') return <Badge className="border-rose-200 bg-rose-50 text-rose-700">Rejected</Badge>;
  return <Badge className="border-amber-200 bg-amber-50 text-amber-700">Awaiting review</Badge>;
}

function ReferenceRow({ history, onResend, isResending }: {
  history: AdminRentalHistory;
  onResend: (id: number) => void;
  isResending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const openDispute = history.disputes.find((dispute) => dispute.status === 'open' || dispute.status === 'under_review');
  const canResend = history.request && ['pending', 'sent'].includes(history.request.status);
  return (
    <div className="border-b border-border/60 last:border-0">
      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-foreground">{history.tenantName}</p>
            {statusBadge(history.verificationStatus)}
            {openDispute ? <Badge className="gap-1 border-orange-200 bg-orange-50 text-orange-700"><AlertTriangle className="h-3 w-3" /> Disputed</Badge> : null}
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{history.propertyAddress}, {history.suburb} · {history.tenantEmail}</p>
        </div>
        <div className="text-sm text-muted-foreground lg:w-44">
          <p className="font-medium text-foreground">{history.refereeName || 'No referee named'}</p>
          <p className="capitalize">{history.refereeType.replace('_', ' ')}</p>
        </div>
        <div className="flex items-center gap-2 lg:w-44 lg:justify-end">
          {canResend ? <Button variant="outline" size="sm" className="gap-1.5" disabled={isResending} onClick={() => history.request && onResend(history.request.id)}><Mail className="h-3.5 w-3.5" /> Resend</Button> : null}
          <Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Hide' : 'View'}</Button>
        </div>
      </div>
      {expanded ? (
        <div className="grid gap-4 bg-muted/20 px-5 pb-5 pt-1 md:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-background p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tenancy</p>
            <p className="mt-2 font-medium">{history.startDate} – {history.endDate}</p>
            <p className="mt-1 capitalize text-muted-foreground">{history.tenancyType.replace('_', ' ')}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Request</p>
            <p className="mt-2 font-medium capitalize">{history.request?.status?.replace('_', ' ') || 'Not requested'}</p>
            <p className="mt-1 text-muted-foreground">{history.request?.recipientEmail || history.request?.recipientPhone || 'No contact detail'}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reference answers</p>
            {history.reference?.verifiedTenancy ? (
              <p className="mt-2 text-sm text-emerald-700">Rent: {history.reference.rentPaymentRating}; condition: {history.reference.propertyConditionRating}; re-rent: {history.reference.wouldRentAgain ? 'yes' : 'no'}.</p>
            ) : <p className="mt-2 text-sm text-muted-foreground">No visible verified answers.</p>}
          </div>
          {history.disputes.length > 0 ? (
            <div className="md:col-span-3 rounded-lg border border-orange-200 bg-orange-50/60 p-4">
              <p className="text-sm font-semibold text-orange-900">Dispute history</p>
              {history.disputes.map((dispute) => <p key={dispute.id} className="mt-2 text-sm text-orange-900/80"><span className="font-medium capitalize">{dispute.status.replace('_', ' ')}:</span> {dispute.reason}</p>)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DisputeQueue({ histories, onUpdate, pendingId }: {
  histories: AdminRentalHistory[];
  onUpdate: (id: number, status: 'under_review' | 'resolved' | 'dismissed') => void;
  pendingId: number | null;
}) {
  const disputes = histories.flatMap((history) => history.disputes.map((dispute) => ({ ...dispute, tenantName: history.tenantName, propertyAddress: history.propertyAddress })))
    .filter((dispute) => dispute.status === 'open' || dispute.status === 'under_review');
  if (!disputes.length) {
    return <div className="flex items-center gap-3 px-5 py-7 text-sm text-muted-foreground"><ShieldCheck className="h-5 w-5 text-emerald-600" /> No open rental reference disputes.</div>;
  }
  return <div className="divide-y divide-orange-200/70">{disputes.map((dispute) => <div key={dispute.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-medium text-foreground">{dispute.tenantName} · {dispute.propertyAddress}</p><p className="mt-1 text-sm text-muted-foreground">{dispute.reason}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={pendingId === dispute.id} onClick={() => onUpdate(dispute.id, dispute.status === 'open' ? 'under_review' : 'resolved')}>{dispute.status === 'open' ? 'Mark under review' : 'Resolve'}</Button><Button size="sm" variant="ghost" disabled={pendingId === dispute.id} onClick={() => onUpdate(dispute.id, 'dismissed')}>Dismiss</Button></div></div>)}</div>;
}

function AgencyQueue({ agencies, onUpdate, pendingId }: {
  agencies: RentalAgency[];
  onUpdate: (agency: RentalAgency, verificationStatus: 'verified' | 'rejected') => void;
  pendingId: number | null;
}) {
  const pending = agencies.filter((agency) => agency.verificationStatus === 'pending');
  return (
    <div className="divide-y divide-border/60">
      {pending.length === 0 ? <div className="px-5 py-7 text-sm text-muted-foreground">No agencies awaiting verification.</div> : pending.map((agency) => (
        <div key={agency.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></div><div><p className="font-medium">{agency.name}</p><p className="mt-1 text-sm text-muted-foreground">{agency.email || agency.phone || 'No contact supplied'} · added {new Date(agency.createdAt).toLocaleDateString()}</p></div></div>
          <div className="flex gap-2"><Button size="sm" disabled={pendingId === agency.id} onClick={() => onUpdate(agency, 'verified')}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Verify</Button><Button size="sm" variant="outline" disabled={pendingId === agency.id} onClick={() => onUpdate(agency, 'rejected')}><XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject</Button></div>
        </div>
      ))}
    </div>
  );
}

export default function RentalReferences() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const { data: histories, isLoading, refetch } = useListAdminRentalReferences();
  const { data: agencies } = useListRentalAgencies();
  const resend = useResendRentalReference();
  const updateDispute = useUpdateRentalDispute();
  const updateAgency = useUpdateRentalAgency();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const filtered = useMemo(() => (histories ?? []).filter((history) => {
    const matchesSearch = !search || `${history.tenantName} ${history.tenantEmail} ${history.propertyAddress}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all'
      || history.verificationStatus === filter
      || (filter === 'disputed' && history.disputes.some((dispute) => dispute.status === 'open' || dispute.status === 'under_review'));
    return matchesSearch && matchesFilter;
  }), [filter, histories, search]);
  const openDisputes = (histories ?? []).reduce((count, history) => count + history.disputes.filter((dispute) => dispute.status === 'open' || dispute.status === 'under_review').length, 0);
  const pendingRequests = (histories ?? []).filter((history) => history.request && ['pending', 'sent'].includes(history.request.status)).length;

  const refresh = () => {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: getListAdminRentalReferencesQueryKey() });
  };
  const handleResend = (id: number) => {
    setPendingId(id);
    resend.mutate({ id }, { onSuccess: () => { toast({ title: 'Reference request resent' }); refresh(); setPendingId(null); }, onError: () => { toast({ title: 'Could not resend reference request', variant: 'destructive' }); setPendingId(null); } });
  };
  const handleDispute = (id: number, status: 'under_review' | 'resolved' | 'dismissed') => {
    setPendingId(id);
    updateDispute.mutate({ id, data: { status } }, { onSuccess: () => { toast({ title: 'Dispute updated' }); refresh(); setPendingId(null); }, onError: () => { toast({ title: 'Could not update dispute', variant: 'destructive' }); setPendingId(null); } });
  };
  const handleAgency = (agency: RentalAgency, verificationStatus: 'verified' | 'rejected') => {
    setPendingId(agency.id);
    updateAgency.mutate({ params: { id: agency.id }, data: { verificationStatus } }, { onSuccess: () => { toast({ title: verificationStatus === 'verified' ? 'Agency verified' : 'Agency rejected' }); setPendingId(null); }, onError: () => { toast({ title: 'Could not update agency', variant: 'destructive' }); setPendingId(null); } });
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-xl font-bold text-foreground">Rental references</h1><p className="mt-0.5 text-sm text-muted-foreground">Protect renter trust while keeping every verification request accountable.</p></div>
        <div className="flex gap-2"><Badge variant="secondary" className="px-3 py-1">{pendingRequests} pending requests</Badge><Badge variant={openDisputes ? 'destructive' : 'secondary'} className="px-3 py-1">{openDisputes} open disputes</Badge></div>
      </div>
      <div className="grid gap-4 md:grid-cols-3"><Card><CardContent className="flex items-center gap-3 p-4"><FileCheck2 className="h-5 w-5 text-primary" /><div><p className="text-2xl font-semibold">{(histories ?? []).filter((history) => history.verificationStatus === 'verified').length}</p><p className="text-xs text-muted-foreground">Verified stays</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-3 p-4"><Clock3 className="h-5 w-5 text-amber-600" /><div><p className="text-2xl font-semibold">{pendingRequests}</p><p className="text-xs text-muted-foreground">Awaiting response</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-3 p-4"><AlertTriangle className="h-5 w-5 text-orange-600" /><div><p className="text-2xl font-semibold">{openDisputes}</p><p className="text-xs text-muted-foreground">Open disputes</p></div></CardContent></Card></div>
      <Card>
        <CardHeader className="space-y-4 pb-3"><div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search tenant or property…" value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 bg-muted/40 pl-9" /></div><div className="flex flex-wrap gap-2">{(['all', 'pending', 'verified', 'not_verified', 'disputed'] as Filter[]).map((value) => <Button key={value} size="sm" variant={filter === value ? 'default' : 'outline'} onClick={() => setFilter(value)} className="capitalize">{value.replace('_', ' ')}</Button>)}</div></CardHeader>
        <CardContent className="p-0">{isLoading ? <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div> : filtered.length ? filtered.map((history) => <ReferenceRow key={history.id} history={history} onResend={handleResend} isResending={pendingId === history.request?.id} />) : <div className="flex flex-col items-center px-5 py-14 text-center text-sm text-muted-foreground"><FileCheck2 className="mb-3 h-8 w-8 text-muted-foreground/50" /><p>No rental history matches this view.</p></div>}</CardContent>
      </Card>
      <Card className="border-orange-200/70"><CardHeader className="border-b border-orange-200/70 pb-3"><h2 className="flex items-center gap-2 text-base font-semibold"><AlertTriangle className="h-4 w-4 text-orange-600" /> Disputes</h2><p className="text-sm text-muted-foreground">Review concerns without exposing private reference answers.</p></CardHeader><CardContent className="p-0"><DisputeQueue histories={histories ?? []} onUpdate={handleDispute} pendingId={pendingId} /></CardContent></Card>
      <Card><CardHeader className="border-b border-border/60 pb-3"><h2 className="flex items-center gap-2 text-base font-semibold"><Building2 className="h-4 w-4 text-primary" /> Agency verification</h2><p className="text-sm text-muted-foreground">Approve agencies before they can receive registered-agency reference requests.</p></CardHeader><CardContent className="p-0"><AgencyQueue agencies={agencies ?? []} onUpdate={handleAgency} pendingId={pendingId} /></CardContent></Card>
    </div>
  );
}