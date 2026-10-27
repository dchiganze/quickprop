import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAdminAgenciesQueryKey,
  getListBranchesQueryKey,
  getListUsersQueryKey,
  useCreateAdminAgencyAgent,
  useCreateAdminAgencyBranch,
  useCreateUser,
  useDeleteUser,
  useGetAdminAgencies,
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
import { Building2, Loader2, Mail, Plus, ShieldCheck, Trash2, UserCheck, UserPlus, UserX } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const inviteSchema = z.object({
  name: z.string().trim().min(2, 'Enter the administrator’s full name.').max(120),
  email: z.string().trim().email('Enter a valid email address.').max(254),
});

type InviteValues = z.infer<typeof inviteSchema>;
const emptyInvite: InviteValues = { name: '', email: '' };
const teamInviteSchema = z.object({
  name: z.string().trim().min(2, 'Enter the team member’s full name.').max(120),
  email: z.string().trim().email('Enter a valid email address.').max(254),
  phone: z.string().trim().min(8, 'Include a phone number with its country code.').max(40),
  branchId: z.coerce.number().int().positive('Choose a branch.'),
});
type TeamInviteValues = z.infer<typeof teamInviteSchema>;
const emptyTeamInvite: TeamInviteValues = { name: '', email: '', phone: '', branchId: 0 };
const branchSchema = z.object({
  agencyId: z.coerce.number().int().positive('Choose an agency.'),
  name: z.string().trim().min(2, 'Enter a branch name.').max(500),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(40).optional(),
});
type BranchValues = z.infer<typeof branchSchema>;
const emptyBranch: BranchValues = { agencyId: 0, name: '', address: '', phone: '' };
const administratorRoles = ['principal', 'admin'];

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function Users() {
  const { data: currentUser } = useGetCurrentUser();
  const canManageUsers = currentUser?.role === 'admin';
  const { data: users, isLoading: loadingUsers } = useListUsers();
  const { data: branches, isLoading: loadingBranches } = useListBranches();
  const { data: agencies } = useGetAdminAgencies({
    query: { enabled: canManageUsers, queryKey: getGetAdminAgenciesQueryKey() },
  });
  const createUser = useCreateUser();
  const createTeamMember = useCreateAdminAgencyAgent();
  const createBranch = useCreateAdminAgencyBranch();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const requestPasswordReset = useRequestAdminPasswordReset();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamInviteOpen, setTeamInviteOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [deactivationTarget, setDeactivationTarget] = useState<{ id: number; name: string; email: string } | null>(null);
  const [deletionTarget, setDeletionTarget] = useState<{ id: number; name: string; email: string; role: string; status: string } | null>(null);
  const [setupLinkTargetId, setSetupLinkTargetId] = useState<number | null>(null);
  const activeAdminCount = users?.filter((user) => administratorRoles.includes(user.role) && user.status === 'active').length ?? 0;
  const activeAgencies = (agencies?.agencies ?? []).filter((agency) => agency.status === 'active');
  const activeAgencyIds = new Set(activeAgencies.map((agency) => agency.id));
  const teamBranches = (branches ?? []).filter((branch) =>
    branch.status === 'active'
    && branch.agencyId != null
    && activeAgencyIds.has(branch.agencyId),
  );
  const currentBranchAgencyId = branches?.find((branch) => branch.id === currentUser?.branchId)?.agencyId ?? null;

  const inviteForm = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: emptyInvite,
  });
  const teamInviteForm = useForm<TeamInviteValues>({
    resolver: zodResolver(teamInviteSchema),
    defaultValues: emptyTeamInvite,
  });
  const branchForm = useForm<BranchValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: emptyBranch,
  });

  const closeInviteDialog = (open: boolean) => {
    setInviteOpen(open);
    if (!open) inviteForm.reset(emptyInvite);
  };

  const openTeamInvite = () => {
    const defaultBranchId = teamBranches.find((branch) => branch.id === currentUser?.branchId)?.id
      ?? teamBranches[0]?.id
      ?? 0;
    teamInviteForm.reset({ ...emptyTeamInvite, branchId: defaultBranchId });
    setTeamInviteOpen(true);
  };

  const inviteTeamMember = (values: TeamInviteValues) => {
    const branch = teamBranches.find((item) => item.id === values.branchId);
    if (!branch?.agencyId) {
      toast({
        title: 'Branch assignment required',
        description: 'Choose an active branch connected to this agency before inviting a team member.',
        variant: 'destructive',
      });
      return;
    }
    createTeamMember.mutate(
      {
        agencyId: branch.agencyId,
        data: {
          branchId: branch.id,
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          phone: values.phone.trim(),
        },
      },
      {
        onSuccess: (created) => {
          void queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getListBranchesQueryKey() });
          setTeamInviteOpen(false);
          teamInviteForm.reset(emptyTeamInvite);
          toast({
            title: 'Team member invited',
            description: `A secure setup link was sent to ${created.email}.`,
          });
        },
        onError: (error) => toast({
          title: 'Could not invite team member',
          description: errorText(error, 'Check the details and try again.'),
          variant: 'destructive',
        }),
      },
    );
  };

  const openBranchDialog = () => {
    branchForm.reset({
      ...emptyBranch,
      agencyId: currentBranchAgencyId
        ?? activeAgencies[0]?.id
        ?? 0,
    });
    setBranchOpen(true);
  };

  const addBranch = (values: BranchValues) => {
    const agency = activeAgencies.find((item) => item.id === values.agencyId);
    if (!agency) {
      toast({
        title: 'Choose an active agency',
        description: 'An active agency is required before a branch can be added.',
        variant: 'destructive',
      });
      return;
    }
    createBranch.mutate(
      {
        agencyId: agency.id,
        data: {
          name: values.name.trim(),
          address: values.address?.trim() || null,
          phone: values.phone?.trim() || null,
          isMain: false,
        },
      },
      {
        onSuccess: (created) => {
          void queryClient.invalidateQueries({ queryKey: getListBranchesQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetAdminAgenciesQueryKey() });
          setBranchOpen(false);
          branchForm.reset(emptyBranch);
          toast({ title: 'Branch added', description: `${created.name} is ready for team assignments.` });
        },
        onError: (error) => toast({
          title: 'Could not add branch',
          description: errorText(error, 'Check the details and try again.'),
          variant: 'destructive',
        }),
      },
    );
  };

  const deleteProfile = () => {
    if (!deletionTarget) return;
    deleteUser.mutate(
      { id: deletionTarget.id },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getListBranchesQueryKey() });
          setDeletionTarget(null);
          toast({ title: 'Profile deleted', description: 'Sign-in was revoked; linked business records were retained.' });
        },
        onError: (error) => toast({
          title: 'Could not delete profile',
          description: errorText(error, 'Try again or contact an administrator.'),
          variant: 'destructive',
        }),
      },
    );
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
        <div className="flex flex-wrap gap-3">
          {canManageUsers && (
            <Button variant="outline" className="shadow-sm" onClick={openBranchDialog} disabled={createBranch.isPending} data-testid="button-add-branch">
              <Plus className="w-4 h-4 mr-2" />
              Add Branch
            </Button>
          )}
          {canManageUsers && (
            <Button variant="outline" className="shadow-sm" onClick={openTeamInvite} disabled={loadingBranches || createTeamMember.isPending} data-testid="button-add-team-member">
              <UserPlus className="w-4 h-4 mr-2" />
              Add team member
            </Button>
          )}
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
            Only Admins can add, deactivate, or delete team profiles. You can still view team members.
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
              <div className="min-w-[960px]">
                <div className="grid grid-cols-[minmax(220px,2fr)_minmax(110px,1fr)_minmax(140px,1.2fr)_90px_minmax(320px,2fr)] gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <div>User</div>
                  <div>Role</div>
                  <div>Branch</div>
                  <div>Status</div>
                  <div className="text-right">Account actions</div>
                </div>
                <div className="divide-y">
                  {loadingUsers ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="grid grid-cols-[minmax(220px,2fr)_minmax(110px,1fr)_minmax(140px,1.2fr)_90px_minmax(320px,2fr)] gap-4 p-4 items-center">
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
                      const canDelete = canManageUsers && !isCurrentUser && !(isAdmin && user.status === 'active' && isLastActiveAdmin);

                      return (
                        <div
                          key={user.id}
                          className="grid grid-cols-[minmax(220px,2fr)_minmax(110px,1fr)_minmax(140px,1.2fr)_90px_minmax(320px,2fr)] gap-4 p-4 items-center hover:bg-muted/30 transition-colors"
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
                            {canManageUsers && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={!canDelete || deleteUser.isPending}
                                title={isCurrentUser ? 'You cannot delete your own profile here.' : isLastActiveAdmin && isAdmin && user.status === 'active' ? 'Keep at least one active administrator.' : undefined}
                                onClick={() => setDeletionTarget({ id: user.id, name: user.name, email: user.email, role: user.role, status: user.status })}
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </Button>
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

      <Dialog open={teamInviteOpen} onOpenChange={(open) => {
        setTeamInviteOpen(open);
        if (!open) teamInviteForm.reset(emptyTeamInvite);
      }}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-add-team-member">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add team member
            </DialogTitle>
            <DialogDescription>
              Invite an agent to a branch. They receive a secure setup link and can sign in after setting their password.
            </DialogDescription>
          </DialogHeader>
          <Form {...teamInviteForm}>
            <form onSubmit={teamInviteForm.handleSubmit(inviteTeamMember)} className="space-y-4">
              <FormField control={teamInviteForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl><Input {...field} autoComplete="name" maxLength={120} data-testid="input-team-member-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={teamInviteForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input {...field} type="email" autoComplete="email" maxLength={254} data-testid="input-team-member-email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={teamInviteForm.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone number</FormLabel>
                  <FormControl><Input {...field} type="tel" autoComplete="tel" placeholder="+263..." maxLength={40} data-testid="input-team-member-phone" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={teamInviteForm.control} name="branchId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <Select value={field.value ? String(field.value) : ''} onValueChange={(value) => field.onChange(Number(value))}>
                    <FormControl>
                      <SelectTrigger data-testid="select-team-member-branch"><SelectValue placeholder="Choose a branch" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {teamBranches.map((branch) => <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {!teamBranches.length && <p className="text-sm text-destructive">No active agency branches are available for this account.</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTeamInviteOpen(false)} disabled={createTeamMember.isPending}>Cancel</Button>
                <Button type="submit" disabled={createTeamMember.isPending || !teamBranches.length} data-testid="button-submit-team-member">
                  {createTeamMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send invitation
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={branchOpen} onOpenChange={(open) => {
        setBranchOpen(open);
        if (!open) branchForm.reset(emptyBranch);
      }}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-add-branch">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Add branch
            </DialogTitle>
            <DialogDescription>
              Add another office location to an active agency. You can assign team members to it afterward.
            </DialogDescription>
          </DialogHeader>
          {activeAgencies.length ? (
            <Form {...branchForm}>
              <form onSubmit={branchForm.handleSubmit(addBranch)} className="space-y-4">
                <FormField control={branchForm.control} name="agencyId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agency</FormLabel>
                    <Select value={field.value ? String(field.value) : ''} onValueChange={(value) => field.onChange(Number(value))}>
                      <FormControl>
                        <SelectTrigger data-testid="select-branch-agency"><SelectValue placeholder="Choose an agency" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeAgencies.map((agency) => <SelectItem key={agency.id} value={String(agency.id)}>{agency.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={branchForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch name</FormLabel>
                    <FormControl><Input {...field} maxLength={500} placeholder="e.g. Avondale" data-testid="input-branch-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={branchForm.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl><Input {...field} maxLength={500} placeholder="Street address (optional)" data-testid="input-branch-address" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={branchForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} type="tel" maxLength={40} placeholder="Branch phone (optional)" data-testid="input-branch-phone" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setBranchOpen(false)} disabled={createBranch.isPending}>Cancel</Button>
                  <Button type="submit" disabled={createBranch.isPending} data-testid="button-submit-branch">
                    {createBranch.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add branch
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                There is no active agency to attach this branch to. Create or reactivate an agency in QuickProp Admin first.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBranchOpen(false)}>Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
      <AlertDialog open={Boolean(deletionTarget)} onOpenChange={(open) => { if (!open) setDeletionTarget(null); }}>
        <AlertDialogContent data-testid="dialog-delete-user">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this profile?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletionTarget
                ? `${deletionTarget.name} (${deletionTarget.email}) will lose sign-in access and be removed from the team list. Their profile details will be replaced with a non-login deleted-profile record so listings, leads, tasks, viewings, and history remain linked. This action cannot be undone.`
                : 'Sign-in access will be revoked and linked business records will be retained.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUser.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!deletionTarget || deleteUser.isPending}
              onClick={(event) => { event.preventDefault(); deleteProfile(); }}
              data-testid="button-confirm-delete-user"
            >
              {deleteUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}