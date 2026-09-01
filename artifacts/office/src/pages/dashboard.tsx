import React from 'react';
import { useLocation, Link } from 'wouter';
import { 
  Building2, Users, FileText, CheckCircle2, AlertTriangle, Clock, 
  TrendingUp, ArrowRight, Eye, MousePointerClick, Share2, Download, Target
} from 'lucide-react';
import { 
  useGetDashboardSummary, 
  useGetCommandCentre, 
  useGetDashboardCharts,
  useGetRecentActivity,
  AttentionItem,
  ActivityEntry
} from '@workspace/api-client-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

function MetricCard({ title, value, icon: Icon, trend, isLoading }: any) {
  return (
    <Card className="hover-elevate transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="p-2 bg-primary/10 rounded-md text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          {isLoading ? (
            <Skeleton className="h-8 w-20 mt-1" />
          ) : (
            <div className="text-3xl font-bold text-foreground tracking-tight">{value}</div>
          )}
          {trend && !isLoading && (
             <div className="flex flex-col items-end">
               <span className="text-xs font-medium text-primary">+{trend}%</span>
               <span className="text-[10px] text-muted-foreground">vs last month</span>
             </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AttentionPanel({ items, isLoading }: { items?: AttentionItem[], isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!items || items.length === 0) {
    return (
      <Card className="h-full border-dashed bg-muted/30">
        <CardContent className="flex flex-col items-center justify-center h-full text-center p-6">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">All Caught Up</h3>
          <p className="text-sm text-muted-foreground">No items require your immediate attention.</p>
        </CardContent>
      </Card>
    );
  }

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical': return 'text-destructive bg-destructive/10 border-destructive/20';
      case 'warning': return 'text-orange-600 bg-orange-500/10 border-orange-500/20';
      default: return 'text-blue-600 bg-blue-500/10 border-blue-500/20';
    }
  };

  const getIcon = (key: string) => {
    if (key.includes('expiring') || key.includes('due')) return <Clock className="w-4 h-4" />;
    if (key.includes('missing') || key.includes('awaiting')) return <AlertTriangle className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  const getLink = (key: string) => {
    if (key === 'awaiting_photos') return '/inventory?status=draft';
    if (key === 'mandates_expiring') return '/inventory';
    if (key === 'unmatched_requests') return '/matches';
    if (key === 'leads_awaiting_response') return '/leads?stage=new';
    return '/';
  };

  return (
    <Card className="h-full border-primary/20 shadow-md shadow-primary/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none" />
      <CardHeader className="pb-3 border-b bg-card">
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Needs Attention
        </CardTitle>
        <CardDescription>Items blocking pipeline velocity</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {items.map((item, idx) => (
            <Link key={item.key + idx} href={getLink(item.key)} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded border ${getSeverityColor(item.severity)}`}>
                  {getIcon(item.key)}
                </div>
                <div className="font-medium text-sm text-foreground">{item.label}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={item.severity === 'critical' ? 'destructive' : 'secondary'} className="font-bold">
                  {item.count}
                </Badge>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityFeed({ entries, isLoading }: { entries?: ActivityEntry[], isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'viewing': return <Eye className="w-4 h-4 text-blue-500" />;
      case 'enquiry': return <MousePointerClick className="w-4 h-4 text-orange-500" />;
      case 'share': return <Share2 className="w-4 h-4 text-purple-500" />;
      case 'brochure': return <Download className="w-4 h-4 text-emerald-500" />;
      case 'published': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default: return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {entries?.slice(0, 6).map((entry) => (
            <div key={entry.id} className="flex gap-4">
              <div className="mt-1 bg-muted p-2 rounded-full ring-4 ring-background">
                {getActivityIcon(entry.type)}
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{entry.userName}</span> {entry.message}
                </p>
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          ))}
          {(!entries || entries.length === 0) && (
            <div className="text-center text-sm text-muted-foreground py-8">No recent activity.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getTimeOfDayGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning.';
  if (hour < 18) return 'Good afternoon.';
  return 'Good evening.';
}

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: commandCentre, isLoading: loadingCommand } = useGetCommandCentre();
  const { data: charts, isLoading: loadingCharts } = useGetDashboardCharts();
  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity();

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{getTimeOfDayGreeting()}</h1>
          <p className="text-muted-foreground mt-1 text-lg">Here's what's happening across your agency today.</p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
             <Link href="/inventory">Add Property</Link>
          </Button>
          <Button asChild>
             <Link href="/leads">New Lead</Link>
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Active Mandates" 
          value={summary?.activeMandates || 0} 
          icon={Building2} 
          trend={12}
          isLoading={loadingSummary} 
        />
        <MetricCard 
          title="New Leads" 
          value={summary?.newLeads || 0} 
          icon={Users} 
          trend={24}
          isLoading={loadingSummary} 
        />
        <MetricCard 
          title="Viewings Today" 
          value={summary?.viewingsToday || 0} 
          icon={Eye} 
          isLoading={loadingSummary} 
        />
        <MetricCard 
          title="Properties Sold (YTD)" 
          value={summary?.propertiesSold || 0} 
          icon={TrendingUp} 
          trend={8}
          isLoading={loadingSummary} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Command Centre */}
        <div className="lg:col-span-1 h-full">
          <AttentionPanel items={commandCentre} isLoading={loadingCommand} />
        </div>

        {/* Middle Column: Chart */}
        <div className="lg:col-span-1 h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Sales Pipeline</CardTitle>
              <CardDescription>Completed vs Target by month</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {loadingCharts ? (
                <Skeleton className="w-full h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts?.salesByMonth || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={12} tickMargin={10} />
                    <YAxis axisLine={false} tickLine={false} fontSize={12} tickFormatter={(val) => `$${val/1000}k`} />
                    <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Activity */}
        <div className="lg:col-span-1 h-full">
          <ActivityFeed entries={activity} isLoading={loadingActivity} />
        </div>
      </div>
    </div>
  );
}