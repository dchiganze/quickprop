import { useEffect, useRef, useState } from 'react';
import { Building2, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AdminAgency } from '@workspace/api-client-react';

export type AgencyDraft = {
  name: string;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  aboutText: string;
};

type AgencyFormDialogProps = {
  open: boolean;
  agency: AdminAgency | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: AgencyDraft) => void;
};

export function AgencyFormDialog({
  open,
  agency,
  saving,
  onOpenChange,
  onSave,
}: AgencyFormDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [aboutText, setAboutText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(agency?.name ?? '');
    setLogoUrl(agency?.logoUrl ?? null);
    setEmail(agency?.email ?? '');
    setPhone(agency?.phone ?? '');
    setWebsite(agency?.website ?? '');
    setAboutText(agency?.aboutText ?? '');
    setError('');
  }, [open, agency]);

  const uploadLogo = async (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setError('Choose a PNG or JPG image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo files must be 2 MB or smaller.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const response = await fetch('/api/storage/uploads/request-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });
      const target = await response.json().catch(() => null) as {
        uploadURL?: string;
        objectPath?: string;
        error?: string;
      } | null;
      if (!response.ok || !target?.uploadURL || !target.objectPath) {
        throw new Error(target?.error || 'Could not prepare the logo upload.');
      }

      const upload = await fetch(target.uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!upload.ok) throw new Error('Could not upload the logo.');
      setLogoUrl(`/api/storage${target.objectPath}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Logo upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError('Enter an agency name with at least two characters.');
      return;
    }
    onSave({
      name: cleanName,
      logoUrl,
      email: email.trim() || null,
      phone: phone.trim() || null,
      website: website.trim() || null,
      aboutText: aboutText.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{agency ? 'Edit agency' : 'Add agency'}</DialogTitle>
          <DialogDescription>
            Set up the agency profile and logo. You can add its branches and team members after saving.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <div className="space-y-2">
              <span className="text-sm font-medium">Logo</span>
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border bg-muted/30">
                {logoUrl ? (
                  <img src={logoUrl} alt={`${name || 'Agency'} logo preview`} className="h-full w-full object-contain p-2" />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(event) => void uploadLogo(event.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                {uploading ? 'Uploading' : 'Upload logo'}
              </Button>
              {logoUrl && (
                <Button type="button" variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setLogoUrl(null)}>
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove logo
                </Button>
              )}
            </div>
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Agency name <span className="text-destructive">*</span></span>
                <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Email</span>
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Phone</span>
                <Input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Website</span>
                <Input type="url" placeholder="https://" value={website} onChange={(event) => setWebsite(event.target.value)} maxLength={500} />
              </label>
            </div>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">About</span>
            <Textarea value={aboutText} onChange={(event) => setAboutText(event.target.value)} maxLength={2000} rows={3} />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving || uploading}>Cancel</Button>
            <Button type="submit" disabled={saving || uploading || name.trim().length < 2}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {agency ? 'Save changes' : 'Create agency'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
