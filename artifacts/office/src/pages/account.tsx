import React from 'react';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UserCircle } from 'lucide-react';

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

  return (
    <div className="p-8 max-w-[1000px] mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <UserCircle className="w-4 h-4" />
          Personal account
        </div>
        <h1 className="text-3xl font-bold tracking-tight mt-2">My Account</h1>
        <p className="text-muted-foreground mt-1">View the details for your QuickProp Office account.</p>
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
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-lg">Account details</CardTitle>
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
              <AccountDetail label="Full name" value={user.name} />
              <AccountDetail label="Email address" value={user.email} />
              <AccountDetail label="Phone number" value={user.phone || 'Not provided'} />
              <AccountDetail label="Account role" value={user.role.replaceAll('_', ' ')} />
              <AccountDetail label="Account status" value={user.status} />
              <AccountDetail label="User ID" value={String(user.id)} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
