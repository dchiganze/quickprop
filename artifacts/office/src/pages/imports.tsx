import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, ArrowLeft, ArrowUpDown, Bot, Check, CheckCircle2, ChevronRight, CircleHelp,
  CloudUpload, Download, FileArchive, FileSpreadsheet, FileText, Filter, GitMerge,
  Loader2, Play, RefreshCw, ScanText, Search, Send, ShieldCheck, SlidersHorizontal, Upload,
  UserRound, X, XCircle, Zap,
} from 'lucide-react';
import {
  askImportAssistant, getGetImportSessionQueryKey, getListImportSessionsQueryKey,
  getImportErrorReport, useBulkImportAction, useCreateImportSession, useGetImportSession,
  useListImportSessions, useProcessImportSession, usePublishImportSession,
  useUpdateImportRecord,
} from '@workspace/api-client-react';
import type { ImportRecord, ImportSession, ImportSessionDetail } from '@workspace/api-client-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type RouteProps = { params?: { id?: string } };
type DraftData = Record<string, unknown>;
type VisionFieldSource = { confidence?: number; evidence?: string; method?: string };
const mappingFields = ['title', 'reference', 'address', 'suburb', 'city', 'price', 'currency', 'propertyType', 'bedrooms', 'bathrooms', 'description', 'agent', 'mandateType', 'mandateStart', 'mandateExpiry'] as const;

const toRecord = (value: unknown): DraftData => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as DraftData : {}
);
const numberValue = (value: unknown) => typeof value === 'number' ? value : Number(value || 0);
const money = (value: unknown) => numberValue(value) ? `$${numberValue(value).toLocaleString()}` : '—';
const titleCase = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatDate = (value?: string) => value ? new Date(value).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const isProcessing = (session?: ImportSession | null) => !!session && ['queued', 'processing', 'extracting', 'matching'].includes(session.status);

function StatusPill({ value }: { value: string }) {
  const tone = value === 'approved' || value === 'published' || value === 'ready'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : value === 'rejected' || value === 'failed'
      ? 'border-red-200 bg-red-50 text-red-700'
      : value === 'needs_review' || value === 'review'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-slate-200 bg-slate-50 text-slate-600';
  return <span className={cn('inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]', tone)}>{titleCase(value || 'pending')}</span>;
}

function Confidence({ score, compact = false }: { score: number; compact?: boolean }) {
  const percent = Math.round(score <= 1 ? score * 100 : score);
  const tone = percent >= 85 ? 'text-emerald-700 bg-emerald-50' : percent >= 65 ? 'text-amber-800 bg-amber-50' : 'text-red-700 bg-red-50';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-bold tabular-nums', tone)} title="AI extraction confidence. Review before publishing.">
      <span className={cn('h-1.5 w-1.5 rounded-full', percent >= 85 ? 'bg-emerald-500' : percent >= 65 ? 'bg-amber-500' : 'bg-red-500')} />
      {percent}%{!compact && <span className="font-medium opacity-70">confidence</span>}
    </span>
  );
}

function ImportHeader({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden border-b border-border bg-card px-6 py-7 md:px-9">
      <div className="pointer-events-none absolute right-0 top-0 h-full w-2/5 opacity-50 ledger-grid [mask-image:linear-gradient(to_left,black,transparent)]" />
      <div className="relative mx-auto flex max-w-[1640px] items-end justify-between gap-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.17em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {eyebrow}
          </div>
          <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-foreground md:text-[2.35rem]">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function NewImportDialog({ onCreated }: { onCreated: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createSession = useCreateImportSession();

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const accepted = Array.from(incoming).filter((file) => /\.(csv|xlsx|xls|pdf|docx|txt|jpg|jpeg|png)$/i.test(file.name));
    setFiles((current) => [...current, ...accepted.filter((file) => !current.some((existing) => existing.name === file.name && existing.size === file.size))]);
  };

  const create = async () => {
    if (!files.length) return;
    setUploading(true);
    setUploadError('');
    try {
      const uploaded = [];
      for (const file of files) {
        const request = await fetch('/api/storage/uploads/request-url', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' }),
        });
        if (!request.ok) throw new Error(`Could not prepare ${file.name} for upload.`);
        const target = await request.json() as { uploadURL: string; objectPath: string };
        const upload = await fetch(target.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
        if (!upload.ok) throw new Error(`Could not upload ${file.name}.`);
        uploaded.push({ fileName: file.name, fileType: file.type || 'application/octet-stream', sizeBytes: file.size, storagePath: target.objectPath });
      }
      const created = await createSession.mutateAsync({ data: { files: uploaded } });
      queryClient.invalidateQueries({ queryKey: getListImportSessionsQueryKey() });
      toast({ title: 'Import session created', description: `${files.length} source file${files.length === 1 ? '' : 's'} ready for processing.` });
      setFiles([]);
      setOpen(false);
      onCreated(created.id);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed. Nothing was created.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setUploadError(''); }}>
      <Button onClick={() => setOpen(true)} className="h-10 gap-2 bg-primary px-4 font-bold shadow-sm">
        <CloudUpload className="h-4 w-4" /> New import
      </Button>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl tracking-tight">Start a portfolio import</DialogTitle>
          <p className="text-sm text-muted-foreground">Upload the agency files first. QuickProp will create a reviewable draft, never a published listing.</p>
        </DialogHeader>
        <div
          className="cursor-pointer rounded-lg border-2 border-dashed border-primary/25 bg-primary/[0.035] px-6 py-9 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.06]"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}
        >
          <Upload className="mx-auto mb-3 h-8 w-8 text-primary" />
          <p className="text-sm font-bold">Drop spreadsheets, documents, text or listing images here</p>
          <p className="mt-1 text-xs text-muted-foreground">Multiple files supported · 25 MB per file</p>
          <input ref={inputRef} type="file" multiple accept=".csv,.xlsx,.xls,.pdf,.docx,.txt,.jpg,.jpeg,.png" className="hidden" onChange={(event) => addFiles(event.target.files)} />
        </div>
        {files.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Selected sources · {files.length}</Label>
            {files.map((file) => (
              <div key={`${file.name}-${file.size}`} className="flex items-center gap-3 rounded border bg-muted/35 px-3 py-2">
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                <button aria-label={`Remove ${file.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => setFiles((current) => current.filter((item) => item !== file))}><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
        {uploadError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Import not created</AlertTitle><AlertDescription>{uploadError}</AlertDescription></Alert>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={create} disabled={!files.length || uploading} className="gap-2">
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading sources...</> : <>Create review draft <ChevronRight className="h-4 w-4" /></>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SessionRow({ session }: { session: ImportSession }) {
  return (
    <Link href={`/imports/${session.id}`} className="group grid grid-cols-[minmax(190px,1.5fr)_110px_110px_130px_150px_26px] items-center gap-4 border-b border-border/80 px-5 py-4 transition-colors hover:bg-primary/[0.035]">
      <div className="min-w-0">
        <div className="flex items-center gap-2"><span className="font-mono text-sm font-bold text-foreground">{session.reference}</span><StatusPill value={session.status} /></div>
        <p className="mt-1 text-xs text-muted-foreground">Created {formatDate(session.createdAt)} · {session.currentStage ? titleCase(session.currentStage) : 'Awaiting start'}</p>
      </div>
      <div className="text-sm font-semibold tabular-nums">{session.totalFiles}<span className="ml-1 text-xs font-normal text-muted-foreground">files</span></div>
      <div className="text-sm font-semibold tabular-nums">{session.totalRecords}<span className="ml-1 text-xs font-normal text-muted-foreground">rows</span></div>
      <div><div className="mb-1 text-xs font-bold text-foreground">{session.recordsReady} ready</div><Progress value={session.totalRecords ? (session.recordsReady / session.totalRecords) * 100 : 0} className="h-1.5" /></div>
      <div className="text-xs text-muted-foreground"><span className="font-semibold text-amber-700">{session.recordsNeedingReview} review</span><span className="mx-1.5 text-border">·</span><span className="font-semibold text-red-700">{session.recordsDuplicate} dupes</span></div>
      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

function ImportsList() {
  const [, setLocation] = useLocation();
  const { data: sessions, isLoading, error, refetch } = useListImportSessions();
  const sorted = useMemo(() => [...(sessions || [])].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [sessions]);
  return (
    <div className="min-h-full bg-background">
      <ImportHeader eyebrow="Operations / Data intake" title="Bulk mandate imports" description="Turn agency portfolios into accountable review drafts. Nothing reaches the marketplace until an Office user approves it.">
        <NewImportDialog onCreated={(id) => setLocation(`/imports/${id}`)} />
      </ImportHeader>
      <div className="mx-auto max-w-[1640px] space-y-6 p-6 md:p-9">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[['Active sessions', sessions?.filter((item) => !['published', 'failed'].includes(item.status)).length || 0, 'work in motion', 'text-primary'], ['Records in review', sessions?.reduce((sum, item) => sum + item.recordsNeedingReview, 0) || 0, 'need a decision', 'text-amber-700'], ['Duplicate matches', sessions?.reduce((sum, item) => sum + item.recordsDuplicate, 0) || 0, 'need provenance', 'text-red-700'], ['Published this month', sessions?.reduce((sum, item) => sum + item.recordsPublished, 0) || 0, 'human-approved', 'text-slate-700']].map(([label, value, detail, tone]) => (
            <Card key={label as string} className="border-border/80 shadow-none"><CardContent className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">{label}</p><p className={cn('mt-2 text-2xl font-extrabold tracking-tight', tone as string)}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>
          ))}
        </div>
        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Could not load import sessions</AlertTitle><AlertDescription className="flex items-center justify-between gap-4">The operations feed did not respond. <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></AlertDescription></Alert>}
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-card/70 px-5 py-4">
            <div><CardTitle className="text-base">Import queue</CardTitle><p className="mt-1 text-xs text-muted-foreground">Most recently touched sessions first</p></div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          </CardHeader>
          <div className="hidden grid-cols-[minmax(190px,1.5fr)_110px_110px_130px_150px_26px] gap-4 border-b bg-muted/35 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground md:grid"><span>Session</span><span>Sources</span><span>Records</span><span>Readiness</span><span>Attention</span><span /></div>
          {isLoading ? <div className="space-y-4 p-5">{[1, 2, 3].map((item) => <div key={item} className="flex gap-4"><Skeleton className="h-11 flex-1" /><Skeleton className="h-11 w-28" /><Skeleton className="h-11 w-28" /></div>)}</div>
            : sorted.length ? <div>{sorted.map((session) => <SessionRow key={session.id} session={session} />)}</div>
            : <div className="px-6 py-20 text-center"><FileArchive className="mx-auto mb-4 h-10 w-10 text-primary/40" /><h3 className="font-bold">No import sessions yet</h3><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Upload an agency portfolio to create your first reviewable draft. The original sources stay attached to every row.</p></div>}
        </Card>
      </div>
    </div>
  );
}

function DataField({ label, value, onChange, numeric = false }: { label: string; value: unknown; onChange: (value: string) => void; numeric?: boolean }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span><Input value={value == null ? '' : String(value)} type={numeric ? 'number' : 'text'} onChange={(event) => onChange(event.target.value)} className="h-8 bg-background text-xs" /></label>;
}

function MatchPanel({ record }: { record: ImportRecord }) {
  const match = toRecord(record.match);
  if (!Object.keys(match).length && record.duplicateStatus === 'none') return null;
  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/70 p-3">
      <div className="flex items-center gap-2 text-xs font-bold text-amber-900"><GitMerge className="h-3.5 w-3.5" /> Possible duplicate match <span className="ml-auto font-mono">{match.reference ? String(match.reference) : record.matchedPropertyId ? `Property #${record.matchedPropertyId}` : 'Needs review'}</span></div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-amber-900/75"><span>Candidate: <b>{String(match.title || 'Existing property')}</b></span><span>Match status: <b>{titleCase(record.duplicateStatus)}</b></span><span>Address: <b>{String(match.address || match.suburb || 'Not available')}</b></span><span>Source row: <b>{record.sourceLocation || 'Not supplied'}</b></span></div>
    </div>
  );
}

function RecordRow({ record, selected, onToggle, draft, setDraft, onSave, saving }: { record: ImportRecord; selected: boolean; onToggle: () => void; draft: DraftData; setDraft: (data: DraftData) => void; onSave: () => void; saving: boolean }) {
  const field = (key: string) => draft[key];
  const update = (key: string, value: string, numeric = false) => setDraft({ ...draft, [key]: numeric && value !== '' ? Number(value) : value });
  const sourceMetadata = toRecord(record.sourceMetadata);
  const visionSources = toRecord(sourceMetadata.fieldSources) as Record<string, VisionFieldSource>;
  const reviewFlags = Array.isArray(sourceMetadata.reviewFlags) ? sourceMetadata.reviewFlags.map(String).filter(Boolean) : [];
  const isVision = sourceMetadata.extractionMethod === 'gemini-vision';
  return (
    <div className={cn('border-b border-border/80 px-4 py-4 transition-colors', selected && 'bg-primary/[0.035]')}>
      <div className="grid grid-cols-[24px_minmax(160px,1.25fr)_minmax(150px,1fr)_100px_80px_96px_128px] items-end gap-3">
        <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select record ${record.id}`} />
        <DataField label="Title" value={field('title') || field('name')} onChange={(value) => update('title', value)} />
        <DataField label="Address / suburb" value={field('address') || field('suburb')} onChange={(value) => update(field('address') ? 'address' : 'suburb', value)} />
        <DataField label="Price" value={field('price')} numeric onChange={(value) => update('price', value, true)} />
        <DataField label="Beds" value={field('bedrooms')} numeric onChange={(value) => update('bedrooms', value, true)} />
        <div><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Confidence</span><Confidence score={record.confidenceScore} compact /></div>
        <div className="flex items-center justify-end gap-1.5"><StatusPill value={record.reviewStatus} /><Button size="sm" variant="outline" className="h-8 px-2 text-[11px]" onClick={onSave} disabled={saving}>{saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}<span className="sr-only">Save row</span></Button></div>
      </div>
      <div className="mt-3 flex items-center gap-3 pl-9 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1">{isVision ? <ScanText className="h-3 w-3 text-primary" /> : <FileText className="h-3 w-3" />} {record.sourceFileName || `Source file #${record.sourceFileId}`}</span><span className="text-border">/</span><span>Source location {record.sourceLocation || 'not supplied'}</span>{isVision && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">Vision extracted</span>}{record.validationIssues.length > 0 && <span className="inline-flex items-center gap-1 font-semibold text-red-700"><AlertCircle className="h-3 w-3" /> {record.validationIssues.length} validation issue{record.validationIssues.length === 1 ? '' : 's'}</span>}<span className="ml-auto font-mono text-[10px] text-muted-foreground/70">record:{record.id}</span></div>
      {isVision && (
        <div className="ml-9 mt-2 rounded-md border border-primary/15 bg-primary/[0.025] p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(record.fieldConfidence).map(([fieldName, score]) => {
              const source = visionSources[fieldName];
              return (
                <span
                  key={fieldName}
                  title={`${source?.evidence || 'Read from uploaded image'} · ${record.sourceFileName || `source #${record.sourceFileId}`} · ${record.sourceLocation || 'image'}`}
                  className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold', score >= 70 ? 'border-slate-200 bg-white text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-800')}
                >
                  {titleCase(fieldName)} {Math.round(score)}%
                </span>
              );
            })}
          </div>
          {reviewFlags.length > 0 && <p className="mt-2 flex items-start gap-1.5 text-[10px] font-medium text-amber-800"><AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> {reviewFlags.join(' · ')}</p>}
        </div>
      )}
      <div className="pl-9"><MatchPanel record={record} /></div>
    </div>
  );
}

function Assistant({ sessionId }: { sessionId: number }) {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<{ prompt: string; message: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt.trim() || busy) return;
    const next = prompt.trim();
    setPrompt('');
    setBusy(true);
    try {
      const answer = await askImportAssistant({ sessionId, prompt: next });
      setMessages((current) => [...current, { prompt: next, message: answer.message }]);
    } catch {
      setMessages((current) => [...current, { prompt: next, message: 'The assistant could not answer right now. Continue with the source evidence and retry shortly.' }]);
    } finally { setBusy(false); }
  };
  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader className="border-b bg-slate-50/80 px-4 py-3"><CardTitle className="flex items-center gap-2 text-sm"><Bot className="h-4 w-4 text-primary" /> Import assistant <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">Draft only</span></CardTitle></CardHeader>
      <CardContent className="p-4">
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">Ask about mappings, duplicate evidence or a correction. It can advise, but cannot approve or publish.</p>
        {messages.length > 0 && <div className="mb-3 max-h-40 space-y-2 overflow-auto">{messages.slice(-3).map((item, index) => <div key={`${item.prompt}-${index}`} className="space-y-1 text-xs"><p className="font-semibold text-foreground">“{item.prompt}”</p><p className="rounded border bg-muted/40 p-2 leading-relaxed text-muted-foreground">{item.message}</p></div>)}</div>}
        <form onSubmit={submit} className="flex gap-2"><Input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask about this import..." className="h-9 text-xs" /><Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!prompt.trim() || busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}</Button></form>
      </CardContent>
    </Card>
  );
}

function ImportDetail({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'confidence' | 'source'>('confidence');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<Record<number, DraftData>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [agentId, setAgentId] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [mappingOpen, setMappingOpen] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const { data: detail, isLoading, error, refetch } = useGetImportSession(id, { query: { queryKey: getGetImportSessionQueryKey(id), refetchInterval: (query) => isProcessing(query.state.data) ? 1800 : false } });
  const processSession = useProcessImportSession();
  const updateRecord = useUpdateImportRecord();
  const bulkAction = useBulkImportAction();
  const publishSession = usePublishImportSession();

  useEffect(() => {
    if (detail?.records) setDrafts((current) => {
      const next = { ...current };
      detail.records.forEach((record) => { if (!next[record.id]) next[record.id] = { ...toRecord(record.data) }; });
      return next;
    });
  }, [detail?.records]);

  useEffect(() => {
    if (detail?.columnMapping) setColumnMapping(detail.columnMapping);
  }, [detail?.columnMapping]);

  const records = useMemo(() => {
    const result = (detail?.records || []).filter((record) => {
      const data = toRecord(record.data);
      const haystack = `${data.title || ''} ${data.address || ''} ${data.suburb || ''} ${record.sourceFileName || ''}`.toLowerCase();
      const filterMatch = filter === 'all' || (filter === 'duplicates' ? ['possible', 'link_existing'].includes(record.duplicateStatus) : filter === 'review' ? ['draft', 'needs_review', 'review', 'pending'].includes(record.reviewStatus) : filter === record.reviewStatus);
      return filterMatch && haystack.includes(search.toLowerCase());
    }).sort((a, b) => sort === 'confidence' ? b.confidenceScore - a.confidenceScore : (a.sourceFileName || '').localeCompare(b.sourceFileName || ''));
    return result;
  }, [detail?.records, filter, search, sort]);

  const patchDetail = (next: ImportSessionDetail) => queryClient.setQueryData(getGetImportSessionQueryKey(id), next);
  const toggle = (recordId: number) => setSelected((current) => { const next = new Set(current); next.has(recordId) ? next.delete(recordId) : next.add(recordId); return next; });
  const selectAll = () => setSelected(selected.size === records.length ? new Set() : new Set(records.map((record) => record.id)));
  const saveRecord = async (record: ImportRecord) => {
    setSavingId(record.id);
    try {
      const updated = await updateRecord.mutateAsync({ id, recordId: record.id, data: { data: drafts[record.id] || toRecord(record.data) } });
      if (detail) patchDetail({ ...detail, records: detail.records.map((item) => item.id === record.id ? updated : item) });
      toast({ title: 'Draft row saved', description: `Record ${record.id} remains unpublished.` });
    } catch { toast({ title: 'Could not save row', description: 'The server rejected this correction. Your draft remains on screen.', variant: 'destructive' }); }
    finally { setSavingId(null); }
  };
  const runBulk = async (action: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (action === 'assign' && (!agentId || Number(agentId) < 1)) { toast({ title: 'Agent ID required', description: 'Enter the Office agent ID before assigning.', variant: 'destructive' }); return; }
    setActionBusy(true);
    try {
      const next = await bulkAction.mutateAsync({ id, data: { recordIds: ids, action, agentId: action === 'assign' ? Number(agentId) : undefined } });
      patchDetail(next);
      queryClient.invalidateQueries({ queryKey: getListImportSessionsQueryKey() });
      setSelected(new Set());
      toast({ title: `${titleCase(action)} applied`, description: `${ids.length} draft row${ids.length === 1 ? '' : 's'} updated.` });
    } catch { toast({ title: 'Bulk action failed', description: 'No records were changed. Check the session and retry.', variant: 'destructive' }); }
    finally { setActionBusy(false); }
  };
  const startProcessing = async () => {
    try { await processSession.mutateAsync({ id, data: { columnMapping } }); setMappingOpen(false); queryClient.invalidateQueries({ queryKey: getListImportSessionsQueryKey() }); await refetch(); toast({ title: 'Processing started', description: 'Text, spreadsheet and image vision extraction are running in the background.' }); }
    catch { toast({ title: 'Processing failed to start', description: 'The source files were not processed. Nothing was published.', variant: 'destructive' }); }
  };
  const publish = async () => {
    const approved = (detail?.records || []).filter((record) => record.reviewStatus === 'approved').map((record) => record.id);
    if (!approved.length || !window.confirm(`Publish ${approved.length} approved record${approved.length === 1 ? '' : 's'}? Only these human-approved rows will be sent to the marketplace.`)) return;
    setPublishError('');
    try {
      const result = await publishSession.mutateAsync({ id, data: { recordIds: approved } });
      queryClient.invalidateQueries({ queryKey: getListImportSessionsQueryKey() });
      await refetch();
      if (result.failed) setPublishError(`${result.failed} record${result.failed === 1 ? '' : 's'} failed during publish. ${result.errors.join(' ')}`);
      toast({ title: result.failed ? 'Publish completed with failures' : 'Publish complete', description: `${result.created} created, ${result.linked} linked, ${result.failed} failed.` , variant: result.failed ? 'destructive' : 'default' });
    } catch { setPublishError('Publish was rejected by the server. No assumption was made about which records were published. Refresh the session before retrying.'); }
  };
  const downloadErrors = async () => {
    try {
      const csv = await getImportErrorReport(id);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `${detail?.reference || 'import'}-errors.csv`; link.click(); URL.revokeObjectURL(url);
    } catch { toast({ title: 'Could not download error report', description: 'The report endpoint did not respond.', variant: 'destructive' }); }
  };

  if (isLoading) return <div className="space-y-5 p-8"><Skeleton className="h-28 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-72 w-full" /></div>;
  if (error || !detail) return <div className="p-8"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Import session unavailable</AlertTitle><AlertDescription className="flex items-center justify-between">This session could not be loaded. <Button variant="outline" onClick={() => refetch()}>Retry</Button></AlertDescription></Alert></div>;

  const approvedCount = detail.records.filter((record) => record.reviewStatus === 'approved').length;
  const failedSourceCount = detail.files.filter((file) => file.processingStatus === 'failed').length;
  const processing = isProcessing(detail);
  return (
    <div className="min-h-full bg-background">
      <div className="border-b border-border bg-card px-6 py-4 md:px-8">
        <div className="mx-auto flex max-w-[1740px] items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/imports')} aria-label="Back to imports"><ArrowLeft className="h-4 w-4" /></Button>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold">{detail.reference}</span><StatusPill value={detail.status} />{processing && <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {titleCase(detail.currentStage || 'processing')}</span>}</div><p className="mt-1 text-xs text-muted-foreground">{detail.totalFiles} sources · last updated {formatDate(detail.updatedAt)} · AI suggestions are draft only</p></div>
          <Button variant="outline" size="sm" onClick={() => setMappingOpen(true)} className="hidden gap-2 sm:flex"><SlidersHorizontal className="h-3.5 w-3.5" /> Column mapping</Button>
          <Button variant="outline" size="sm" onClick={downloadErrors} className="hidden gap-2 sm:flex"><Download className="h-3.5 w-3.5" /> Error report</Button>
          {processing ? <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Poll now</Button> : <Button size="sm" onClick={startProcessing} disabled={processSession.isPending || detail.status === 'published'} className="gap-2">{processSession.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : failedSourceCount ? <RefreshCw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{failedSourceCount ? `Retry ${failedSourceCount} failed source${failedSourceCount === 1 ? '' : 's'}` : detail.totalRecords ? 'Re-run processing' : 'Process sources'}</Button>}
        </div>
         <div className="mt-4 flex items-center gap-3 rounded border border-primary/15 bg-primary/[0.035] px-3 py-2.5">
           <div className="min-w-0 flex-1">
             <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
               <span>Durable processing checkpoint</span>
               <span className="tabular-nums text-primary">{detail.progress}%</span>
             </div>
             <Progress value={detail.progress} className="h-1.5" />
           </div>
           <div className="hidden text-right text-[10px] leading-relaxed text-muted-foreground sm:block">
             <div>{titleCase(detail.currentStage || 'awaiting start')}</div>
             <div>{detail.processingHeartbeatAt ? `Checkpointed ${formatDate(detail.processingHeartbeatAt)}` : 'Not started'}</div>
           </div>
         </div>
      </div>
      <div className="mx-auto grid max-w-[1740px] grid-cols-1 gap-6 p-5 md:p-8 xl:grid-cols-[minmax(0,1fr)_292px]">
        <main className="min-w-0 space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[['Sources', detail.totalFiles, 'Files received', 'text-foreground'], ['Extracted', detail.totalRecords, 'Candidate rows', 'text-foreground'], ['Ready', detail.recordsReady, 'High confidence', 'text-emerald-700'], ['Review', detail.recordsNeedingReview, 'Human decision', 'text-amber-700'], ['Published', detail.recordsPublished, 'Marketplace records', 'text-primary']].map(([label, value, detailText, tone]) => <Card key={label as string} className="border-border/80 shadow-none"><CardContent className="p-3.5"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className={cn('mt-1 text-xl font-extrabold tabular-nums', tone as string)}>{value}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{detailText}</p></CardContent></Card>)}
          </div>
          {detail.lastError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Processing reported an error</AlertTitle><AlertDescription>{detail.lastError}</AlertDescription></Alert>}
          {publishError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Publish needs attention</AlertTitle><AlertDescription>{publishError}</AlertDescription></Alert>}
          <Card className="overflow-hidden border-border/80 shadow-sm">
            <CardHeader className="gap-4 border-b bg-card px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div><CardTitle className="text-base">Review ledger</CardTitle><p className="mt-1 text-xs text-muted-foreground">Edit extracted values, verify provenance, then apply a decision.</p></div>
              <div className="flex flex-wrap items-center gap-2"><div className="relative"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find title or source" className="h-8 w-44 pl-8 text-xs" /></div><Select value={filter} onValueChange={setFilter}><SelectTrigger className="h-8 w-[130px] text-xs"><Filter className="mr-1.5 h-3.5 w-3.5" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All rows</SelectItem><SelectItem value="review">Needs review</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem><SelectItem value="duplicates">Duplicates</SelectItem></SelectContent></Select><Select value={sort} onValueChange={(value) => setSort(value as 'confidence' | 'source')}><SelectTrigger className="h-8 w-[126px] text-xs"><ArrowUpDown className="mr-1.5 h-3.5 w-3.5" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="confidence">Confidence</SelectItem><SelectItem value="source">Source file</SelectItem></SelectContent></Select></div>
            </CardHeader>
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2.5"><Checkbox checked={records.length > 0 && selected.size === records.length} onCheckedChange={selectAll} aria-label="Select all visible records" /><span className="text-xs font-semibold">{selected.size} selected</span><span className="mx-1 h-4 border-l border-border" /><Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" disabled={!selected.size || actionBusy} onClick={() => runBulk('approve')}><CheckCircle2 className="h-3 w-3 text-emerald-600" /> Approve</Button><Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" disabled={!selected.size || actionBusy} onClick={() => runBulk('reject')}><XCircle className="h-3 w-3 text-red-600" /> Reject</Button><Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" disabled={!selected.size || actionBusy} onClick={() => runBulk('link_duplicate')}><GitMerge className="h-3 w-3 text-amber-600" /> Link match</Button><Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" disabled={!selected.size || actionBusy} onClick={() => runBulk('clear_duplicate')}><Check className="h-3 w-3 text-primary" /> Keep separate</Button><div className="ml-auto flex items-center gap-1.5"><Input value={agentId} onChange={(event) => setAgentId(event.target.value)} placeholder="Agent ID" type="number" className="h-7 w-20 text-[11px]" /><Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" disabled={!selected.size || actionBusy} onClick={() => runBulk('assign')}><UserRound className="h-3 w-3" /> Assign</Button></div></div>
            <div className="hidden grid-cols-[24px_minmax(160px,1.25fr)_minmax(150px,1fr)_100px_80px_96px_128px] gap-3 bg-slate-50/70 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground md:grid"><span /><span>Property identity</span><span>Location</span><span>Price</span><span>Beds</span><span>AI signal</span><span>Decision</span></div>
            {records.length ? records.map((record) => <RecordRow key={record.id} record={record} selected={selected.has(record.id)} onToggle={() => toggle(record.id)} draft={drafts[record.id] || toRecord(record.data)} setDraft={(data) => setDrafts((current) => ({ ...current, [record.id]: data }))} onSave={() => saveRecord(record)} saving={savingId === record.id} />) : <div className="px-6 py-20 text-center"><SlidersHorizontal className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" /><p className="text-sm font-semibold">No rows match this view</p><p className="mt-1 text-xs text-muted-foreground">Try clearing the search or changing the review filter.</p></div>}
          </Card>
          <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/[0.035] p-4 md:flex-row md:items-center"><ShieldCheck className="h-6 w-6 shrink-0 text-primary" /><div className="flex-1"><p className="text-sm font-bold">Publishing is a deliberate hand-off</p><p className="mt-0.5 text-xs text-muted-foreground">{approvedCount} approved row{approvedCount === 1 ? '' : 's'} will be published. Rejected, unresolved and unreviewed records stay in this session.</p></div><Button onClick={publish} disabled={!approvedCount || publishSession.isPending || processing} className="gap-2">{publishSession.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Publish approved only</Button></div>
        </main>
        <aside className="space-y-5">
          <Card className="border-border/80 shadow-none"><CardHeader className="border-b px-4 py-3"><CardTitle className="flex items-center gap-2 text-sm"><FileArchive className="h-4 w-4 text-primary" /> Source traceability</CardTitle></CardHeader><CardContent className="space-y-3 p-4">{detail.files.map((file) => { const imageSource = /\.(jpg|jpeg|png)$/i.test(file.fileName); return <div key={file.id} className="rounded border bg-muted/25 p-3"><div className="flex items-start gap-2">{imageSource ? <ScanText className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}<div className="min-w-0"><p className="truncate text-xs font-bold">{file.fileName}</p><p className="mt-1 text-[10px] text-muted-foreground">{file.extractedRecordCount} extracted candidate{file.extractedRecordCount === 1 ? '' : 's'} · {(file.sizeBytes / 1024 / 1024).toFixed(1)} MB{imageSource ? ' · Vision OCR' : ''}</p></div></div><div className="mt-2 flex items-center justify-between"><StatusPill value={file.processingStatus} /><span className="font-mono text-[10px] text-muted-foreground">#{file.id} · attempt {file.processingAttempt}</span></div>{file.error && <p className="mt-2 text-[10px] text-red-700">{file.error} Use the retry action above to process this source again.</p>}</div>; })}</CardContent></Card>
          <Assistant sessionId={id} />
          <Card className="border-amber-200 bg-amber-50/60 shadow-none"><CardContent className="p-4"><div className="flex items-start gap-2"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><div><p className="text-xs font-bold text-amber-900">Review standard</p><p className="mt-1 text-[11px] leading-relaxed text-amber-900/75">Confidence is a sorting aid, not approval. Check the original file location and duplicate evidence for every row you publish.</p></div></div></CardContent></Card>
          <Button variant="outline" onClick={downloadErrors} className="w-full gap-2 sm:hidden"><Download className="h-3.5 w-3.5" /> Download error report</Button>
        </aside>
      </div>
      <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Column mapping</DialogTitle>
            <p className="text-sm text-muted-foreground">Enter the exact source heading for any field that QuickProp did not recognise. Reprocessing updates extraction while preserving human corrections.</p>
          </DialogHeader>
          <div className="grid max-h-[55vh] grid-cols-1 gap-x-5 gap-y-3 overflow-y-auto py-2 sm:grid-cols-2">
            {mappingFields.map((field) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={`mapping-${field}`} className="text-xs">{titleCase(field)}</Label>
                <Input id={`mapping-${field}`} value={columnMapping[field] || ''} onChange={(event) => setColumnMapping((current) => ({ ...current, [field]: event.target.value }))} placeholder="Source column heading" />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingOpen(false)}>Cancel</Button>
            <Button onClick={startProcessing} disabled={processSession.isPending}>{processSession.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save mapping and process</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Imports({ params }: RouteProps) {
  const id = params?.id ? Number(params.id) : null;
  return id ? <ImportDetail id={id} /> : <ImportsList />;
}