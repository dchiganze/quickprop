import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import type { AdminAgencyBranch } from '@workspace/api-client-react';

export type BranchDraft = {
  name: string;
  address: string | null;
  phone: string | null;
};

type BranchFormDialogProps = {
  open: boolean;
  branch: AdminAgencyBranch | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: BranchDraft) => void;
};

export function BranchFormDialog({
  open,
  branch,
  saving,
  onOpenChange,
  onSave,
}: BranchFormDialogProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(branch?.name ?? '');
    setAddress(branch?.address ?? '');
    setPhone(branch?.phone ?? '');
    setError('');
  }, [open, branch]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError('Enter a branch name with at least two characters.');
      return;
    }
    onSave({
      name: cleanName,
      address: address.trim() || null,
      phone: phone.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{branch ? 'Edit branch' : 'Add branch'}</DialogTitle>
          <DialogDescription>
            Branches are the locations agents belong to. Existing listings and accounts stay connected when a branch is edited.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Branch name <span className="text-destructive">*</span></span>
            <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Address</span>
            <Input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={500} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Phone</span>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || name.trim().length < 2}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {branch ? 'Save branch' : 'Add branch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
