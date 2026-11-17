import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListAgentNetworkMatchesQueryKey, getListAgentNetworkSubmissionsQueryKey,
  useCancelAgentNetworkSubmission, useConfirmAgentNetworkSubmission,
  useCreateAgentNetworkSubmission, useListAgentNetworkMatches,
  useListAgentNetworkSubmissions, useRespondToAgentNetworkMatch,
  useUpdateAgentNetworkListingSharing,
} from '@workspace/api-client-react';
import type { AgentNetworkMatch, AgentNetworkSubmission, ConfirmAgentNetworkSubmissionInput } from '@workspace/api-client-react';
import {
  AlertTriangle, Check, CheckCircle2, FileAudio2, FileText, Handshake,
  Loader2, LockKeyhole, MessageSquareText, Paperclip, RefreshCw, Send, ShieldCheck,
  SlidersHorizontal, Sparkles, ThumbsDown, ThumbsUp, Trash2, X,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type AnyRecord = Record<string, unknown>;
type ExtractionItem = AnyRecord & {
  intent?: string; confidence?: number; property?: AnyRecord; buyerRequirement?: AnyRecord;
  clarificationQuestion?: string; reviewStatus?: string; recordType?: string; recordId?: number;
};
const ACCEPT = '.csv,.xls,.xlsx,.pdf,.txt,.docx,.jpg,.jpeg,.png,.aac,.m4a,.mp3,.ogg,.wav,.webm';
const MAX_TOTAL = 25 * 1024 * 1024;
const MAX_AUDIO = 8 * 1024 * 1024;
const audioFile = (file: File) => /\.(aac|m4a|mp3|ogg|wav|webm)$/i.test(file.name);
const asRecord = (value: unknown): AnyRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
const titleCase = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (v) => v.toUpperCase());
const money = (amount: unknown, currency?: unknown) => amount == null || amount === '' ? 'Not stated' : `${String(currency || 'USD')} ${Number(amount).toLocaleString()}`;
const submissionItems = (submission: AgentNetworkSubmission): ExtractionItem[] => {
  const extraction = asRecord(submission.extraction);
  return Array.isArray(extraction.items) ? extraction.items.map((item) => asRecord(item) as ExtractionItem) : [];
};
const reviewTemplate = (kind: 'property' | 'buyer_requirement'): AnyRecord => kind === 'property'
  ? { title: '', description: '', propertyType: '', listingType: 'sale', price: '', currency: 'USD', suburb: '', city: '', bedrooms: null, bathrooms: null, parking: null, landSize: null, buildingSize: null, features: [], photos: [] }
  : { buyerName: '', phone: '', email: '', propertyType: '', listingType: 'sale', budgetMin: null, budgetMax: null, currency: 'USD', areas: [], bedroomsMin: null, bedroomsMax: null, requiredFeatures: [], preferredFeatures: [], otherPreferences: [], financing: '', urgency: '' };

function PageHeader() {
  return (
    <header className="relative overflow-hidden border-b border-border bg-card px-5 py-7 md:px-9">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-2/5 opacity-40 ledger-grid [mask-image:linear-gradient(to_left,black,transparent)]" />
      <div className="relative mx-auto flex max-w-[1500px] flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Private agent network
          </div>
          <h1 className="text-3xl font-extrabold tracking-[-0.045em] md:text-[2.45rem]">Agent Network</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Review incoming property and buyer details before anything is saved. Contact stays private until both agents agree.</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/[0.055] px-3 py-2 text-xs font-semibold text-primary">
          <LockKeyhole className="h-4 w-4" /> Private by default
        </div>
      </div>
    </header>
  );
}

function ComposePanel({ onCreated, busy }: { onCreated: (message: string, files: File[]) => Promise<boolean>; busy: boolean }) {
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const totalBytes = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files]);
  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setError('');
    const next = Array.from(incoming);
    const invalid = next.find((file) => !new RegExp(`\\.(${ACCEPT.replaceAll('.', '').split(',').join('|')})$`, 'i').test(file.name));
    if (invalid) { setError(`${invalid.name} is not a supported file type.`); return; }
    const merged = [...files, ...next.filter((file) => !files.some((existing) => existing.name === file.name && existing.size === file.size))];
    if (merged.length > 5) { setError('A submission can include up to 5 attachments.'); return; }
    if (merged.reduce((total, file) => total + file.size, 0) > MAX_TOTAL) { setError('Attachments exceed the 25 MB total limit. Remove a file and try again.'); return; }
    const tooLargeAudio = merged.find((file) => audioFile(file) && file.size > MAX_AUDIO);
    if (tooLargeAudio) { setError(`${tooLargeAudio.name} exceeds the 8 MB voice-note limit.`); return; }
    setFiles(merged);
  };
  const submit = async () => {
    if (!message.trim() && !files.length) { setError('Add a message or at least one attachment to continue.'); return; }
    setError('');
    try {
      const extractionFailed = await onCreated(message, files);
      if (extractionFailed) throw new Error('Extraction failed. Your message and attachments remain in the composer.');
      setMessage('');
      setFiles([]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not create the review draft. Your message is still here.');
    }
  };
  return (
    <section className="rounded-lg border border-border bg-card shadow-sm" aria-labelledby="compose-title">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><MessageSquareText className="h-4 w-4" /></div>
          <div><h2 id="compose-title" className="font-bold">Prepare a message</h2><p className="mt-0.5 text-xs text-muted-foreground">A development simulator — this does not send or receive WhatsApp messages.</p></div>
        </div>
        <Badge variant="outline" className="hidden gap-1.5 border-border bg-muted/40 text-[10px] sm:flex"><ShieldCheck className="h-3.5 w-3.5" /> Review before saving</Badge>
      </div>
      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <Label htmlFor="network-message">Message text</Label>
          <Textarea id="network-message" data-testid="input-network-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={12000} placeholder={'Paste a property listing or buyer requirement here…\n\nExample: 3-bed home in Greendale, Harare, asking USD 185,000.'} className="min-h-32 resize-y bg-background text-sm leading-6" />
          <div className="flex justify-between text-[11px] text-muted-foreground"><span>Text is extracted into a draft for your review.</span><span>{message.length.toLocaleString()} / 12,000</span></div>
        </div>
        <div
          role="button" tabIndex={0} data-testid="dropzone-network-files"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click(); }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}
          className="cursor-pointer rounded-md border border-dashed border-primary/35 bg-primary/[0.035] px-4 py-5 text-center transition-colors hover:border-primary/60 hover:bg-primary/[0.06]"
        >
          <Paperclip className="mx-auto h-5 w-5 text-primary" />
          <p className="mt-2 text-sm font-bold">Attach files for extraction</p>
          <p className="mt-1 text-xs text-muted-foreground">CSV, Excel, PDF, text, Word, images and audio · 25 MB total · audio up to 8 MB</p>
          <input ref={inputRef} data-testid="input-network-files" type="file" multiple accept={ACCEPT} className="hidden" onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
        </div>
        {files.length > 0 && <div className="space-y-2" data-testid="list-network-attachments">
          {files.map((file, index) => <div key={`${file.name}-${file.size}`} data-testid={`attachment-${index}`} className="flex items-center gap-2 rounded border bg-muted/30 px-3 py-2">
            {audioFile(file) ? <FileAudio2 className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{file.name}</span><span className="text-[10px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            <button type="button" data-testid={`remove-attachment-${index}`} aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-4 w-4" /></button>
          </div>)}
          <div className="text-right text-[10px] text-muted-foreground">{(totalBytes / 1024 / 1024).toFixed(1)} MB of 25 MB</div>
        </div>}
        {error && <Alert variant="destructive" data-testid="alert-compose-error"><AlertTriangle className="h-4 w-4" /><AlertTitle>Draft not created</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="flex flex-col-reverse justify-between gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
          <p className="max-w-md text-[11px] leading-5 text-muted-foreground">Uploaded files are stored privately. Only file metadata and storage paths are submitted for extraction.</p>
          <Button data-testid="button-create-network-submission" onClick={submit} disabled={busy || (!message.trim() && !files.length)} className="gap-2">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing review…</> : <><Send className="h-4 w-4" /> Create review draft</>}
          </Button>
        </div>
      </div>
    </section>
  );
}

function SubmissionCard({ submission, onConfirm, onCancel, onShare, busy }: {
  submission: AgentNetworkSubmission;
  onConfirm: (submission: AgentNetworkSubmission, index: number, item: ExtractionItem, kind: 'property' | 'buyer_requirement', data: AnyRecord, share: boolean) => void;
  onCancel: (id: number) => void;
  onShare: (recordId: number, enabled: boolean) => void;
  busy: boolean;
}) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [share, setShare] = useState<Record<number, boolean>>({});
  const [kindOverrides, setKindOverrides] = useState<Record<number, 'property' | 'buyer_requirement'>>({});
  const [parseErrors, setParseErrors] = useState<Record<number, string>>({});
  const items = submissionItems(submission);
  const extraction = asRecord(submission.extraction);
  const extractionError = typeof extraction.error === 'string' ? extraction.error : typeof extraction.extractionError === 'string' ? extraction.extractionError : '';
  const canCancel = ['needs_review', 'failed'].includes(submission.status);
  return (
    <article className="rounded-lg border border-border bg-card shadow-sm" data-testid={`submission-${submission.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="font-bold">Submission #{submission.id}</span><Badge variant="outline" data-testid={`submission-status-${submission.id}`} className={cn('text-[10px] uppercase tracking-wide', submission.status === 'failed' ? 'border-destructive/30 bg-destructive/5 text-destructive' : submission.status === 'needs_review' ? 'border-amber-500/30 bg-amber-500/10 text-amber-800' : 'border-primary/25 bg-primary/5 text-primary')}>{titleCase(submission.status)}</Badge></div>
          <p className="mt-1 text-[11px] text-muted-foreground">{new Date(submission.createdAt).toLocaleString()} · {submission.attachments?.length || 0} attachment{(submission.attachments?.length || 0) === 1 ? '' : 's'}</p>
        </div>
        {canCancel && <Button data-testid={`button-cancel-submission-${submission.id}`} variant="ghost" size="sm" disabled={busy} onClick={() => onCancel(submission.id)} className="gap-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Cancel draft</Button>}
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        {submission.sourceText && <div className="rounded-md border-l-2 border-primary/45 bg-muted/35 px-3 py-2.5 text-xs leading-5 text-muted-foreground"><span className="mb-1 block text-[9px] font-extrabold uppercase tracking-[0.14em] text-foreground/60">Source text</span>{submission.sourceText}</div>}
        {extractionError && <Alert variant="destructive" data-testid={`extraction-error-${submission.id}`}><AlertTriangle className="h-4 w-4" /><AlertTitle>Extraction needs attention</AlertTitle><AlertDescription>{extractionError}. The original message is preserved above; you can create another draft after correcting the source.</AlertDescription></Alert>}
        {submission.status === 'failed' && !extractionError && <Alert variant="destructive" data-testid={`submission-failed-${submission.id}`}><AlertTriangle className="h-4 w-4" /><AlertTitle>Extraction failed</AlertTitle><AlertDescription>The submission could not be extracted. Your original source text remains available for reference.</AlertDescription></Alert>}
        {items.length ? <div className="space-y-3">
          {items.map((item, index) => {
            const resolvedIntent = kindOverrides[index] || item.recordType || item.intent;
            const kind = resolvedIntent === 'property' ? 'property' : resolvedIntent === 'buyer_requirement' ? 'buyer_requirement' : 'unknown';
            const original = kind === 'property' ? { ...reviewTemplate('property'), ...asRecord(item.property) }
              : kind === 'buyer_requirement' ? { ...reviewTemplate('buyer_requirement'), ...asRecord(item.buyerRequirement) }
                : {};
            const currentText = drafts[index] ?? JSON.stringify(original, null, 2);
            const confirmed = item.reviewStatus === 'confirmed' || Boolean(item.recordId);
            const skipped = item.reviewStatus === 'skipped';
            const confidence = Number(item.confidence ?? 0);
            const confidencePct = Math.round(confidence <= 1 ? confidence * 100 : confidence);
            return <div key={index} className="rounded-md border border-border bg-background" data-testid={`extraction-item-${submission.id}-${index}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-2"><span className="font-mono text-[10px] text-muted-foreground">ITEM {String(index + 1).padStart(2, '0')}</span><Badge variant="outline" className="text-[10px]">{kind === 'unknown' ? 'Needs classification' : titleCase(kind)}</Badge><span className={cn('text-[10px] font-bold', confidencePct >= 80 ? 'text-primary' : 'text-amber-700')}>{confidencePct}% confidence</span></div>
                {confirmed ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary"><CheckCircle2 className="h-3.5 w-3.5" /> Saved{item.recordId ? ` · #${item.recordId}` : ''}</span> : skipped ? <span className="text-[10px] font-semibold text-muted-foreground">Skipped</span> : <span className="text-[10px] font-semibold text-amber-800">Review required</span>}
              </div>
              {item.clarificationQuestion && <p className="border-b border-border bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-900"><span className="font-bold">Clarify:</span> {item.clarificationQuestion}</p>}
              {kind !== 'unknown' && <div className="space-y-3 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {(kind === 'property'
                    ? [['title', original.title], ['suburb', original.suburb], ['price', money(original.price, original.currency)], ['listingType', original.listingType], ['propertyType', original.propertyType], ['bedrooms', original.bedrooms]]
                    : [['buyerName', original.buyerName], ['areas', Array.isArray(original.areas) ? original.areas.join(', ') : original.areas], ['budgetMin', money(original.budgetMin, original.currency)], ['budgetMax', money(original.budgetMax, original.currency)], ['propertyType', original.propertyType], ['listingType', original.listingType]])
                  .filter(([, value]) => value != null && value !== '').map(([label, value]) => <div key={String(label)} className="rounded border border-border/70 px-2.5 py-2"><div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{String(label)}</div><div className="mt-0.5 truncate text-xs font-semibold">{String(value)}</div></div>)}
                </div>
                {!confirmed ? <>
                  <div className="space-y-1.5"><Label htmlFor={`review-${submission.id}-${index}`} className="text-[11px]">Review all extracted fields as JSON before confirming</Label>
                    <Textarea id={`review-${submission.id}-${index}`} data-testid={`input-review-item-${submission.id}-${index}`} value={currentText} onChange={(event) => { setDrafts((current) => ({ ...current, [index]: event.target.value })); setParseErrors((current) => ({ ...current, [index]: '' })); }} className="min-h-36 bg-muted/20 font-mono text-[11px] leading-5" />
                    {parseErrors[index] && <p className="text-xs text-destructive" data-testid={`review-parse-error-${submission.id}-${index}`}>{parseErrors[index]}</p>}
                  </div>
                  {kind === 'property' && <label className="flex cursor-pointer items-start gap-2 rounded border border-primary/20 bg-primary/[0.035] p-2.5 text-xs"><Checkbox data-testid={`checkbox-share-${submission.id}-${index}`} checked={share[index] ?? false} onCheckedChange={(value) => setShare((current) => ({ ...current, [index]: value === true }))} /><span><span className="block font-bold">Opt this listing into the private network</span><span className="mt-0.5 block text-muted-foreground">The listing is shared only after you confirm it. Contact remains protected.</span></span></label>}
                  <Button data-testid={`button-confirm-item-${submission.id}-${index}`} disabled={busy} onClick={() => {
                    try {
                      const parsed = JSON.parse(currentText) as unknown;
                      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Use a JSON object for the reviewed fields.');
                      setParseErrors((current) => ({ ...current, [index]: '' }));
                       onConfirm(submission, index, item, kind as 'property' | 'buyer_requirement', parsed as AnyRecord, share[index] ?? false);
                    } catch (failure) { setParseErrors((current) => ({ ...current, [index]: failure instanceof Error ? failure.message : 'Invalid JSON.' })); }
                  }} className="gap-2"><Check className="h-4 w-4" /> Confirm and save</Button>
               </> : kind === 'property' && item.recordId ? <Button data-testid={`button-share-record-${item.recordId}`} variant="outline" size="sm" disabled={busy} onClick={() => onShare(item.recordId!, item.networkEnabled !== true)} className="gap-2"><SlidersHorizontal className="h-3.5 w-3.5" /> {item.networkEnabled ? 'Remove from network' : 'Opt into network'}</Button> : null}
              </div>}
              {kind === 'unknown' && <div className="space-y-2 p-3">
                <p className="text-xs text-muted-foreground">Choose what this message contains, then review its fields before saving.</p>
                <div className="flex flex-wrap gap-2">
                  <Button data-testid={`button-classify-property-${submission.id}-${index}`} variant="outline" size="sm" onClick={() => setKindOverrides((current) => ({ ...current, [index]: 'property' }))}>Property listing</Button>
                  <Button data-testid={`button-classify-requirement-${submission.id}-${index}`} variant="outline" size="sm" onClick={() => setKindOverrides((current) => ({ ...current, [index]: 'buyer_requirement' }))}>Buyer requirement</Button>
                </div>
              </div>}
            </div>;
          })}
        </div> : !extractionError && <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
          {submission.status === 'processing' || submission.status === 'queued' ? <><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /><p className="mt-2 text-xs font-semibold">Preparing extracted details…</p></> : <><Sparkles className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-2 text-xs font-semibold">No extracted items to review</p><p className="mt-1 text-[11px] text-muted-foreground">The extraction response did not include any reviewable property or requirement items.</p></>}
        </div>}
      </div>
    </article>
  );
}

function MatchCard({ match, onRespond, busy }: { match: AgentNetworkMatch; onRespond: (id: number, interested: boolean) => void; busy: boolean }) {
  const released = match.contactReleased === true;
  const [responding, setResponding] = useState(false);
  const scoreTone = match.category === 'strong' ? 'bg-primary text-primary-foreground' : match.category === 'potential' ? 'bg-amber-100 text-amber-900' : 'bg-muted text-muted-foreground';
  return <article className="rounded-lg border border-border bg-card shadow-sm" data-testid={`match-${match.id}`}>
    <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><Badge className={cn('rounded-sm capitalize', scoreTone)}>{match.category} match</Badge><span className="font-mono text-xs font-bold tabular-nums">{match.matchPercent}%</span><Badge variant="outline" className="text-[10px] uppercase">{match.status}</Badge></div>
        <h3 className="mt-2 truncate text-base font-bold">{match.listing?.title || 'Private listing'}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{match.listing?.suburb}{match.listing?.suburb && match.listing?.city ? ', ' : ''}{match.listing?.city} · {match.listing?.propertyType} · {match.listing?.bedrooms ?? '—'} beds</p>
      </div>
      <div className="shrink-0 text-right"><div className="text-sm font-extrabold tabular-nums">{money(match.listing?.price, match.listing?.currency)}</div><div className="text-[10px] text-muted-foreground">{match.listing?.reference || `Listing ${match.propertyId}`}</div></div>
    </div>
    <div className="grid gap-4 p-4 sm:grid-cols-[1fr_0.9fr] sm:p-5">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Why it matches</p>
        <ul className="mt-2 space-y-1.5">{(match.reasons || []).map((reason, index) => <li key={index} className="flex gap-2 text-xs leading-5"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{reason}</li>)}{!match.reasons?.length && <li className="text-xs text-muted-foreground">No match reasons were provided.</li>}</ul>
        <div className="mt-3 rounded bg-muted/35 px-3 py-2 text-xs"><span className="font-bold">Requirement:</span> {[match.requirementSummary?.propertyType, match.requirementSummary?.listingType, match.requirementSummary?.areas?.join(', ')].filter(Boolean).join(' · ') || 'Details not supplied'}<span className="block pt-1 text-muted-foreground">{money(match.requirementSummary?.budgetMin, match.requirementSummary?.currency)} – {money(match.requirementSummary?.budgetMax, match.requirementSummary?.currency)}</span></div>
      </div>
      <div className="flex flex-col justify-between gap-4">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="flex items-center gap-2 text-xs font-bold"><LockKeyhole className="h-3.5 w-3.5 text-primary" /> {released ? 'Contacts released' : 'Contact details protected'}</div>
          {released ? <div className="mt-2 space-y-1 text-xs" data-testid={`released-contact-${match.id}`}>
            {match.otherAgent && <p><span className="font-semibold">{match.otherAgent.name || match.otherAgent.agencyName || 'Other agent'}</span>{match.otherAgent.agencyName && match.otherAgent.name ? ` · ${match.otherAgent.agencyName}` : ''}<br />{[match.otherAgent.email, match.otherAgent.phone].filter(Boolean).join(' · ') || 'No agent contact provided'}</p>}
            {match.buyerContact && <p className="border-t border-border pt-2"><span className="font-semibold">{match.buyerContact.name || 'Buyer'}</span><br />{[match.buyerContact.email, match.buyerContact.phone].filter(Boolean).join(' · ') || 'No buyer contact provided'}</p>}
          </div> : <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Both agents must express interest before any cross-agent or buyer contact is shown.</p>}
        </div>
        {!released && match.status === 'open' && <div className="flex flex-wrap gap-2">
          <Button data-testid={`button-interest-${match.id}`} size="sm" disabled={busy} onClick={() => { setResponding(true); onRespond(match.id, true); }} className="gap-1.5"><ThumbsUp className="h-3.5 w-3.5" /> Express interest</Button>
          <Button data-testid={`button-decline-${match.id}`} variant="outline" size="sm" disabled={busy} onClick={() => { setResponding(true); onRespond(match.id, false); }} className="gap-1.5"><ThumbsDown className="h-3.5 w-3.5" /> Decline</Button>
          {responding && busy && <span className="self-center text-[10px] text-muted-foreground">Updating…</span>}
        </div>}
        {!released && (match.listingAgentInterested || match.buyerAgentInterested) && <p className="text-[10px] leading-4 text-muted-foreground" data-testid={`interest-state-${match.id}`}>{match.listingAgentInterested ? 'Listing agent interested' : 'Listing agent has not responded'} · {match.buyerAgentInterested ? 'Buyer agent interested' : 'Buyer agent has not responded'}</p>}
      </div>
    </div>
  </article>;
}

export default function AgentNetwork() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const submissionKey = getListAgentNetworkSubmissionsQueryKey();
  const matchesKey = getListAgentNetworkMatchesQueryKey();
  const submissionsQuery = useListAgentNetworkSubmissions({ query: { queryKey: submissionKey } });
  const matchesQuery = useListAgentNetworkMatches({ query: { queryKey: matchesKey } });
  const createSubmission = useCreateAgentNetworkSubmission();
  const confirmSubmission = useConfirmAgentNetworkSubmission();
  const cancelSubmission = useCancelAgentNetworkSubmission();
  const updateSharing = useUpdateAgentNetworkListingSharing();
  const respondToMatch = useRespondToAgentNetworkMatch();
  const isMutating = createSubmission.isPending || confirmSubmission.isPending || cancelSubmission.isPending || updateSharing.isPending || respondToMatch.isPending;
  const submissions = submissionsQuery.data as AgentNetworkSubmission[] | undefined;
  const matches = matchesQuery.data as AgentNetworkMatch[] | undefined;
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: submissionKey }),
      queryClient.invalidateQueries({ queryKey: matchesKey }),
    ]);
  };
  const createDraft = async (message: string, files: File[]): Promise<boolean> => {
    try {
      const uploaded = [];
      for (const file of files) {
        const request = await fetch('/api/storage/uploads/request-url', {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' }),
        });
        if (!request.ok) throw new Error(`Could not prepare ${file.name} for upload.`);
        const target = await request.json() as { uploadURL: string; objectPath: string };
        const upload = await fetch(target.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
        if (!upload.ok) throw new Error(`Could not upload ${file.name}. Your message text has been preserved.`);
        uploaded.push({ fileName: file.name, contentType: file.type || 'application/octet-stream', sizeBytes: file.size, storagePath: target.objectPath });
      }
      const created = await createSubmission.mutateAsync({ data: { message: message.trim() || undefined, attachments: uploaded } });
      await invalidate();
      const extraction = asRecord(created.extraction);
      const extractionFailed = created.status === 'failed' || typeof extraction.error === 'string' || typeof extraction.extractionError === 'string';
      if (extractionFailed) return true;
      toast({ title: 'Review draft created', description: 'Extracted details will appear below for your confirmation.' });
      return false;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'The extraction request failed.';
      throw new Error(`${detail} Your draft text has been preserved.`);
    }
  };
  const confirmItem = (submission: AgentNetworkSubmission, index: number, _item: ExtractionItem, recordType: 'property' | 'buyer_requirement', data: AnyRecord, share: boolean) => {
    const requestBody = { itemIndex: index, recordType, data, shareWithNetwork: recordType === 'property' ? share : false };
    confirmSubmission.mutate({ id: submission.id, data: requestBody as unknown as ConfirmAgentNetworkSubmissionInput }, {
      onSuccess: async () => { await invalidate(); toast({ title: 'Details confirmed', description: share ? 'Listing saved and opted into the private network.' : 'Reviewed details have been saved.' }); },
      onError: () => toast({ title: 'Could not confirm details', description: 'Your review remains in this draft. Please try again.', variant: 'destructive' }),
    });
  };
  const cancelDraft = (id: number) => {
    if (!window.confirm('Cancel this pending submission?')) return;
    cancelSubmission.mutate({ id }, { onSuccess: async () => { await invalidate(); toast({ title: 'Submission cancelled' }); }, onError: () => toast({ title: 'Could not cancel submission', variant: 'destructive' }) });
  };
  const respond = (id: number, interested: boolean) => respondToMatch.mutate({ id, data: { interested } }, {
    onSuccess: async (match) => {
      await invalidate();
      toast({
        title: match.contactReleased ? 'Both agents agreed' : interested ? 'Interest recorded' : 'Match declined',
        description: match.contactReleased
          ? 'The approved contact details are now available.'
          : interested
            ? 'Contact remains private until the other agent agrees.'
            : 'This match was declined.',
      });
    },
    onError: () => toast({ title: 'Could not update match', variant: 'destructive' }),
  });
  const shareListing = (recordId: number, enabled: boolean) => updateSharing.mutate({ id: recordId, data: { enabled } }, {
    onSuccess: async () => { await invalidate(); toast({ title: enabled ? 'Listing shared privately' : 'Listing removed from network' }); },
    onError: () => toast({ title: 'Could not update sharing', variant: 'destructive' }),
  });
  const pendingCount = submissions?.filter((item) => item.status === 'needs_review').length || 0;
  return <div className="min-h-[100dvh] bg-background">
    <PageHeader />
    <main className="mx-auto grid max-w-[1500px] gap-6 px-4 py-5 md:px-8 md:py-7 xl:grid-cols-[minmax(0,1.16fr)_minmax(380px,0.84fr)]">
      <div className="space-y-6">
        <ComposePanel onCreated={createDraft} busy={createSubmission.isPending} />
        <section aria-labelledby="submissions-title" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">Your review queue</p><h2 id="submissions-title" className="mt-1 text-xl font-extrabold tracking-tight">Previous submissions <span className="ml-1 font-mono text-sm font-medium text-muted-foreground">{submissions?.length ?? '—'}</span></h2></div>
            <Button data-testid="button-refresh-submissions" variant="ghost" size="sm" disabled={submissionsQuery.isFetching} onClick={() => void submissionsQuery.refetch()} className="gap-1.5"><RefreshCw className={cn('h-3.5 w-3.5', submissionsQuery.isFetching && 'animate-spin')} /> Refresh</Button>
          </div>
          {submissionsQuery.isLoading ? <div className="space-y-3" data-testid="loading-submissions">{[0, 1].map((n) => <div key={n} className="rounded-lg border bg-card p-5"><Skeleton className="h-5 w-1/3" /><Skeleton className="mt-4 h-16 w-full" /></div>)}</div>
            : submissionsQuery.isError ? <Alert variant="destructive" data-testid="error-submissions"><AlertTriangle className="h-4 w-4" /><AlertTitle>Submissions unavailable</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-2">We could not load your review queue. <Button variant="outline" size="sm" onClick={() => void submissionsQuery.refetch()}>Retry</Button></AlertDescription></Alert>
              : !submissions?.length ? <div className="rounded-lg border border-dashed border-border bg-card/60 px-6 py-10 text-center" data-testid="empty-submissions"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><MessageSquareText className="h-5 w-5" /></div><p className="mt-3 text-sm font-bold">Your submissions will appear here</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Paste a listing or buyer requirement above. Review each extracted item before it becomes a record.</p></div>
                : <div className="space-y-3">{pendingCount > 0 && <p className="text-[11px] font-semibold text-amber-800" data-testid="text-pending-review">{pendingCount} submission{pendingCount === 1 ? '' : 's'} awaiting review</p>}
                  {submissions.map((submission) => <SubmissionCard key={submission.id} submission={submission} onConfirm={confirmItem} onCancel={cancelDraft} onShare={shareListing} busy={isMutating} />)}
                </div>}
        </section>
      </div>
      <section aria-labelledby="matches-title" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">Private introductions</p><h2 id="matches-title" className="mt-1 text-xl font-extrabold tracking-tight">Network matches <span className="ml-1 font-mono text-sm font-medium text-muted-foreground">{matches?.length ?? '—'}</span></h2></div>
          <Button data-testid="button-refresh-matches" variant="ghost" size="sm" disabled={matchesQuery.isFetching} onClick={() => void matchesQuery.refetch()} className="gap-1.5"><RefreshCw className={cn('h-3.5 w-3.5', matchesQuery.isFetching && 'animate-spin')} /> Refresh</Button>
        </div>
        <div className="rounded-md border border-primary/15 bg-primary/[0.04] px-3 py-2.5 text-xs leading-5 text-muted-foreground"><LockKeyhole className="mr-1.5 inline h-3.5 w-3.5 text-primary" />Strong, potential and weak scores explain fit. Contact is disclosed only after mutual interest.</div>
        {matchesQuery.isLoading ? <div className="space-y-3" data-testid="loading-matches">{[0, 1].map((n) => <div key={n} className="rounded-lg border bg-card p-5"><Skeleton className="h-5 w-2/3" /><Skeleton className="mt-4 h-24 w-full" /></div>)}</div>
          : matchesQuery.isError ? <Alert variant="destructive" data-testid="error-matches"><AlertTriangle className="h-4 w-4" /><AlertTitle>Matches unavailable</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-2">We could not load private network matches. <Button variant="outline" size="sm" onClick={() => void matchesQuery.refetch()}>Retry</Button></AlertDescription></Alert>
            : !matches?.length ? <div className="rounded-lg border border-dashed border-border bg-card/60 px-6 py-10 text-center" data-testid="empty-matches"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><Handshake className="h-5 w-5" /></div><p className="mt-3 text-sm font-bold">No matches yet</p><p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Confirm a listing or buyer requirement to check for private network matches.</p></div>
              : <div className="space-y-3">{matches.map((match) => <MatchCard key={match.id} match={match} onRespond={respond} busy={respondToMatch.isPending} />)}</div>}
      </section>
      <div className="flex items-center gap-2 border-t border-border pt-3 text-[10px] leading-4 text-muted-foreground xl:col-span-2"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" />Development simulator only. No WhatsApp messages are sent or received. Every extracted item remains a draft until you confirm it.</div>
    </main>
  </div>;
}
