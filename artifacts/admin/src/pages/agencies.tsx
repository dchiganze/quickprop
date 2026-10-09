import { useMemo, useState } from 'react';
import {
  useArchiveAdminAgency,
  useArchiveAdminAgencyBranch,
  useCreateAdminAgency,
  useCreateAdminAgencyBranch,
  useGetAdminAgencies,
  useGetAdminAgents,
  useSetAdminBranchMembers,
  useUpdateAdminAgency,
  useUpdateAdminAgencyBranch,
} from '@workspace/api-client-react';
import type { AdminAgency, AdminAgencyBranch } from '@workspace/api-client-react';
import {
  Archive,
  ArchiveRestore,
  BarChart3,
  Building2,
  GitBranch,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AgencyFormDialog, type AgencyDraft } from '@/components/agencies/agency-form-dialog';
import { BranchFormDialog, type BranchDraft } from '@/components/agencies/branch-form-dialog';
import { TeamMembersDialog } from '@/components/agencies/team-members-dialog';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Please try again.';
}

export default function Agencies() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [agencyDialog, setAgencyDialog] = useState<{ agency: AdminAgency | null } | null>(null);
  const [branchDialog, setBranchDialog] = useState<{ agencyId: number; branch: AdminAgencyBranch | null } | null>(null);
  const [teamBranch, setTeamBranch] = useState<AdminAgencyBranch | null>(null);

  const {
    data: agencyData,
    isLoading,
    refetch: refetchAgencies,
  } = useGetAdminAgencies();
  const {
    data: agents = [],
    refetch: refetchAgents,
  } = useGetAdminAgents();

  const createAgency = useCreateAdminAgency();
  const updateAgency = useUpdateAdminAgency();
  const archiveAgency = useArchiveAdminAgency();
  const createBranch = useCreateAdminAgencyBranch();
  const updateBranch = useUpdateAdminAgencyBranch();
  const archiveBranch = useArchiveAdminAgencyBranch();
  const setMembers = useSetAdminBranchMembers();

  const agencies = agencyData?.agencies ?? [];
  const unassignedBranches = agencyData?.unassignedBranches ?? [];
  const query = search.trim().toLowerCase();
  const visibleAgencies = useMemo(() => agencies.filter((agency) => {
    if (!showArchived && agency.status !== 'active') return false;
    return !query ||
      agency.name.toLowerCase().includes(query) ||
      (agency.email ?? '').toLowerCase().includes(query) ||
      agency.branches.some((branch) => branch.name.toLowerCase().includes(query));
  }), [agencies, query, showArchived]);
  const visibleUnassignedBranches = unassignedBranches.filter((branch) =>
    (showArchived || branch.status === 'active') &&
    (!query || branch.name.toLowerCase().includes(query))
  );

  const refetchAll = () => {
    void refetchAgencies();
    void refetchAgents();
  };

  const handleAgencySave = (draft: AgencyDraft) => {
    if (!agencyDialog) return;
    const onSuccess = () => {
      setAgencyDialog(null);
      refetchAll();
      toast({ title: agencyDialog.agency ? 'Agency updated' : 'Agency created' });
    };
    const onError = (error: unknown) => toast({
      title: 'Could not save agency',
      description: getErrorMessage(error),
      variant: 'destructive',
    });

    if (agencyDialog.agency) {
      updateAgency.mutate({ id: agencyDialog.agency.id, data: draft }, { onSuccess, onError });
    } else {
      createAgency.mutate({ data: draft }, { onSuccess, onError });
    }
  };

  const handleBranchSave = (draft: BranchDraft) => {
    if (!branchDialog) return;
    const onSuccess = () => {
      setBranchDialog(null);
      refetchAll();
      toast({ title: branchDialog.branch ? 'Branch updated' : 'Branch added' });
    };
    const onError = (error: unknown) => toast({
      title: 'Could not save branch',
      description: getErrorMessage(error),
      variant: 'destructive',
    });

    if (branchDialog.branch) {
      updateBranch.mutate({ id: branchDialog.branch.id, data: draft }, { onSuccess, onError });
    } else {
      createBranch.mutate({ agencyId: branchDialog.agencyId, data: draft }, { onSuccess, onError });
    }
  };

  const handleAgencyArchive = (agency: AdminAgency) => {
    const restore = agency.status === 'archived';
    if (!restore && !window.confirm(
      `Archive ${agency.name}? Its branches, team accounts, listings and history will be kept. You can restore it later.`
    )) return;
    if (restore) {
      updateAgency.mutate(
        { id: agency.id, data: { status: 'active' } },
        {
          onSuccess: () => {
            refetchAll();
            toast({ title: `${agency.name} restored` });
          },
          onError: (error) => toast({ title: 'Could not restore agency', description: getErrorMessage(error), variant: 'destructive' }),
        },
      );
      return;
    }
    archiveAgency.mutate({ id: agency.id }, {
      onSuccess: () => {
        refetchAll();
        toast({ title: `${agency.name} archived`, description: 'Its branches and records were preserved.' });
      },
      onError: (error) => toast({ title: 'Could not archive agency', description: getErrorMessage(error), variant: 'destructive' }),
    });
  };

  const handleBranchArchive = (branch: AdminAgencyBranch) => {
    const restore = branch.status === 'archived';
    if (!restore && !window.confirm(
      `Archive ${branch.name}? Its team assignments and listing history will be kept.`
    )) return;
    const onSuccess = () => {
      refetchAll();
      toast({ title: restore ? 'Branch restored' : 'Branch archived', description: 'Existing accounts and listings were preserved.' });
    };
    const onError = (error: unknown) => toast({
      title: restore ? 'Could not restore branch' : 'Could not archive branch',
      description: getErrorMessage(error),
      variant: 'destructive',
    });

    if (restore) {
      updateBranch.mutate({ id: branch.id, data: { status: 'active' } }, { onSuccess, onError });
    } else {
      archiveBranch.mutate({ id: branch.id }, { onSuccess, onError });
    }
  };

  const handleMembersSave = (userIds: number[]) => {
    if (!teamBranch) return;
    setMembers.mutate({ id: teamBranch.id, data: { userIds } }, {
      onSuccess: () => {
        setTeamBranch(null);
        refetchAll();
        toast({ title: 'Team updated', description: 'Selected agents are now assigned to this branch.' });
      },
      onError: (error) => toast({ title: 'Could not update team', description: getErrorMessage(error), variant: 'destructive' }),
    });
  };

  const handleUnassignedBranch = (branchId: number, agencyId: string) => {
    const targetId = Number(agencyId);
    if (!Number.isSafeInteger(targetId) || targetId < 1) return;
    updateBranch.mutate({ id: branchId, data: { agencyId: targetId } }, {
      onSuccess: () => {
        refetchAll();
        toast({ title: 'Branch assigned to agency' });
      },
      onError: (error) => toast({ title: 'Could not assign branch', description: getErrorMessage(error), variant: 'destructive' }),
    });
  };

  const agencySaving = createAgency.isPending || updateAgency.isPending;
  const branchSaving = createBranch.isPending || updateBranch.isPending;
  const activeAgencyCount = agencies.filter((agency) => agency.status === 'active').length;
  const totalBranchCount = agencies.reduce((total, agency) => total + agency.branchCount, 0) + unassignedBranches.length;
  const totalTeamCount = agencies.reduce((total, agency) => total + agency.teamCount, 0) +
    unassignedBranches.reduce((total, branch) => total + branch.agentCount, 0);

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Platform / People</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Agencies</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage agency profiles, branches and agent assignments.</p>
        </div>
        <Button onClick={() => setAgencyDialog({ agency: null })}>
          <Plus className="mr-2 h-4 w-4" /> Add agency
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<Building2 className="h-4 w-4" />} label="Active agencies" value={activeAgencyCount} />
        <SummaryCard icon={<GitBranch className="h-4 w-4" />} label="Branches" value={totalBranchCount} />
        <SummaryCard icon={<Users className="h-4 w-4" />} label="Assigned agents" value={totalTeamCount} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search agencies or branches…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Show archived
            </label>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)}
            </div>
          ) : visibleAgencies.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-14 text-center">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-3 font-semibold text-foreground">{query ? 'No matching agencies' : 'No agencies yet'}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {query ? 'Try a different search.' : 'Create an agency profile, then add its branches and assign existing agent accounts.'}
              </p>
              {!query && <Button className="mt-4" onClick={() => setAgencyDialog({ agency: null })}><Plus className="mr-2 h-4 w-4" /> Add first agency</Button>}
            </div>
          ) : (
            <div className="space-y-4">
              {visibleAgencies.map((agency) => (
                <AgencyCard
                  key={agency.id}
                  agency={agency}
                  branches={agency.branches.filter((branch) => showArchived || branch.status === 'active')}
                  allAgencies={agencies}
                  searchQuery={query}
                  onEdit={() => setAgencyDialog({ agency })}
                  onArchive={() => handleAgencyArchive(agency)}
                  onAddBranch={() => setBranchDialog({ agencyId: agency.id, branch: null })}
                  onEditBranch={(branch) => setBranchDialog({ agencyId: agency.id, branch })}
                  onArchiveBranch={handleBranchArchive}
                  onManageTeam={setTeamBranch}
                  onMoveBranch={handleUnassignedBranch}
                  savingBranchId={updateBranch.isPending ? updateBranch.variables?.id ?? null : null}
                />
              ))}
            </div>
          )}

          {visibleUnassignedBranches.length > 0 && (
            <section className="space-y-3 border-t pt-5">
              <div>
                <h2 className="font-semibold">Branches without an agency</h2>
                <p className="text-sm text-muted-foreground">Assign existing branches to an agency; linked accounts and listings remain intact.</p>
              </div>
              <div className="divide-y rounded-lg border">
                {visibleUnassignedBranches.map((branch) => (
                  <div key={branch.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-48">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{branch.name}</span>
                        {branch.status === 'archived' && <Badge variant="outline">Archived</Badge>}
                      </div>
                      {branch.address && <p className="ml-6 mt-1 text-xs text-muted-foreground">{branch.address}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setTeamBranch(branch)} disabled={branch.status !== 'active'}>
                        <Users className="mr-2 h-3.5 w-3.5" /> Team ({branch.agentCount})
                      </Button>
                      <Select onValueChange={(value) => handleUnassignedBranch(branch.id, value)} disabled={updateBranch.isPending || branch.status !== 'active'}>
                        <SelectTrigger className="w-52"><SelectValue placeholder="Assign to agency…" /></SelectTrigger>
                        <SelectContent>
                          {agencies.filter((agency) => agency.status === 'active').map((agency) => (
                            <SelectItem key={agency.id} value={String(agency.id)}>{agency.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" aria-label="Edit branch" onClick={() => setBranchDialog({ agencyId: 0, branch })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={branch.status === 'active' ? 'Archive branch' : 'Restore branch'} onClick={() => handleBranchArchive(branch)}>
                        {branch.status === 'active' ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </CardContent>
      </Card>

      <AgencyFormDialog
        open={agencyDialog !== null}
        agency={agencyDialog?.agency ?? null}
        saving={agencySaving}
        onOpenChange={(open) => { if (!open) setAgencyDialog(null); }}
        onSave={handleAgencySave}
      />
      <BranchFormDialog
        open={branchDialog !== null}
        branch={branchDialog?.branch ?? null}
        saving={branchSaving}
        onOpenChange={(open) => { if (!open) setBranchDialog(null); }}
        onSave={(draft) => {
          if (!branchDialog) return;
          if (branchDialog.branch && branchDialog.branch.agencyId == null && branchDialog.agencyId === 0) {
            updateBranch.mutate({ id: branchDialog.branch.id, data: draft }, {
              onSuccess: () => { setBranchDialog(null); refetchAll(); toast({ title: 'Branch updated' }); },
              onError: (error) => toast({ title: 'Could not save branch', description: getErrorMessage(error), variant: 'destructive' }),
            });
          } else {
            handleBranchSave(draft);
          }
        }}
      />
      <TeamMembersDialog
        open={teamBranch !== null}
        branch={teamBranch}
        agents={agents}
        saving={setMembers.isPending}
        onOpenChange={(open) => { if (!open) setTeamBranch(null); }}
        onSave={handleMembersSave}
      />
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <span>
          <span className="block text-2xl font-bold leading-none">{value}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
        </span>
      </CardContent>
    </Card>
  );
}

function AgencyCard({
  agency,
  branches,
  allAgencies,
  searchQuery,
  onEdit,
  onArchive,
  onAddBranch,
  onEditBranch,
  onArchiveBranch,
  onManageTeam,
  onMoveBranch,
  savingBranchId,
}: {
  agency: AdminAgency;
  branches: AdminAgencyBranch[];
  allAgencies: AdminAgency[];
  searchQuery: string;
  onEdit: () => void;
  onArchive: () => void;
  onAddBranch: () => void;
  onEditBranch: (branch: AdminAgencyBranch) => void;
  onArchiveBranch: (branch: AdminAgencyBranch) => void;
  onManageTeam: (branch: AdminAgencyBranch) => void;
  onMoveBranch: (branchId: number, agencyId: string) => void;
  savingBranchId: number | null;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
            {agency.logoUrl ? <img src={agency.logoUrl} alt={`${agency.name} logo`} className="h-full w-full object-contain p-1" /> : <Building2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold">{agency.name}</h2>
              <Badge variant={agency.status === 'active' ? 'secondary' : 'outline'}>{agency.status}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {agency.email && <span>{agency.email}</span>}
              {agency.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{agency.phone}</span>}
              {agency.website && <span>{agency.website}</span>}
            </div>
            {agency.aboutText && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{agency.aboutText}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-2 h-3.5 w-3.5" /> Edit</Button>
          {agency.status === 'active' && (
            <Button size="sm" variant="outline" onClick={onAddBranch}><Plus className="mr-2 h-3.5 w-3.5" /> Add branch</Button>
          )}
          <Button size="sm" variant="ghost" onClick={onArchive}>
            {agency.status === 'active' ? <><Archive className="mr-2 h-3.5 w-3.5" /> Archive</> : <><ArchiveRestore className="mr-2 h-3.5 w-3.5" /> Restore</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-y bg-muted/20 px-4 py-3 sm:grid-cols-5">
        <AgencyMetric label="Branches" value={agency.branchCount} icon={<GitBranch className="h-3.5 w-3.5" />} />
        <AgencyMetric label="Agents" value={agency.teamCount} icon={<Users className="h-3.5 w-3.5" />} />
        <AgencyMetric label="Active listings" value={agency.activeListings} />
        <AgencyMetric label="Total listings" value={agency.totalListings} />
        <AgencyMetric label="Leads" value={agency.totalLeads} icon={<BarChart3 className="h-3.5 w-3.5" />} />
      </div>

      <div className="divide-y">
        {branches.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">
            {searchQuery ? 'No matching branches.' : 'No active branches. Add a branch when this agency is ready.'}
          </p>
        ) : branches.map((branch) => (
          <div key={branch.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-52 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{branch.name}</span>
                {branch.status === 'archived' && <Badge variant="outline">Archived</Badge>}
              </div>
              <div className="ml-6 mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {branch.address && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{branch.address}</span>}
                {branch.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{branch.phone}</span>}
                <span>{branch.agentCount} team member{branch.agentCount === 1 ? '' : 's'}</span>
                {branch.members.length > 0 && <span>{branch.members.map((member) => member.name).join(', ')}</span>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {branch.status === 'active' && agency.status === 'active' && (
                <Button size="sm" variant="outline" onClick={() => onManageTeam(branch)}>
                  <Users className="mr-2 h-3.5 w-3.5" /> Team
                </Button>
              )}
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {branch.activeListings} active · {branch.totalLeads} leads
              </span>
              {branch.status === 'active' && (
                <Select
                  value={String(agency.id)}
                  onValueChange={(value) => onMoveBranch(branch.id, value)}
                  disabled={savingBranchId === branch.id || agency.status !== 'active'}
                >
                  <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allAgencies.filter((item) => item.status === 'active').map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button size="icon" variant="ghost" aria-label="Edit branch" onClick={() => onEditBranch(branch)} disabled={agency.status !== 'active'}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label={branch.status === 'active' ? 'Archive branch' : 'Restore branch'} onClick={() => onArchiveBranch(branch)} disabled={agency.status !== 'active' && branch.status === 'active'}>
                {branch.status === 'active' ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AgencyMetric({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">{icon}{label}</span>
      <span className="mt-1 block font-semibold text-foreground">{value}</span>
    </div>
  );
}
