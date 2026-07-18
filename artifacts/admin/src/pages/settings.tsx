import React from 'react';
import { Settings as SettingsIcon, Building2, Tag, Bell, Users, Globe, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function SettingsSection({ icon: Icon, title, description, badge }: {
  icon: React.ElementType; title: string; description: string; badge?: string;
}) {
  return (
    <Card className="hover:border-primary/30 transition-colors cursor-default">
      <CardContent className="p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground text-sm">{title}</h3>
            {badge && <Badge variant="secondary" className="text-[10px] px-2">{badge}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">System Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Platform-wide configuration and content management</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SettingsSection
          icon={Tag}
          title="Property Types"
          description="Add, rename, or reorder the property type categories shown across the marketplace and CRM."
          badge="Coming soon"
        />
        <SettingsSection
          icon={Globe}
          title="Cities & Suburbs"
          description="Manage the list of supported cities and suburbs used in property listings and search filters."
          badge="Coming soon"
        />
        <SettingsSection
          icon={Users}
          title="Roles & Permissions"
          description="Configure which capabilities each user role has across Office CRM, mobile app, and the admin portal."
          badge="Coming soon"
        />
        <SettingsSection
          icon={Bell}
          title="Notification Templates"
          description="Edit the email and push notification templates sent to buyers, agents, and agencies."
          badge="Coming soon"
        />
        <SettingsSection
          icon={Building2}
          title="Featured Agencies"
          description="Manage which agencies are featured on the public marketplace homepage and search results."
          badge="Coming soon"
        />
        <SettingsSection
          icon={ShieldCheck}
          title="Admin Access"
          description="Grant or revoke admin portal access, manage admin user accounts and their permission level."
          badge="Coming soon"
        />
      </div>

      <Card className="border-border/50 bg-muted/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Settings module</p>
              <p className="text-xs text-muted-foreground">
                Full settings management is planned for the next release. In the meantime, property types, cities, and suburbs can be managed directly in the database.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
