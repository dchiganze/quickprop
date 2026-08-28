import React from 'react';
import { Link, useLocation } from 'wouter';
import { useLogout, useGetCurrentUser } from '@workspace/api-client-react';
import {
  LayoutDashboard, Building2, Users, UserCheck, ShoppingBag,
  Target, Map, Clock, Shield, Settings, LogOut, ChevronRight,
  Bell, Search, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  exact?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { href: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { href: '/properties', icon: Building2, label: 'Properties' },
      { href: '/coverage', icon: Map, label: 'Coverage' },
      { href: '/freshness', icon: Clock, label: 'Freshness' },
      { href: '/duplicates', icon: Activity, label: 'Duplicate Review' },
    ],
  },
  {
    title: 'People',
    items: [
      { href: '/agencies', icon: ShoppingBag, label: 'Agencies' },
      { href: '/agents', icon: UserCheck, label: 'Agents' },
      { href: '/buyers', icon: Users, label: 'Buyers' },
    ],
  },
  {
    title: 'Engagement',
    items: [
      { href: '/leads', icon: Target, label: 'Leads' },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/audit', icon: Shield, label: 'Audit Log' },
      { href: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

function NavLink({ href, icon: Icon, label, exact = false }: NavItem) {
  const [location] = useLocation();
  const isActive = exact
    ? location === href
    : location.startsWith(href) && (href !== '/' || location === '/');

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors group',
        isActive
          ? 'bg-sidebar-primary/15 text-sidebar-primary'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
    >
      <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground')} />
      <span className="truncate">{label}</span>
      {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-sidebar-primary opacity-60" />}
    </Link>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const logout = useLogout();
  const { data: user } = useGetCurrentUser();

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => { window.location.href = `${import.meta.env.BASE_URL}login`; } });
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? 'AD';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border flex-shrink-0">
          <div className="w-8 h-8 rounded bg-sidebar-primary flex items-center justify-center shadow-lg shadow-sidebar-primary/30">
            <Activity className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold text-sidebar-accent-foreground tracking-tight leading-none block">QuickProp</span>
            <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest leading-none block mt-0.5">Admin Portal</span>
          </div>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 py-4">
          <nav className="px-3 space-y-5">
            {NAV.map((section) => (
              <div key={section.title}>
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <NavLink key={item.href} {...item} />
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* User footer */}
        <div className="p-3 border-t border-sidebar-border flex-shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-sidebar-accent transition-colors">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-accent-foreground truncate">{user?.name ?? 'Admin'}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate capitalize">{user?.role?.replace('_', ' ') ?? 'administrator'}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="w-7 h-7 text-sidebar-foreground/40 hover:text-destructive hover:bg-transparent flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-card border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/60 hover:bg-muted rounded-md border border-border/60 w-72 transition-colors">
              <Search className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">Search the platform…</span>
              <kbd className="ml-auto hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Bell className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Scrollable content */}
        <ScrollArea className="flex-1">
          {children}
        </ScrollArea>
      </div>
    </div>
  );
}
