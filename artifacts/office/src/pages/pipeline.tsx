import React from 'react';
import { useGetPipeline, useUpdateProperty } from '@workspace/api-client-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Image as ImageIcon } from 'lucide-react';
import { Link } from 'wouter';

function PipelineCard({ property }: { property: any }) {
  return (
    <Link href={`/property/${property.id}`}>
      <div className="p-3 bg-card border border-border shadow-sm rounded-md hover:border-primary/50 transition-colors cursor-pointer group mb-3 last:mb-0 relative hover-elevate">
        <div className="text-xs font-mono text-muted-foreground mb-1 flex justify-between">
          <span>{property.reference}</span>
          <span className="font-bold text-foreground">{property.currency} {(property.price/1000).toFixed(0)}k</span>
        </div>
        <h4 className="font-semibold text-sm line-clamp-2 leading-snug group-hover:text-primary transition-colors">{property.title}</h4>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
          <MapPin className="w-3 h-3" />
          <span className="truncate">{property.suburb}</span>
        </div>
        
        {/* Visual indicators */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
           {!property.coverImage && property.pipelineStage !== 'draft' && (
             <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-destructive/10 text-destructive border-destructive/20 gap-1 font-medium">
               <ImageIcon className="w-2.5 h-2.5" /> No Photos
             </Badge>
           )}
           <span className="text-[10px] text-muted-foreground ml-auto bg-muted px-1.5 py-0.5 rounded capitalize">
             {property.listingType}
           </span>
        </div>
      </div>
    </Link>
  );
}

export default function Pipeline() {
  const { data: columns, isLoading } = useGetPipeline();

  return (
    <div className="h-full flex flex-col p-8 max-w-[1600px] mx-auto overflow-hidden">
      <div className="flex items-end justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline Board</h1>
          <p className="text-muted-foreground mt-1">Track property status from listing to closing.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-6 h-full overflow-hidden">
          {[1,2,3,4].map(i => (
            <div key={i} className="w-80 shrink-0 flex flex-col gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex gap-6 overflow-x-auto pb-4 -mx-2 px-2 snap-x">
          {columns?.map((col) => (
            <div key={col.stage} className="w-80 shrink-0 flex flex-col bg-muted/40 rounded-xl border border-border/50 snap-center">
              <div className="p-4 flex items-center justify-between shrink-0 border-b border-border/50 bg-muted/60 rounded-t-xl">
                <h3 className="font-semibold text-sm capitalize">{col.stage.replace('_', ' ')}</h3>
                <Badge variant="secondary" className="bg-background shadow-sm font-bold">
                  {col.properties.length}
                </Badge>
              </div>
              <ScrollArea className="flex-1 p-3">
                {col.properties.map(prop => (
                  <PipelineCard key={prop.id} property={prop} />
                ))}
                {col.properties.length === 0 && (
                  <div className="text-center p-6 border-2 border-dashed border-border rounded-lg m-2">
                    <p className="text-sm text-muted-foreground">No properties</p>
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