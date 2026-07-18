import React from 'react';
import {
  useGetAdminPlatformStats,
  useGetAdminPlatformCharts,
  useGetRecentActivity,
} from '@workspace/api-client-react';
import {
  Building2, Users, Briefcase, Target, TrendingUp, Activity,
  UserCheck, Clock, BarChart3, Globe
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const COLORS = [
  'hsl(217,91%,60%)', 'hsl(162,72%,45%)', 'hsl(36,91%,53%)',
  'hsl(270,67%,63%)', 'hsl(0,72%,58%)',
];

function KpiCard({ title, value, icon: Icon, sub, color = 'primary', loading }: {
  title: string; value: string | number; icon: React.ElementType;
  sub?: string; color?: string; loading?: boolean;
}) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-500/10 text-emerald-600',
    amber: 'bg-amber-500/10 text-amber-600',
    purple: 'bg-purple-500/10 text-purple-600',
    red: 'bg-red-500/10 text-red-600',
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color] ?? colorMap.primary}`}>
            <Icon className="w-4 h-4" />
          </span>
        </div>
        {loading ? <Skeleton className="h-8 w-16 mb-1" /> : (
          <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetAdminPlatformStats();
  const { data: charts, isLoading: chartsLoading } = useGetAdminPlatformCharts();
  const { data: activity } = useGetRecentActivity();

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Platform Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Real-time overview of the QuickProp ecosystem</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <KpiCard title="Active Listings" value={stats?.activeProperties ?? 0} icon={Building2} sub="On marketplace" color="primary" loading={statsLoading} />
        <KpiCard title="New Today" value={stats?.propertiesToday ?? 0} icon={TrendingUp} sub="New uploads" color="emerald" loading={statsLoading} />
        <KpiCard title="Sold" value={stats?.propertiesSold ?? 0} icon={BarChart3} sub="Total transactions" color="purple" loading={statsLoading} />
        <KpiCard title="Buyers" value={stats?.registeredBuyers ?? 0} icon={Users} sub="Registered" color="amber" loading={statsLoading} />
        <KpiCard title="Agencies" value={stats?.registeredAgencies ?? 0} icon={Briefcase} sub="Active branches" loading={statsLoading} />
        <KpiCard title="Agents" value={stats?.registeredAgents ?? 0} icon={UserCheck} sub="On platform" loading={statsLoading} />
        <KpiCard title="Weekly Active" value={stats?.weeklyActiveAgents ?? 0} icon={Activity} sub="Agents" color="emerald" loading={statsLoading} />
        <KpiCard title="New Leads" value={stats?.newLeadsToday ?? 0} icon={Target} sub="Today" color="amber" loading={statsLoading} />
        <KpiCard title="Open Leads" value={stats?.openLeads ?? 0} icon={Clock} sub="Awaiting action" color="red" loading={statsLoading} />
        <KpiCard title="Avg Response" value={`${stats?.avgResponseTimeHours ?? 0}h`} icon={Clock} sub="Lead response time" loading={statsLoading} />
        <KpiCard title="Coverage" value={`${stats?.marketplaceCoveragePercent ?? 0}%`} icon={Globe} sub="Marketplace" color="emerald" loading={statsLoading} />
        <KpiCard title="Total Listings" value={stats?.totalProperties ?? 0} icon={Building2} sub="All time" color="purple" loading={statsLoading} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Uploads per Month</CardTitle>
            <CardDescription>New property listings (last 6 months)</CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            {chartsLoading ? <Skeleton className="w-full h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts?.uploadsPerMonth ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={11} />
                  <YAxis axisLine={false} tickLine={false} fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Listings" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lead Volume</CardTitle>
            <CardDescription>Inbound leads per month</CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            {chartsLoading ? <Skeleton className="w-full h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts?.leadsPerMonth ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={11} />
                  <YAxis axisLine={false} tickLine={false} fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                  <Line type="monotone" dataKey="value" stroke="hsl(162,72%,45%)" strokeWidth={2.5} dot={false} name="Leads" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Buyer Registrations</CardTitle>
            <CardDescription>New buyers per month</CardDescription>
          </CardHeader>
          <CardContent className="h-52">
            {chartsLoading ? <Skeleton className="w-full h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts?.buyerRegistrations ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={11} />
                  <YAxis axisLine={false} tickLine={false} fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="value" fill="hsl(36,91%,53%)" radius={[4, 4, 0, 0]} name="Buyers" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads by Stage</CardTitle>
            <CardDescription>Current pipeline distribution</CardDescription>
          </CardHeader>
          <CardContent className="h-52">
            {chartsLoading ? <Skeleton className="w-full h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={charts?.leadsByStage ?? []} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {(charts?.leadsByStage ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Properties by Type</CardTitle>
            <CardDescription>Total listings by category</CardDescription>
          </CardHeader>
          <CardContent className="h-52">
            {chartsLoading ? <Skeleton className="w-full h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={charts?.propertiesByType ?? []} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {(charts?.propertiesByType ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Platform Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(activity ?? []).slice(0, 8).map((a, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{a.message}</p>
                  {a.userName && <p className="text-xs text-muted-foreground mt-0.5">by {a.userName}</p>}
                </div>
                <p className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                  {new Date(a.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
            {(!activity || activity.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
