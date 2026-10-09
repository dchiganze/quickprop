import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListUsersQueryKey,
  useCreateUser,
  useGetCurrentUser,
  useListUsers,
  useListBranches,
  useRequestAdminPasswordReset,
  useUpdateUser,
} from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Building2, Loader2, Mail, Plus, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const inviteSchema = z.object({
  name: z.string().trim().min(2, 'Enter the administrator’s full name.').max(120),
  email: z.string().trim().email('Enter a valid email address.').max(254),
});

type InviteValues = z.infer<typeof inviteSchema>;
const emptyInvite: InviteValues = { name: '', email: '' };
const administratorRoles = ['principal', 'admin'];

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function Users() {
  const { data: users, isLoading: loadingUsers } = useListUsers();
  const { data: branches, isLoading: loadingBranches } = useListBranches();
  const { data: currentUser } = useGetCurrentUser();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const requestPasswordReset = useRequestAdminPasswordReset();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deactivationTarget, setDeactivationTarget] = useState<{ id: number; name: string; email: string } | null>(null);
  const [setupLinkTargetId, setSetupLinkTargetId] = useState<number | null>(null);
  const canManageUsers = currentUser?.role === 'principal' || currentUser?.role === 'admin';
  const activeAdminCount = users?.filter((user) => administratorRoles.includes(user.role) && user.status === 'active').length ?? 0;

  const inviteForm = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: emptyInvite,
  });

  const closeInviteDialog = (open: boolean) => {
    setInviteOpen(open);
    if (!open) inviteForm.reset(emptyInvite);
  };

  const sendSetupLink = (user: { id: number; email: string }) => {
    setSetupLinkTargetId(user.id);
    requestPasswordReset.mutate(
      { data: { email: user.email } },
      {
        onSuccess: () => {
          toast({
            title: 'Setup link requested',
            description: `If the account is eligible and no recent reset was requested, a one-time link will be sent to ${user.email}.`,
          });
          setSetupLinkTargetId(null);
        },
        onError: (error) => {
          toast({
            title: 'Could not request the setup link',
            description: errorText(error, 'Try again later.'),
            variant: 'destructive',
          });
          setSetupLinkTargetId(null);
        },
      },
    );
  };

  const inviteAdministrator = (values: InviteValues) => {
    const email = values.email.trim().toLowerCase();
    createUser.mutate(
      {
        data: {
          name: values.name.trim(),
          email,
          role: 'admin',
        },
      },
      {
        onSuccess: (createdUser) => {
          void queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          closeInviteDialog(false);
          sendSetupLink(createdUser);
        },
        onError: (error) => {
          toast({
            title: 'Could not create administrator',
            description: errorText(error, 'Check the details and try again.'),
            variant: 'destructive',
          });
        },
      },
    );
  };

  const updateUserStatus = (userId: number, status: 'active' | 'inactive', successTitle: string) => {
    updateUser.mutate(
      { id: userId, data: { status } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setDeactivationTarget(null);
          toast({ title: successTitle, description: 'Assigned records and history were preserved.' });
        },
        onError: (error) => {
          toast({
            title: status === 'inactive' ? 'Could not deactivate account' : 'Could not reactivate account',
            description: errorText(error, 'Try again or contact a QuickProp administrator.'),
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team & Branches</h1>
          <p className="text-muted-foreground mt-1">Manage agency staff and office locations.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="shadow-sm" disabled title="Branch creation is not available yet.">
            <Plus className="w-4 h-4 mr-2" />
            Add Branch
          </Button>
          {canManageUsers && (
          <Button className="shadow-sm" onClick={() => setInviteOpen(true)} data-testid="button-add-administrator">
            <Plus className="w-4 h-4 mr-2" />
            Add administrator
          </Button>
          )}
        </div>
      </div>

      {!canManageUsers && currentUser && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground" data-testid="text-user-management-permission">
            Only a Principal or Admin can add or deactivate accounts. You can still view team members.
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6">
          <TabsTrigger value="users" className="px-6">Team Members</TabsTrigger>
          <TabsTrigger value="branches" className="px-6">Branches</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users">
          <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <div className="min-w-[820px]">
                <div className="grid grid-cols-[minmax(220px,2fr)_minmax(110px,1fr)_minmax(140px,1.2fr)_90px_minmax(225px,1.6fr)] gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <div>User</div>
                  <div>Role</div>
                  <div>Branch</div>
                  <div>Status</div>
                  <div className="text-right">Account actions</div>
                </div>
                <div className="divide-y">
                  {loadingUsers ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="grid grid-cols-[minmax(220px,2fr)_minmax(110px,1fr)_minmax(140px,1.2fr)_90px_minmax(225px,1.6fr)] gap-4 p-4 items-center">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-5" />
                        <Skeleton className="h-5" />
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-8" />
                      </div>
                    ))
                  ) : users?.length ? (
                    users.map((user) => {
                      const isAdmin = administratorRoles.includes(user.role);
                      const isCurrentUser = user.id === currentUser?.id;
                      const isLastActiveAdmin = isAdmin && activeAdminCount <= 1;
  const canDeactivate = canManageUsers && user.status === 'active' && !isLastActiveAdmin;

                      return (
                        <div
                          key={user.id}
                          className="grid grid-cols-[minmax(220px,2fr)_minmax(110px,1fr)_minmax(140px,1.2fr)_90px_minmax(225px,1.6fr)] gap-4 p-4 items-center hover:bg-muted/30 transition-colors"
                          data-testid={`row-user-${user.id}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar>
                              <AvatarImage src={user.avatarUrl || ''} alt="" />
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">{user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground truncate" data-testid={`text-user-name-${user.id}`}>{user.name}</div>
                              <div className="text-xs text-muted-foreground truncate" data-testid={`text-user-email-${user.id}`}>{user.email}</div>
                            </div>
                          </div>
                          <div className="capitalize text-sm">{user.role.replaceAll('_', ' ')}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {branches?.find((branch) => branch.id === user.branchId)?.name || 'Head Office'}
                          </div>
                          <div>
                            <Badge
                              variant={user.status === 'active' ? 'default' : 'secondary'}
                              className={user.status === 'active' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200' : ''}
                              data-testid={`status-user-${user.id}`}
                            >
                              {user.status}
                            </Badge>
                          </div>
                          <div className="flex justify-end gap-2">
                            {canManageUsers && isAdmin && user.status === 'active' && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={requestPasswordReset.isPending}
                                onClick={() => sendSetupLink(user)}
                                data-testid={`button-setup-link-${user.id}`}
                              >
                                {setupLinkTargetId === user.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                Setup link
                              </Button>
                            )}
                            {canManageUsers && (
                              user.status === 'active' ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!canDeactivate || updateUser.isPending}
                                  title={isCurrentUser ? 'You will be signed out; another active administrator must remain.' : isLastActiveAdmin ? 'Keep at least one active administrator.' : undefined}
                                  onClick={() => setDeactivationTarget({ id: user.id, name: user.name, email: user.email })}
                                  data-testid={`button-deactivate-user-${user.id}`}
                                >
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={updateUser.isPending}
                                  onClick={() => updateUserStatus(user.id, 'active', 'Account reactivated')}
                                  data-testid={`button-reactivate-user-${user.id}`}
                                >
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Reactivate
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-sm text-muted-foreground" data-testid="text-empty-users">
                      No team members have been added yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="branches">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loadingBranches ? (
                Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
              ) : (
                branches?.map(branch => (
                  <Card key={branch.id} className="hover-elevate">
                    <CardHeader className="pb-3 border-b">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-primary" />
                        {branch.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2 text-sm text-muted-foreground">
                      {branch.address && <div>{branch.address}</div>}
                      {branch.phone && <div>Tel: {branch.phone}</div>}
                      <div className="mt-4 flex -space-x-2">
                          {users?.filter((user) => user.branchId === branch.id).slice(0, 5).map((user) => (
                            <Avatar key={user.id} className="w-8 h-8 border-2 border-background">
                              <AvatarImage src={user.avatarUrl || ''} alt="" />
                              <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">{user.name.charAt(0)}</AvatarFallback>
                           </Avatar>
                         ))}
                         <div className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium z-10 text-muted-foreground">
                            {users?.filter((user) => user.branchId === branch.id).length || 0}
                         </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
           </div>
        </TabsContent>
      </Tabs>

      <Dialog open={inviteOpen} onOpenChange={closeInviteDialog}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-add-administrator">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Add administrator
            </DialogTitle>
            <DialogDescription>
              Create an Admin account and request a one-time setup link. The new administrator sets their own password before signing in.
            </DialogDescription>
          </DialogHeader>
          <Form {...inviteForm}>
            <form onSubmit={inviteForm.handleSubmit(inviteAdministrator)} className="space-y-4">
              <FormField
                control={inviteForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="name" maxLength={120} data-testid="input-admin-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inviteForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" autoComplete="email" maxLength={254} data-testid="input-admin-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground" data-testid="text-admin-setup-explainer">
                No temporary password will be shown or sent. QuickProp will email a secure setup link to the address above.
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => closeInviteDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createUser.isPending || requestPasswordReset.isPending} data-testid="button-submit-administrator">
                  {(createUser.isPending || requestPasswordReset.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create administrator
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deactivationTarget)} onOpenChange={(open) => { if (!open) setDeactivationTarget(null); }}>
        <AlertDialogContent data-testid="dialog-deactivate-user">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this account?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivationTarget
                ? deactivationTarget.id === currentUser?.id
                  ? `You will be signed out when your account is deactivated. Another active administrator must remain able to sign in. Your assigned records and history will be kept.`
                  : `${deactivationTarget.name} (${deactivationTarget.email}) will no longer be able to sign in. Their assigned listings, tasks, and history will be kept.`
                : 'This account will no longer be able to sign in. Its assigned records will be kept.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateUser.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deactivationTarget || updateUser.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deactivationTarget) updateUserStatus(deactivationTarget.id, 'inactive', 'Account deactivated');
              }}
              data-testid="button-confirm-deactivate-user"
            >
              {updateUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deactivate account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}