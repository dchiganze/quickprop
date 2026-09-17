import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Palette, Bell, Loader2, BookOpen } from 'lucide-react';
import {
  useGetCurrentUser,
  useGetAdminAgencySettings,
  useUpdateAdminAgencySettings,
  useGetListingHousekeepingPreferences,
  useUpdateListingHousekeepingPreferences,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_REMINDER_PREFERENCES = {
  whatsappEnabled: true,
  pushEnabled: true,
  emailEnabled: true,
  reminderFrequency: 'smart',
};

const DEFAULT_AGENCY_SETTINGS = {
  agencyName: 'QuickProp Real Estate',
  phone: '+263 242 123 456',
  email: 'info@quickprop.co.zw',
  website: 'https://quickprop.co.zw',
  logoUrl: null as string | null,
  aboutText: '',
  tagline: '',
  primaryColor: '#10B981',
  newLeadAlerts: true,
  mandateExpiryAlerts: true,
  weeklyReport: true,
};

export default function Settings() {
  const { data: currentUser } = useGetCurrentUser();
  const agencySettingsQuery = useGetAdminAgencySettings();
  const updateAgencySettings = useUpdateAdminAgencySettings();
  const preferencesQuery = useGetListingHousekeepingPreferences();
  const updatePreferences = useUpdateListingHousekeepingPreferences();
  const { toast } = useToast();
  const [reminderPreferences, setReminderPreferences] = useState(DEFAULT_REMINDER_PREFERENCES);
  const [agencySettings, setAgencySettings] = useState(DEFAULT_AGENCY_SETTINGS);
  const [saved, setSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(() => (
    typeof window === 'undefined' ? null : localStorage.getItem('quickprop-agency-logo')
  ));
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    if (preferencesQuery.data) {
      setReminderPreferences({
        whatsappEnabled: preferencesQuery.data.whatsappEnabled,
        pushEnabled: preferencesQuery.data.pushEnabled,
        emailEnabled: preferencesQuery.data.emailEnabled,
        reminderFrequency: preferencesQuery.data.reminderFrequency,
      });
    }
  }, [preferencesQuery.data]);

  useEffect(() => {
    if (agencySettingsQuery.data) {
      setAgencySettings({
        agencyName: agencySettingsQuery.data.agencyName,
        phone: agencySettingsQuery.data.phone,
        email: agencySettingsQuery.data.email,
        website: agencySettingsQuery.data.website,
        logoUrl: agencySettingsQuery.data.logoUrl ?? null,
        aboutText: agencySettingsQuery.data.aboutText,
        tagline: agencySettingsQuery.data.tagline,
        primaryColor: agencySettingsQuery.data.primaryColor,
        newLeadAlerts: agencySettingsQuery.data.newLeadAlerts,
        mandateExpiryAlerts: agencySettingsQuery.data.mandateExpiryAlerts,
        weeklyReport: agencySettingsQuery.data.weeklyReport,
      });
      setLogoUrl(agencySettingsQuery.data.logoUrl ?? null);
    }
  }, [agencySettingsQuery.data]);

  const saveReminderPreferences = () => {
    setSaved(false);
    updatePreferences.mutate({
      data: reminderPreferences,
    }, {
      onSuccess: (next) => {
        setReminderPreferences({
          whatsappEnabled: next.whatsappEnabled,
          pushEnabled: next.pushEnabled,
          emailEnabled: next.emailEnabled,
          reminderFrequency: next.reminderFrequency,
        });
        setSaved(true);
        toast({
          title: 'Changes saved',
          description: 'Your reminder settings have been saved.',
        });
      },
    });
  };

  const uploadLogo = async (file: File) => {
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast({
        title: 'Unsupported logo format',
        description: 'Choose a PNG or JPG image.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Logo is too large',
        description: 'Logo files must be 2 MB or smaller.',
        variant: 'destructive',
      });
      return;
    }

    setLogoUploading(true);
    try {
      const request = await fetch('/api/storage/uploads/request-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      const target = await request.json().catch(() => null) as {
        uploadURL?: string;
        objectPath?: string;
        error?: string;
      } | null;
      if (!request.ok || !target?.uploadURL || !target.objectPath) {
        throw new Error(target?.error || 'Could not prepare the logo for upload.');
      }

      const upload = await fetch(target.uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!upload.ok) throw new Error('Could not upload the logo.');

      const url = `/api/storage${target.objectPath}`;
      setLogoUrl(url);
      setAgencySettings((current) => ({ ...current, logoUrl: url }));
      toast({
        title: 'Logo ready',
        description: 'Save your settings to keep the logo across devices.',
      });
    } catch (error) {
      toast({
        title: 'Logo upload failed',
        description: error instanceof Error ? error.message : 'Try again with a PNG or JPG image.',
        variant: 'destructive',
      });
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const saveAgencySettings = () => {
    setSaved(false);
    updateAgencySettings.mutate({ data: agencySettings }, {
      onSuccess: (next) => {
        setAgencySettings({
          agencyName: next.agencyName,
          phone: next.phone,
          email: next.email,
          website: next.website,
          logoUrl: next.logoUrl ?? null,
          aboutText: next.aboutText,
          tagline: next.tagline,
          primaryColor: next.primaryColor,
          newLeadAlerts: next.newLeadAlerts,
          mandateExpiryAlerts: next.mandateExpiryAlerts,
          weeklyReport: next.weeklyReport,
        });
        setLogoUrl(next.logoUrl ?? null);
        setSaved(true);
        toast({
          title: 'Changes saved',
          description: 'Your agency settings have been saved.',
        });
      },
      onError: (error) => {
        toast({
          title: 'Could not save settings',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        });
      },
    });
  };

  const canEditAgencySettings = currentUser?.role === 'admin' || currentUser?.role === 'principal';

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
                <Input
                  value={agencySettings.agencyName}
                  onChange={(event) => setAgencySettings((current) => ({ ...current, agencyName: event.target.value }))}
                  disabled={agencySettingsQuery.isLoading || !canEditAgencySettings}
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={agencySettings.phone}
                  onChange={(event) => setAgencySettings((current) => ({ ...current, phone: event.target.value }))}
                   disabled={agencySettingsQuery.isLoading || !canEditAgencySettings}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={agencySettings.email}
                  onChange={(event) => setAgencySettings((current) => ({ ...current, email: event.target.value }))}
                 disabled={agencySettingsQuery.isLoading || !canEditAgencySettings}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                type="url"
                value={agencySettings.website}
                onChange={(event) => setAgencySettings((current) => ({ ...current, website: event.target.value }))}
                 disabled={agencySettingsQuery.isLoading || !canEditAgencySettings}
              />
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
              <div className="w-24 h-24 rounded border-2 border-dashed flex items-center justify-center text-muted-foreground bg-muted/50 overflow-hidden">
                {logoUrl || agencySettings.logoUrl ? (
                  <img src={logoUrl ?? agencySettings.logoUrl ?? ''} alt="Agency logo preview" className="w-full h-full object-contain" />
                ) : (
                  'Logo'
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadLogo(file);
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                   disabled={logoUploading || !canEditAgencySettings}
                >
                  {logoUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {logoUploading ? 'Uploading…' : 'Upload Logo'}
                </Button>
                <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB. Recommended 512x512px.</p>
              </div>
            </div>
            <div className="space-y-2 pt-4 border-t">
              <Label>Primary Brand Color</Label>
              <div className="flex items-center gap-3">
                 <Input
                  type="color"
                  value={agencySettings.primaryColor}
                  onChange={(event) => setAgencySettings((current) => ({ ...current, primaryColor: event.target.value.toUpperCase() }))}
                  disabled={!canEditAgencySettings}
                  className="w-12 h-10 p-1 bg-background"
                />
                <Input
                  value={agencySettings.primaryColor}
                  onChange={(event) => setAgencySettings((current) => ({ ...current, primaryColor: event.target.value }))}
                  disabled={!canEditAgencySettings}
                  className="font-mono max-w-[120px]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-1 md:col-span-1">
          <h3 className="font-semibold text-lg flex items-center"><BookOpen className="w-5 h-5 mr-2 text-primary" /> Catalogue Content</h3>
          <p className="text-sm text-muted-foreground">The About Us page and tagline used in generated catalogues.</p>
        </div>
        <Card className="md:col-span-2">
          <CardContent className="p-6 space-y-4">
            {!canEditAgencySettings && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Only an administrator or principal can edit catalogue content.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="catalogue-tagline">Tagline / slogan</Label>
              <Input
                id="catalogue-tagline"
                placeholder="Property is what we know best"
                value={agencySettings.tagline}
                onChange={(event) => setAgencySettings((current) => ({ ...current, tagline: event.target.value }))}
                disabled={agencySettingsQuery.isLoading || !canEditAgencySettings}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalogue-about">About us</Label>
              <Textarea
                id="catalogue-about"
                rows={7}
                placeholder="Tell clients about your agency, experience, and approach."
                value={agencySettings.aboutText}
                onChange={(event) => setAgencySettings((current) => ({ ...current, aboutText: event.target.value }))}
                disabled={agencySettingsQuery.isLoading || !canEditAgencySettings}
              />
              <p className="text-xs text-muted-foreground">This text appears on the catalogue About Us page.</p>
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
              <Switch
                checked={agencySettings.newLeadAlerts}
                onCheckedChange={(checked) => setAgencySettings((current) => ({ ...current, newLeadAlerts: checked }))}
                disabled={agencySettingsQuery.isLoading}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">Mandate Expiry</Label>
                <p className="text-sm text-muted-foreground">Notify 30 days before mandate expires.</p>
              </div>
              <Switch
                checked={agencySettings.mandateExpiryAlerts}
                onCheckedChange={(checked) => setAgencySettings((current) => ({ ...current, mandateExpiryAlerts: checked }))}
                disabled={agencySettingsQuery.isLoading}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">Weekly Report</Label>
                <p className="text-sm text-muted-foreground">Receive automated performance summary.</p>
              </div>
              <Switch
                checked={agencySettings.weeklyReport}
                onCheckedChange={(checked) => setAgencySettings((current) => ({ ...current, weeklyReport: checked }))}
                disabled={agencySettingsQuery.isLoading}
              />
            </div>
            <div className="border-t pt-5">
              <div className="mb-4">
                <Label className="text-base font-semibold">Listing reminder delivery</Label>
                <p className="text-sm text-muted-foreground">Choose where due-soon and stale listing reminders are delivered.</p>
              </div>
              <div className="space-y-4">
                {([
                  ['whatsappEnabled', 'WhatsApp', 'Send reminders to your saved mobile number.'],
                  ['pushEnabled', 'Push notifications', 'Show reminders on registered QuickProp devices.'],
                  ['emailEnabled', 'Email', 'Send reminders to your account email address.'],
                ] as const).map(([key, label, description]) => (
                  <div className="flex items-center justify-between gap-4" key={key}>
                    <div>
                      <Label className="text-sm font-medium">{label}</Label>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    <Switch
                      checked={reminderPreferences[key]}
                      onCheckedChange={(checked) => {
                        setSaved(false);
                        setReminderPreferences((current) => ({ ...current, [key]: checked }));
                      }}
                      disabled={preferencesQuery.isLoading || updatePreferences.isPending}
                      aria-label={`${label} listing reminders`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {preferencesQuery.isError ? 'Could not load saved reminder preferences.' : saved ? 'Reminder preferences saved.' : 'Changes apply to future reminders.'}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveReminderPreferences}
                  disabled={preferencesQuery.isLoading || updatePreferences.isPending}
                >
                  {updatePreferences.isPending ? 'Saving…' : 'Save reminder settings'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex justify-end pt-4">
        <Button
          size="lg"
          className="w-full md:w-auto font-semibold"
          onClick={saveAgencySettings}
          disabled={agencySettingsQuery.isLoading || updateAgencySettings.isPending || !canEditAgencySettings}
        >
          {updateAgencySettings.isPending ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}