import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAdminAgentsQueryKey,
  getGetAgentPastSalesQueryKey,
  getGetPublicAgentQueryKey,
  getListPublicAgentsQueryKey,
  useCreateAgentPastSale,
  useDeleteAgentPastSale,
  useGetAgentPastSales,
  useUpdateAgentPastSale,
  type PublicSellingHistory,
} from '@workspace/api-client-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, Pencil, Trash2 } from 'lucide-react';

const CURRENCIES = ['USD', 'ZWG', 'ZAR', 'GBP', 'EUR'] as const;
type Currency = (typeof CURRENCIES)[number];

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({ title: '', suburb: '', city: '', currency: 'USD' as Currency, salePrice: '', soldAt: '' });

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function fmtDate(value?: string | null) {
  if (!value) return 'Date not shared';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Date not shared' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AgentPastSalesEditor({ agentId }: { agentId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const history = useGetAgentPastSales(agentId, {
    query: { queryKey: getGetAgentPastSalesQueryKey(agentId), enabled: !!agentId },
  });
  const createSale = useCreateAgentPastSale();
  const updateSale = useUpdateAgentPastSale();
  const deleteSale = useDeleteAgentPastSale();
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PublicSellingHistory | null>(null);
  const [formError, setFormError] = useState('');

  const saving = createSale.isPending || updateSale.isPending;
  const set = (key: keyof ReturnType<typeof emptyForm>, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetAgentPastSalesQueryKey(agentId) }),
      queryClient.invalidateQueries({ queryKey: getGetPublicAgentQueryKey(agentId) }),
      queryClient.invalidateQueries({ queryKey: getListPublicAgentsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetAdminAgentsQueryKey() }),
    ]);
  };

  const reset = () => {
    setForm(emptyForm());
    setEditingId(null);
    setFormError('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const price = Number(form.salePrice);
    if (!form.title.trim() || !form.suburb.trim() || !form.city.trim()) return setFormError('Description, suburb and city are required.');
    if (!Number.isFinite(price) || price <= 0) return setFormError('Sale price must be greater than zero.');
    if (!form.soldAt || form.soldAt > today()) return setFormError('Sale date must be today or earlier.');
    setFormError('');
    const data = { title: form.title.trim(), suburb: form.suburb.trim(), city: form.city.trim(), currency: form.currency, salePrice: price, soldAt: form.soldAt };
    try {
      if (editingId != null) await updateSale.mutateAsync({ id: agentId, saleId: editingId, data });
      else await createSale.mutateAsync({ id: agentId, data });
      toast({ title: editingId != null ? 'Sale updated' : 'Sale added' });
      reset();
      await refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save this sale. Please try again.');
    }
  };

  const edit = (sale: PublicSellingHistory) => {
    setEditingId(sale.id);
    setFormError('');
    setForm({
      title: sale.title,
      suburb: sale.suburb,
      city: sale.city,
      currency: (CURRENCIES.includes(sale.currency as Currency) ? sale.currency : 'USD') as Currency,
      salePrice: sale.salePrice != null ? String(sale.salePrice) : '',
      soldAt: (sale.soldAt ?? '').slice(0, 10),
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const sale = pendingDelete;
    try {
      await deleteSale.mutateAsync({ id: agentId, saleId: sale.id });
      toast({ title: 'Sale deleted' });
      if (editingId === sale.id) reset();
      setPendingDelete(null);
      await refresh();
    } catch (e) {
      setPendingDelete(null);
      toast({ title: 'Could not delete sale', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const sales = history.data?.sales ?? [];
  const medians = history.data?.medians ?? [];

  return (
    <div className="space-y-5" data-testid="past-sales-editor">
      <p className="text-xs text-muted-foreground">
        Sales recorded here are shown publicly on the agent's marketplace profile. Describe the property (for example, "3 bedroom house with pool") and do not enter a private street address.
      </p>

      <form onSubmit={submit} className="space-y-3 rounded-lg border bg-muted/20 p-4" data-testid="form-past-sale">
        <div className="text-sm font-semibold">{editingId != null ? 'Edit past sale' : 'Add a past sale'}</div>
        <div className="space-y-1.5">
          <Label htmlFor={`ps-title-${agentId}`}>Property description</Label>
          <Input id={`ps-title-${agentId}`} maxLength={200} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="4 bedroom family home" data-testid="input-sale-title" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`ps-suburb-${agentId}`}>Suburb</Label>
            <Input id={`ps-suburb-${agentId}`} maxLength={100} value={form.suburb} onChange={(e) => set('suburb', e.target.value)} data-testid="input-sale-suburb" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`ps-city-${agentId}`}>City</Label>
            <Input id={`ps-city-${agentId}`} maxLength={100} value={form.city} onChange={(e) => set('city', e.target.value)} data-testid="input-sale-city" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor={`ps-cur-${agentId}`}>Currency</Label>
            <select id={`ps-cur-${agentId}`} value={form.currency} onChange={(e) => set('currency', e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" data-testid="select-sale-currency">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`ps-price-${agentId}`}>Sale price</Label>
            <Input id={`ps-price-${agentId}`} type="number" min="0" step="any" inputMode="decimal" value={form.salePrice} onChange={(e) => set('salePrice', e.target.value)} data-testid="input-sale-price" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`ps-date-${agentId}`}>Sold on</Label>
            <Input id={`ps-date-${agentId}`} type="date" max={today()} value={form.soldAt} onChange={(e) => set('soldAt', e.target.value)} data-testid="input-sale-date" />
          </div>
        </div>
        {formError && <p className="text-sm text-destructive" role="alert" data-testid="text-sale-error">{formError}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={saving} data-testid="button-save-sale">
            {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : editingId != null ? 'Save changes' : 'Add sale'}
          </Button>
          {editingId != null && <Button type="button" size="sm" variant="outline" onClick={reset} disabled={saving} data-testid="button-cancel-sale-edit">Cancel</Button>}
        </div>
      </form>

      <div>
        <div className="mb-2 text-sm font-semibold">Median sale price</div>
        {history.isLoading ? <Skeleton className="h-8 w-48" /> : medians.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-no-medians">No sales yet, so no median to show.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {medians.map((m) => (
              <Badge key={m.currency} variant="secondary" className="text-sm font-medium" data-testid={`text-median-${m.currency}`}>
                {m.currency} {money(m.medianPrice, m.currency)} · {m.saleCount} {m.saleCount === 1 ? 'sale' : 'sales'}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold">Sales history</div>
        {history.isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : history.isError ? (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm" role="alert">
            Could not load sales history.
            <Button type="button" size="sm" variant="outline" className="ml-3" onClick={() => history.refetch()}>Retry</Button>
          </div>
        ) : sales.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="status-sales-empty">No past sales recorded yet.</div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {sales.map((sale) => {
              const manual = sale.source === 'past_sale';
              return (
                <li key={`${sale.source ?? 'listing'}-${sale.id}`} className="flex items-center justify-between gap-3 p-3" data-testid={`row-sale-${sale.source}-${sale.id}`}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{sale.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {sale.suburb}, {sale.city} · {fmtDate(sale.soldAt)} · {sale.salePrice != null ? money(sale.salePrice, sale.currency) : 'Price not shared'}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {manual ? (
                      <>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Edit sale" onClick={() => edit(sale)} data-testid={`button-edit-sale-${sale.id}`}><Pencil className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Delete sale" onClick={() => setPendingDelete(sale)} data-testid={`button-delete-sale-${sale.id}`}><Trash2 className="h-4 w-4" /></Button>
                      </>
                    ) : (
                      <Badge variant="outline" className="text-xs">From listing · edit via property</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open && !deleteSale.isPending) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this sale?</AlertDialogTitle>
            <AlertDialogDescription>"{pendingDelete?.title}" will be removed from the public profile and the median will be recalculated.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSale.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleteSale.isPending} onClick={(e) => { e.preventDefault(); void confirmDelete(); }} data-testid="button-confirm-delete-sale">
              {deleteSale.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
