import React, { useState } from 'react';
import { useListLeads, useGetLeadTimeline } from '@workspace/api-client-react';
import { Search, ChevronDown, ChevronRight, Clock, User, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  attempted_contact: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  viewing_booked: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20',
  viewed: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  offer_made: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  under_contract: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  completed: 'bg-emerald-700/10 text-emerald-800 border-emerald-700/20',
  lost: 'bg-red-500/10 text-red-700 border-red-500/20',
  cold: 'bg-muted text-muted-foreground',
};

function LeadRow({ lead }: { lead: any }) {
  const [expanded, setExpanded] = useState(false);
  const { data: timeline } = useGetLeadTimeline(lead.id, { query: { enabled: expanded } as any });

  return (
    <>
      <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
        <td className="px-4 py-3">
          <Button variant="ghost" size="icon" className="h-6 w-6 mr-1" onClick={() => setExpanded((x) => !x)}>
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </Button>
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-foreground text-sm">{lead.buyerName ?? lead.buyerId ?? '—'}</p>
          {lead.buyerEmail && <p className="text-xs text-muted-foreground">{lead.buyerEmail}</p>}
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">{lead.propertyTitle ?? lead.propertyId ?? '—'}</td>
        <td className="px-4 py-3">
          <Badge variant="outline" className={`text-xs capitalize border ${STAGE_COLORS[lead.stage] ?? 'bg-muted text-muted-foreground'}`}>
            {lead.stage?.replace('_', ' ')}
          </Badge>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{lead.source?.replace('_', ' ')}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{lead.agentId ?? '—'}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
          {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '—'}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/10 border-b border-border/50">
          <td />
          <td colSpan={6} className="px-6 py-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Timeline</p>
            {!timeline ? (
              <Skeleton className="h-16 w-full" />
            ) : timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No timeline entries</p>
            ) : (
              <div className="space-y-2">
                {timeline.map((entry: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="w-1.5 h-1.5 mt-2 rounded-full bg-primary flex-shrink-0" />
                    <div>
                      <span className="font-medium text-foreground capitalize">{entry.type?.replace('_', ' ')}</span>
                      {entry.note && <span className="text-muted-foreground ml-2">— {entry.note}</span>}
                      {entry.agentName && <span className="text-muted-foreground ml-2">by {entry.agentName}</span>}
                      <span className="text-muted-foreground/60 ml-2 text-xs">
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function Leads() {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const { data: leads, isLoading } = useListLeads();

  const filtered = (leads ?? []).filter((l: any) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (l.buyerName ?? '').toLowerCase().includes(q) || (l.propertyTitle ?? '').toLowerCase().includes(q);
    const matchStage = stageFilter === 'all' || l.stage === stageFilter;
    return matchSearch && matchStage;
  });

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Lead Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All inbound leads across the entire platform</p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">{(leads ?? []).length} leads</Badge>
      </div>

      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3 space-y-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search buyer, property…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-muted/40" />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="attempted_contact">Attempted contact</SelectItem>
              <SelectItem value="viewing_booked">Viewing booked</SelectItem>
              <SelectItem value="viewed">Viewed</SelectItem>
              <SelectItem value="offer_made">Offer made</SelectItem>
              <SelectItem value="under_contract">Under contract</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
              <SelectItem value="cold">Cold</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-10 px-4 py-3" />
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Buyer</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Property</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-36">Stage</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Source</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-24">Agent</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Created</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-16 text-center text-sm text-muted-foreground">No leads found</td></tr>
                ) : (
                  filtered.map((l: any) => <LeadRow key={l.id} lead={l} />)
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
