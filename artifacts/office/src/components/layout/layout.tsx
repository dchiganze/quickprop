import React from 'react';
import { Link, useLocation } from 'wouter';
import { useLogout, useGetCurrentUser, useListNotifications, useMarkNotificationRead } from '@workspace/api-client-react';
import { 
  Building2, LayoutDashboard, Database, KanbanSquare, Users, MessageSquare, 
  Target, CheckSquare, Calendar, FileText, Briefcase, BarChart3, Settings, 
  ShieldAlert, UserCircle, Bell, Search, LogOut, Loader2, Sparkles
} from 'lucide-react';
import { QuickShareDialog } from '@/components/QuickShareDialog';
import { BrochureCatalogDialog } from '@/components/BrochureCatalogDialog';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  exact?: boolean;
}

function NavItem({ href, icon: Icon, label, exact = false }: NavItemProps) {
  const [location] = useLocation();
  const isActive = exact ? location === href : location.startsWith(href) && (href !== '/' || location === '/');

  return (
    <Link href={href} className={cn(
      "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
      isActive 
        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
    )}>
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  );
}

function NotificationsDropdown() {
  const { data: notifications } = useListNotifications();
  const markRead = useMarkNotificationRead();
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">{unreadCount} unread</Badge>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications?.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            <div className="flex flex-col">
              {notifications?.map(notif => (
                <button
                  key={notif.id}
                  onClick={() => {
                    if (!notif.read) markRead.mutate({ id: notif.id });
                  }}
                  className={cn(
                    "flex flex-col gap-1 p-4 text-left transition-colors hover:bg-muted/50",
                    !notif.read && "bg-muted/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("text-sm font-medium", !notif.read && "text-foreground")}>{notif.title}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {notif.message && (
                    <span className="text-xs text-muted-foreground line-clamp-2">{notif.message}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: user } = useGetCurrentUser();
  const logout = useLogout();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => setLocation('/login')
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar flex-shrink-0 flex flex-col border-r border-sidebar-border shadow-xl z-20">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shadow-sm">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-sidebar-foreground tracking-tight">QuickProp Office</span>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <div className="space-y-6">
            <div className="space-y-1">
              <NavItem href="/" icon={LayoutDashboard} label="Command Centre" exact />
              <NavItem href="/tasks" icon={CheckSquare} label="Tasks" />
            </div>

            <div className="space-y-1">
              <div className="px-3 text-xs font-semibold tracking-wider text-sidebar-foreground/40 uppercase mb-2">Properties</div>
              <NavItem href="/inventory" icon={Database} label="Inventory" exact />
              <NavItem href="/inventory/pipeline" icon={KanbanSquare} label="Pipeline" />
              <NavItem href="/housekeeping" icon={Sparkles} label="Listing Housekeeping" />
              <NavItem href="/calendar" icon={Calendar} label="Viewings" />
            </div>

            <div className="space-y-1">
              <div className="px-3 text-xs font-semibold tracking-wider text-sidebar-foreground/40 uppercase mb-2">People</div>
              <NavItem href="/leads" icon={Target} label="Leads Pipeline" />
              <NavItem href="/buyer-requests" icon={MessageSquare} label="Buyer Requests" />
              <NavItem href="/buyers" icon={Users} label="Buyers" />
              <NavItem href="/sellers" icon={Briefcase} label="Sellers" />
            </div>

            <div className="space-y-1">
              <div className="px-3 text-xs font-semibold tracking-wider text-sidebar-foreground/40 uppercase mb-2">Agency</div>
              <NavItem href="/documents" icon={FileText} label="Documents" />
              <NavItem href="/analytics" icon={BarChart3} label="Analytics" />
              <NavItem href="/users" icon={UserCircle} label="Team & Branches" />
              <NavItem href="/settings" icon={Settings} label="Settings" />
              <NavItem href="/audit" icon={ShieldAlert} label="Audit Log" />
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-sidebar-border bg-sidebar/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-sidebar-accent transition-colors text-left">
                <Avatar className="w-8 h-8 rounded border border-sidebar-border">
                  <AvatarImage src={user?.avatarUrl || ''} />
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs rounded">
                    {user?.name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col flex-1 overflow-hidden">
                  <span className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</span>
                  <span className="text-xs text-sidebar-foreground/50 truncate capitalize">{user?.role?.replace('_', ' ')}</span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">Agency Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-card border-b border-border shadow-sm z-10">
          <div className="flex items-center gap-4 flex-1">
             {/* Global Search stub - will implement fully on pages that need it, or as a global command palette */}
             <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted hover:bg-muted/80 rounded-md border border-border w-64 transition-colors">
               <Search className="w-4 h-4" />
               <span>Search properties, buyers...</span>
               <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                 <span className="text-xs">⌘</span>K
               </kbd>
             </button>
          </div>
          
          <div className="flex items-center gap-2">
            <BrochureCatalogDialog />
            <QuickShareDialog />
            <NotificationsDropdown />
          </div>
        </header>

        <ScrollArea className="flex-1">
          {children}
        </ScrollArea>
      </main>
    </div>
  );
}