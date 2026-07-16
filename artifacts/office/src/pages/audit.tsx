import React from 'react';
import { useListAuditLog } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function Audit() {
  const { data: logs, isLoading } = useListAuditLog();

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground mt-1">System-wide activity and security events.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-3">Timestamp</div>
            <div className="col-span-3">User</div>
            <div className="col-span-2">Action</div>
            <div className="col-span-4">Details</div>
          </div>
          
          <div className="divide-y">
            {isLoading ? (
              Array.from({length: 10}).map((_, i) => (
                <div key={i} className="grid grid-cols-12 gap-4 p-4">
                  <Skeleton className="h-5 col-span-3" />
                  <Skeleton className="h-5 col-span-3" />
                  <Skeleton className="h-5 col-span-2" />
                  <Skeleton className="h-5 col-span-4" />
                </div>
              ))
            ) : (
              logs?.map(log => (
                <div key={log.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/30 text-sm transition-colors">
                  <div className="col-span-3 text-muted-foreground font-mono text-xs">
                    {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                  </div>
                  <div className="col-span-3 font-medium text-foreground">
                    {log.userName || 'System'}
                  </div>
                  <div className="col-span-2 capitalize">
                    {log.action.replace('_', ' ')}
                  </div>
                  <div className="col-span-4 text-muted-foreground">
                    <span className="font-medium text-foreground mr-1">{log.entityType}</span> 
                    {log.entityId && `#${log.entityId}`}
                    {log.detail && ` - ${log.detail}`}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}