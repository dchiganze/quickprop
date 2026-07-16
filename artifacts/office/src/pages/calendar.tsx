import React, { useState } from 'react';
import { useListViewings, Viewing } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Clock, User, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { format, isSameDay } from 'date-fns';

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const { data: viewings, isLoading } = useListViewings();

  const selectedDateViewings = viewings?.filter(v => date && isSameDay(new Date(v.scheduledAt), date)) || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'no_show': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Viewings Calendar</h1>
        <p className="text-muted-foreground mt-1">Schedule and manage property viewings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md border-0 mx-auto"
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-full min-h-[500px]">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-lg">
                Viewings for {date ? format(date, 'MMMM d, yyyy') : 'Selected Date'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : selectedDateViewings.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No viewings scheduled for this day.</p>
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-4 before:h-full before:w-0.5 before:bg-border">
                  {selectedDateViewings.sort((a,b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()).map(viewing => (
                    <div key={viewing.id} className="relative flex items-start gap-6 ml-4">
                      <div className="w-8 h-8 rounded-full bg-background border-2 border-primary flex items-center justify-center shrink-0 -ml-[20px] mt-1 z-10 shadow-sm">
                        {getStatusIcon(viewing.status)}
                      </div>
                      <div className="flex-1 bg-card border rounded-lg p-4 shadow-sm hover:border-primary/50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-lg text-primary">{format(new Date(viewing.scheduledAt), 'h:mm a')}</h4>
                          <Badge variant="outline" className="capitalize">{viewing.status.replace('_', ' ')}</Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 font-medium">
                            <User className="w-4 h-4 text-muted-foreground" />
                            {viewing.buyerName || 'Unknown Buyer'}
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            Property ID: {viewing.propertyId}
                          </div>
                          {viewing.notes && (
                            <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground italic">
                              "{viewing.notes}"
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}