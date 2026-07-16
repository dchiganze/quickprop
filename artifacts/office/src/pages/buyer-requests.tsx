import React, { useState } from 'react';
import { useListBuyerRequests, BuyerRequest } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, MapPin, DollarSign, Calendar, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

function RequestCard({ request }: { request: BuyerRequest }) {
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'new': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'responded': return 'bg-green-100 text-green-800 border-green-200';
      case 'closed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="hover-elevate transition-all border-l-4 border-l-primary group">
      <CardContent className="p-5 flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold text-foreground">{request.buyerName || 'Anonymous Buyer'}</h4>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span>{request.email || 'No email'}</span>
                <span>•</span>
                <span>{request.phone || 'No phone'}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(request.createdAt), 'MMM d, yyyy')}</span>
              </div>
            </div>
            <Badge className={getStatusColor(request.status)} variant="outline">
              {request.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
          
          <div className="bg-muted/50 p-3 rounded-md text-sm text-foreground/80 italic border-l-2 border-primary/30">
            "{request.requestText}"
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm">
            {(request.budgetMin || request.budgetMax) && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">
                  {request.budgetMin ? `$${request.budgetMin/1000}k` : '$0'} - {request.budgetMax ? `$${request.budgetMax/1000}k` : 'Any'}
                </span>
              </div>
            )}
            {request.areas && request.areas.length > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">{request.areas.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="w-full md:w-48 shrink-0 flex flex-col justify-center gap-2 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
          <Button className="w-full justify-between group-hover:bg-primary group-hover:text-primary-foreground">
            Find Matches
            <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100" />
          </Button>
          <Button variant="outline" className="w-full">
            Convert to Lead
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BuyerRequests() {
  const { data: requests, isLoading } = useListBuyerRequests();

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Buyer Requests</h1>
          <p className="text-muted-foreground mt-1">Incoming inquiries and unfulfilled property requests.</p>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
        ) : requests?.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-lg border border-dashed">
            <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No requests right now</h3>
            <p className="text-muted-foreground">New buyer requests from the portal will appear here.</p>
          </div>
        ) : (
          requests?.map(req => (
            <RequestCard key={req.id} request={req} />
          ))
        )}
      </div>
    </div>
  );
}