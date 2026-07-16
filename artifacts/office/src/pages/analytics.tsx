import React from 'react';
import { useGetAnalyticsSummary } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Eye, MousePointerClick, Share2, Download, TrendingUp, Clock } from 'lucide-react';

export default function Analytics() {
  const { data: analytics, isLoading } = useGetAnalyticsSummary();

  if (isLoading) {
    return <div className="p-8"><Skeleton className="h-[600px] w-full" /></div>;
  }

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
        <p className="text-muted-foreground mt-1">Deep dive into agency performance metrics.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Card className="bg-primary text-primary-foreground border-none shadow-md">
          <CardContent className="p-6">
            <Eye className="w-5 h-5 mb-4 opacity-80" />
            <div className="text-3xl font-bold mb-1">{analytics?.totals.views.toLocaleString() || 0}</div>
            <div className="text-sm font-medium opacity-80 uppercase tracking-wider">Total Views</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <MousePointerClick className="w-5 h-5 mb-4 text-muted-foreground" />
            <div className="text-3xl font-bold mb-1">{analytics?.totals.enquiries.toLocaleString() || 0}</div>
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Enquiries</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Share2 className="w-5 h-5 mb-4 text-muted-foreground" />
            <div className="text-3xl font-bold mb-1">{analytics?.totals.shares.toLocaleString() || 0}</div>
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Property Shares</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Download className="w-5 h-5 mb-4 text-muted-foreground" />
            <div className="text-3xl font-bold mb-1">{analytics?.totals.brochures.toLocaleString() || 0}</div>
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Brochure Downloads</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Inventory Growth</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.inventoryGrowth || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={10} />
                <YAxis axisLine={false} tickLine={false} tickMargin={10} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Efficiency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
             <div className="text-center p-6 border rounded-xl bg-muted/20">
               <TrendingUp className="w-8 h-8 mx-auto text-primary mb-2" />
               <div className="text-4xl font-bold text-foreground mb-1">{analytics?.leadConversionPercent || 0}%</div>
               <div className="text-sm text-muted-foreground">Lead Conversion Rate</div>
             </div>
             
             <div className="text-center p-6 border rounded-xl bg-muted/20">
               <Clock className="w-8 h-8 mx-auto text-amber-500 mb-2" />
               <div className="text-4xl font-bold text-foreground mb-1">{analytics?.avgDaysOnMarket || 0}</div>
               <div className="text-sm text-muted-foreground">Avg. Days on Market</div>
             </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Property Types</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analytics?.propertyTypes || []} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {(analytics?.propertyTypes || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
               {analytics?.propertyTypes?.map((pt, idx) => (
                 <div key={pt.label} className="flex items-center gap-2 text-xs">
                   <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                   <span className="capitalize">{pt.label.replace('_', ' ')}</span>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top Suburbs</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.suburbs || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                <XAxis type="number" axisLine={false} tickLine={false} />
                <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} width={100} />
                <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}