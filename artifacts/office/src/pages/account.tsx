import React, { useEffect, useState } from 'react';
import {
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
  useUpdateCurrentUserProfile,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AgentPastSalesEditor } from '@/components/agent-past-sales-editor';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, UserCircle } from 'lucide-react';

function AccountDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground break-words">{value}</div>
    </div>
  );
}

export default function Account() {
  const { data: user, isLoading, error } = useGetCurrentUser();
  const updateProfile = useUpdateCurrentUserProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone ?? '');
  }, [user?.id, user?.name, user?.phone]);

  const hasChanges = Boolean(user) && (
    name.trim() !== user?.name
    || (phone.trim() || null) !== (user?.phone || null)
  );

  const saveProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !name.trim()) return;

    updateProfile.mutate({
      data: {
        name: name.trim(),
        phone: phone.trim() || null,
      },
    }, {
      onSuccess: (updatedUser) => {
        queryClient.setQueryData(getGetCurrentUserQueryKey(), updatedUser);
        setName(updatedUser.name);
        setPhone(updatedUser.phone ?? '');
        toast({
          title: 'Profile updated',
          description: 'Your name and phone number have been saved.',
        });
      },
      onError: (saveError) => {
        toast({
          title: 'Could not update profile',
          description: saveError instanceof Error ? saveError.message : 'Please try again.',
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <div className="p-8 max-w-[1000px] mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <UserCircle className="w-4 h-4" />
          Personal account
        </div>
        <h1 className="text-3xl font-bold tracking-tight mt-2">My Account</h1>
        <p className="text-muted-foreground mt-1">Manage your personal contact details and view your account access.</p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-5">
            <Skeleton className="h-14 w-64" />
            <div className="grid gap-6 sm:grid-cols-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          </CardContent>
        </Card>
      ) : error || !user ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            We couldn’t load your account details. Refresh the page and try again.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Personal details</CardTitle>
              <p className="text-sm text-muted-foreground">
                Update the name and phone number shown to your team.
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={saveProfile} className="space-y-5 max-w-2xl">
                <div className="space-y-2">
                  <Label htmlFor="account-name">Full name</Label>
                  <Input
                    id="account-name"
                    autoComplete="name"
                    maxLength={120}
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-phone">Phone number</Label>
                  <Input
                    id="account-phone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={40}
                    placeholder="Add a phone number"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-email">Sign-in email</Label>
                  <Input id="account-email" type="email" value={user.email} disabled />
                  <p className="text-xs text-muted-foreground">
                    Email, role, and account status can’t be changed from this page.
                  </p>
                </div>
                <Button type="submit" disabled={!hasChanges || !name.trim() || updateProfile.isPending}>
                  {updateProfile.isPending && <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />}
                  {updateProfile.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Account access</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={user.avatarUrl || ''} alt="" />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                    {user.name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-lg font-semibold truncate">{user.name}</div>
                  <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="secondary" className="capitalize">{user.role.replaceAll('_', ' ')}</Badge>
                    <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                      {user.status}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid gap-6 border-t pt-6 sm:grid-cols-2">
                <AccountDetail label="Account role" value={user.role.replaceAll('_', ' ')} />
                <AccountDetail label="Account status" value={user.status} />
                <AccountDetail label="User ID" value={String(user.id)} />
              </div>
            </CardContent>
          </Card>

          {['principal', 'senior_agent', 'agent'].includes(user.role) && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-lg">My sales history</CardTitle>
                <p className="text-sm text-muted-foreground">Add sales made before QuickProp. Sold listings are included automatically.</p>
              </CardHeader>
              <CardContent className="p-6">
                <AgentPastSalesEditor agentId={user.id} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
