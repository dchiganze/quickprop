import React from 'react';
import { useListLeads } from '@workspace/api-client-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, Mail, Link as LinkIcon, Target } from 'lucide-react';
import { format } from 'date-fns';

const STAGES = [
  'new', 'attempted_contact', 'viewing_booked', 'offer_received', 'negotiation', 'completed', 'lost'
];

function LeadCard({ lead }: { lead: any }) {
  const getSourceColor = (source: string) => {
    if (source === 'website') return 'bg-blue-100 text-blue-800';
    if (source === 'whatsapp') return 'bg-green-100 text-green-800';
    if (source === 'referral') return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-3 bg-card border border-border shadow-sm rounded-md hover:border-primary/50 transition-colors cursor-pointer group mb-3 last:mb-0 relative hover-elevate">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">{lead.name}</h4>
        {lead.source && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${getSourceColor(lead.source)}`}>
            {lead.source.replace('_', ' ')}
          </span>
        )}
      </div>
      
      <div className="flex flex-col gap-1 mt-2">
        {lead.phone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="w-3 h-3" /> {lead.phone}
          </div>
        )}
        {lead.propertyId && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary mt-1">
            <LinkIcon className="w-3 h-3" /> Ref: {lead.propertyId}
          </div>
        )}
      </div>

      <div className="text-[10px] text-muted-foreground mt-3 pt-2 border-t border-border/50">
        Added {format(new Date(lead.createdAt), 'MMM d')}
      </div>
    </div>
  );
}

export default function Leads() {
  const { data: leads, isLoading } = useListLeads();

  // Group leads by stage
  const groupedLeads = STAGES.reduce((acc, stage) => {
    acc[stage] = leads?.filter(l => l.stage === stage) || [];
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="h-full flex flex-col p-8 max-w-[1600px] mx-auto overflow-hidden">
      <div className="flex items-end justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-8 h-8 text-primary" /> Leads Pipeline
          </h1>
          <p className="text-muted-foreground mt-1">Track and convert incoming leads into deals.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-6 h-full overflow-hidden">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="w-72 shrink-0 flex flex-col gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4 snap-x">
          {STAGES.map((stage) => (
            <div key={stage} className="w-72 shrink-0 flex flex-col bg-muted/30 rounded-xl border border-border/40 snap-center">
              <div className="p-3 flex items-center justify-between shrink-0 border-b border-border/40 bg-muted/50 rounded-t-xl">
                <h3 className="font-semibold text-sm capitalize">{stage.replace(/_/g, ' ')}</h3>
                <Badge variant="secondary" className="bg-background shadow-sm text-xs px-2">
                  {groupedLeads[stage].length}
                </Badge>
              </div>
              <ScrollArea className="flex-1 p-2">
                {groupedLeads[stage].map(lead => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
                {groupedLeads[stage].length === 0 && (
                  <div className="text-center p-4 border border-dashed border-border rounded-lg m-1 opacity-50">
                    <p className="text-xs text-muted-foreground">Empty</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}