import { useEffect, useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import type { AdminAgency } from '@workspace/api-client-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type AgentInviteDraft = {
  branchId: number;
  name: string;
  email: string;
  phone: string;
};

type AgentInviteDialogProps = {
  open: boolean;
  agency: AdminAgency | null;
  defaultBranchId: number | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: AgentInviteDraft) => void;
  onAddBranch: () => void;
};

export function AgentInviteDialog({
  open,
  agency,
  defaultBranchId,
  saving,
  onOpenChange,
  onSave,
  onAddBranch,
}: AgentInviteDialogProps) {
  const activeBranches = agency?.branches.filter((branch) => branch.status === 'active') ?? [];
  const [branchId, setBranchId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const defaultBranch = activeBranches.find((branch) => branch.id === defaultBranchId) ?? activeBranches[0];
    setBranchId(defaultBranch ? String(defaultBranch.id) : '');
    setName('');
    setEmail('');
    setPhone('');
    setError('');
  }, [open, agency, defaultBranchId]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const selectedBranchId = Number(branchId);
    if (cleanName.length < 2) {
      setError('Enter the agent’s full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!Number.isSafeInteger(selectedBranchId) || selectedBranchId < 1) {
      setError('Choose a branch for this agent.');
      return;
    }
    onSave({
      branchId: selectedBranchId,
      name: cleanName,
      email: cleanEmail,
      phone: phone.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add agent to {agency?.name ?? 'agency'}</DialogTitle>
          <DialogDescription>
            QuickProp will email a one-time password setup link. The saved phone can receive sign-in codes immediately; the first verified code activates the account.
          </DialogDescription>
        </DialogHeader>

        {activeBranches.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <UserPlus className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Add a branch first</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Agents are assigned to a branch so their listings stay within the right office.
            </p>
            <Button className="mt-4" onClick={onAddBranch}>
              Add branch
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Branch</span>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue placeholder="Choose a branch" /></SelectTrigger>
                <SelectContent>
                  {activeBranches.map((branch) => (
                    <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Agent name</span>
              <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Email</span>
              <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Phone</span>
              <Input
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+263 77 123 4567"
                maxLength={40}
                required
              />
              <span className="block text-xs text-muted-foreground">Use an international number; Zimbabwe local numbers starting with 0 are accepted too.</span>
            </label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving || !branchId || !phone.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send setup link
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
