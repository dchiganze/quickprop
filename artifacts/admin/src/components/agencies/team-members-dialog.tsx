import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { AdminAgencyBranch, AdminAgent } from '@workspace/api-client-react';

type TeamMembersDialogProps = {
  open: boolean;
  branch: AdminAgencyBranch | null;
  agents: AdminAgent[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (userIds: number[]) => void;
};

export function TeamMembersDialog({
  open,
  branch,
  agents,
  saving,
  onOpenChange,
  onSave,
}: TeamMembersDialogProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelected(branch?.members.map((member) => member.id) ?? []);
    setSearch('');
  }, [open, branch]);

  const filteredAgents = useMemo(() => agents.filter((agent) => {
    const query = search.trim().toLowerCase();
    return !query || agent.name.toLowerCase().includes(query) || agent.email.toLowerCase().includes(query);
  }), [agents, search]);

  const toggle = (userId: number) => {
    setSelected((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage team members</DialogTitle>
          <DialogDescription>
            Choose existing agent accounts for {branch?.name ?? 'this branch'}. Saving moves selected agents from any other branch.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an agent…" className="pl-9" />
        </div>
        <div className="max-h-[360px] overflow-y-auto rounded-lg border">
          {filteredAgents.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 h-5 w-5" />
              {agents.length === 0 ? 'There are no agent accounts to assign yet.' : 'No agents match this search.'}
            </div>
          ) : filteredAgents.map((agent) => {
            const checked = selected.includes(agent.id);
            const moving = agent.branchId != null && agent.branchId !== branch?.id;
            return (
              <label key={agent.id} className="flex cursor-pointer items-center gap-3 border-b p-3 last:border-b-0 hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(agent.id)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {agent.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{agent.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{agent.email}</span>
                </span>
                {moving && <Badge variant="outline" className="max-w-40 truncate text-xs">Move from {agent.branchName}</Badge>}
                {!moving && checked && <Badge variant="secondary" className="text-xs">Assigned here</Badge>}
              </label>
            );
          })}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={() => onSave(selected)} disabled={saving || !branch}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save team ({selected.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
