import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Building2, Palette, Bell } from 'lucide-react';

export default function Settings() {
  return (
    <div className="p-8 max-w-[1000px] mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agency Settings</h1>
        <p className="text-muted-foreground mt-1">Manage branding, defaults, and system preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-1 md:col-span-1">
          <h3 className="font-semibold text-lg flex items-center"><Building2 className="w-5 h-5 mr-2 text-primary" /> Profile</h3>
          <p className="text-sm text-muted-foreground">Public-facing agency details.</p>
        </div>
        <Card className="md:col-span-2">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Agency Name</Label>
              <Input defaultValue="QuickProp Real Estate" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input defaultValue="+263 242 123 456" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input defaultValue="info@quickprop.co.zw" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input defaultValue="https://quickprop.co.zw" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-1 md:col-span-1">
          <h3 className="font-semibold text-lg flex items-center"><Palette className="w-5 h-5 mr-2 text-primary" /> Branding</h3>
          <p className="text-sm text-muted-foreground">Logo and brochure appearance.</p>
        </div>
        <Card className="md:col-span-2">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded border-2 border-dashed flex items-center justify-center text-muted-foreground bg-muted/50">
                Logo
              </div>
              <div className="space-y-2">
                <Button variant="outline" size="sm">Upload Logo</Button>
                <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB. Recommended 512x512px.</p>
              </div>
            </div>
            <div className="space-y-2 pt-4 border-t">
              <Label>Primary Brand Color</Label>
              <div className="flex items-center gap-3">
                <Input type="color" defaultValue="#10B981" className="w-12 h-10 p-1 bg-background" />
                <Input defaultValue="#10B981" className="font-mono max-w-[120px]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-1 md:col-span-1">
          <h3 className="font-semibold text-lg flex items-center"><Bell className="w-5 h-5 mr-2 text-primary" /> Notifications</h3>
          <p className="text-sm text-muted-foreground">Control what emails your team receives.</p>
        </div>
        <Card className="md:col-span-2">
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">New Lead Alerts</Label>
                <p className="text-sm text-muted-foreground">Email when a new inquiry is received.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">Mandate Expiry</Label>
                <p className="text-sm text-muted-foreground">Notify 30 days before mandate expires.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">Weekly Report</Label>
                <p className="text-sm text-muted-foreground">Receive automated performance summary.</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex justify-end pt-4">
        <Button size="lg" className="w-full md:w-auto font-semibold">Save Changes</Button>
      </div>
    </div>
  );
}