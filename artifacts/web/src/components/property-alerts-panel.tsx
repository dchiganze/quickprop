import {
  getListPropertyAlertsQueryKey,
  useCreatePropertyAlert,
  useDeletePropertyAlert,
  useListPropertyAlerts,
  useUpdatePropertyAlert,
  useUpdatePropertyAlertStatus,
} from "@workspace/api-client-react";
import type { PropertyAlert, PropertyAlertInput, PropertyAlertUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  Edit3,
  Mail,
  MapPin,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/utils";

const residentialTypes = ["house", "apartment", "townhouse", "cluster", "cottage", "land"];
const commercialTypes = ["commercial", "office", "retail", "warehouse"];
const amenityOptions = ["Swimming pool", "Borehole", "Solar", "Backup power", "Garage", "Secure parking", "Garden", "Fibre internet", "Pet friendly", "Furnished"];

type FormState = {
  transactionType: "sale" | "rent";
  propertyTypes: string[];
  cities: string;
  suburbs: string;
  minPrice: string;
  maxPrice: string;
  minBedrooms: string;
  minBathrooms: string;
  requiredAmenities: string[];
  preferredAmenities: string[];
  notificationFrequency: "immediately" | "daily" | "weekly";
  emailEnabled: boolean;
  name: string;
};

const emptyForm: FormState = {
  transactionType: "rent",
  propertyTypes: ["house"],
  cities: "",
  suburbs: "",
  minPrice: "",
  maxPrice: "",
  minBedrooms: "any",
  minBathrooms: "any",
  requiredAmenities: [],
  preferredAmenities: [],
  notificationFrequency: "immediately",
  emailEnabled: true,
  name: "",
};

function listFromText(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function displayName(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formFromAlert(alert: PropertyAlert): FormState {
  return {
    transactionType: alert.transactionType,
    propertyTypes: alert.propertyTypes,
    cities: alert.cities.join(", "),
    suburbs: alert.suburbs.join(", "),
    minPrice: alert.minPrice == null ? "" : String(alert.minPrice),
    maxPrice: alert.maxPrice == null ? "" : String(alert.maxPrice),
    minBedrooms: alert.minBedrooms == null ? "any" : String(alert.minBedrooms),
    minBathrooms: alert.minBathrooms == null ? "any" : String(alert.minBathrooms),
    requiredAmenities: alert.requiredAmenities,
    preferredAmenities: alert.preferredAmenities,
    notificationFrequency: alert.notificationFrequency,
    emailEnabled: alert.notificationChannels.includes("email"),
    name: alert.name,
  };
}

function alertSummary(alert: PropertyAlert) {
  const budget = alert.minPrice != null || alert.maxPrice != null
    ? `${alert.minPrice != null ? formatPrice(alert.minPrice) : "Any"} – ${alert.maxPrice != null ? formatPrice(alert.maxPrice) : "Any"}`
    : "Any budget";
  const location = alert.suburbs.length
    ? alert.suburbs.join(", ")
    : alert.cities.length
      ? `Any location in ${alert.cities.join(", ")}`
      : "Any location";
  const beds = alert.minBedrooms == null ? "Any bedrooms" : `${alert.minBedrooms}+ bedrooms`;
  return { budget, location, beds };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-sm font-semibold text-foreground">{children}</Label>;
}

function ChoiceChip({ selected, children, onClick }: { selected: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function AlertForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  pending,
  editing,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  pending: boolean;
  editing: boolean;
}) {
  const types = [...residentialTypes, ...commercialTypes];
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const toggleType = (type: string) => update("propertyTypes", form.propertyTypes.includes(type)
    ? form.propertyTypes.filter((item) => item !== type)
    : [...form.propertyTypes, type]);
  const toggleAmenity = (kind: "requiredAmenities" | "preferredAmenities", amenity: string) => {
    const other = kind === "requiredAmenities" ? "preferredAmenities" : "requiredAmenities";
    const next = form[kind].includes(amenity)
      ? form[kind].filter((item) => item !== amenity)
      : [...form[kind], amenity];
    update(kind, next);
    if (form[other].includes(amenity)) update(other, form[other].filter((item) => item !== amenity));
  };

  return (
    <form data-testid="form-property-alert" onSubmit={onSubmit} className="space-y-6">
      <div>
        <FieldLabel>What are you looking for?</FieldLabel>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["rent", "sale"] as const).map((type) => (
            <button
              type="button"
              key={type}
              onClick={() => update("transactionType", type)}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${form.transactionType === type ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
            >
              <span className="block text-base">{type === "rent" ? "Property to rent" : "Property to buy"}</span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">{type === "rent" ? "Monthly budget" : "Purchase budget"}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>Property type</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {types.map((type) => (
            <ChoiceChip key={type} selected={form.propertyTypes.includes(type)} onClick={() => toggleType(type)}>{displayName(type)}</ChoiceChip>
          ))}
        </div>
        {!form.propertyTypes.length && <p className="mt-2 text-xs text-destructive">Choose at least one property type.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel>City</FieldLabel>
          <Input value={form.cities} onChange={(event) => update("cities", event.target.value)} placeholder="Harare, Bulawayo" />
          <p className="text-xs text-muted-foreground">Separate multiple cities with commas.</p>
        </div>
        <div className="space-y-2">
          <FieldLabel>Preferred suburb or area</FieldLabel>
          <Input value={form.suburbs} onChange={(event) => update("suburbs", event.target.value)} placeholder="Borrowdale, Highlands" />
          <p className="text-xs text-muted-foreground">Leave blank for any location in the city.</p>
        </div>
      </div>

      <div>
        <FieldLabel>{form.transactionType === "rent" ? "Monthly budget" : "Purchase budget"}</FieldLabel>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Input type="number" min="0" value={form.minPrice} onChange={(event) => update("minPrice", event.target.value)} placeholder="Minimum" aria-label="Minimum price" />
          <Input type="number" min="0" value={form.maxPrice} onChange={(event) => update("maxPrice", event.target.value)} placeholder="Maximum" aria-label="Maximum price" />
        </div>
      </div>

      {!form.propertyTypes.some((type) => commercialTypes.includes(type) || type === "land") && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel>Bedrooms</FieldLabel>
            <select value={form.minBedrooms} onChange={(event) => update("minBedrooms", event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="any">Any</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}+ bedrooms</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <FieldLabel>Bathrooms</FieldLabel>
            <select value={form.minBathrooms} onChange={(event) => update("minBathrooms", event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="any">Any</option>{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}+ bathrooms</option>)}
            </select>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <FieldLabel>Features</FieldLabel>
          <span className="text-xs text-muted-foreground">Optional preferences improve ranking</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {amenityOptions.map((amenity) => (
            <div key={amenity} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5">
              <span className="text-sm">{amenity}</span>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <button type="button" onClick={() => toggleAmenity("requiredAmenities", amenity)} className={form.requiredAmenities.includes(amenity) ? "font-semibold text-primary" : "hover:text-foreground"}>Must have</button>
                <button type="button" onClick={() => toggleAmenity("preferredAmenities", amenity)} className={form.preferredAmenities.includes(amenity) ? "font-semibold text-primary" : "hover:text-foreground"}>Preferred</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel>How often should we notify you?</FieldLabel>
          <select value={form.notificationFrequency} onChange={(event) => update("notificationFrequency", event.target.value as FormState["notificationFrequency"])} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="immediately">Immediately</option>
            <option value="daily">Once daily</option>
            <option value="weekly">Once weekly</option>
          </select>
        </div>
        <div className="space-y-2">
          <FieldLabel>Notification channels</FieldLabel>
          <div className="flex flex-col gap-2 rounded-md border border-border/70 p-2.5">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked disabled /> In-app notification</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.emailEnabled} onCheckedChange={(checked) => update("emailEnabled", checked === true)} /> <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email</label>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <FieldLabel>Alert name <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
        <Input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="3 Bedroom Borrowdale Rental" />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={pending || form.propertyTypes.length === 0}>{pending ? "Saving..." : editing ? "Save changes" : "Create alert"}</Button>
      </DialogFooter>
    </form>
  );
}

export function PropertyAlertsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const alertsQuery = useListPropertyAlerts({ query: { retry: false, queryKey: getListPropertyAlertsQueryKey() } });
  const createAlert = useCreatePropertyAlert();
  const updateAlert = useUpdatePropertyAlert();
  const updateStatus = useUpdatePropertyAlertStatus();
  const deleteAlert = useDeletePropertyAlert();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyAlert | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListPropertyAlertsQueryKey() });
  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (alert: PropertyAlert) => { setEditing(alert); setForm(formFromAlert(alert)); setDialogOpen(true); };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: PropertyAlertInput = {
      name: form.name.trim() || undefined,
      transactionType: form.transactionType,
      propertyTypes: form.propertyTypes,
      cities: listFromText(form.cities),
      suburbs: listFromText(form.suburbs),
      minPrice: numberOrNull(form.minPrice),
      maxPrice: numberOrNull(form.maxPrice),
      minBedrooms: form.minBedrooms === "any" ? null : Number(form.minBedrooms),
      minBathrooms: form.minBathrooms === "any" ? null : Number(form.minBathrooms),
      requiredAmenities: form.requiredAmenities,
      preferredAmenities: form.preferredAmenities,
      notificationFrequency: form.notificationFrequency,
      notificationChannels: form.emailEnabled ? ["in_app", "email"] : ["in_app"],
    };
    if (editing) {
      const updatePayload: PropertyAlertUpdate = payload;
      updateAlert.mutate({ id: editing.id, data: updatePayload }, {
        onSuccess: () => { setDialogOpen(false); refresh(); toast({ title: "Alert updated", description: "Your property search preferences are saved." }); },
        onError: () => toast({ variant: "destructive", title: "Couldn’t update alert", description: "Please check the details and try again." }),
      });
    } else {
      createAlert.mutate({ data: payload }, {
        onSuccess: () => { setDialogOpen(false); refresh(); toast({ title: "Property alert created", description: "We’ll let you know when a matching property is listed." }); },
        onError: () => toast({ variant: "destructive", title: "Couldn’t create alert", description: "Please check the details and try again." }),
      });
    }
  };

  const toggleActive = (alert: PropertyAlert) => {
    updateStatus.mutate({ id: alert.id, data: { active: !alert.active } }, {
      onSuccess: () => { refresh(); toast({ description: alert.active ? "Alert paused" : "Alert resumed" }); },
      onError: () => toast({ variant: "destructive", title: "Couldn’t update alert", description: "Please try again." }),
    });
  };

  const remove = (alert: PropertyAlert) => {
    if (!window.confirm(`Delete “${alert.name}”?`)) return;
    deleteAlert.mutate({ id: alert.id }, {
      onSuccess: () => { refresh(); toast({ description: "Alert deleted" }); },
      onError: () => toast({ variant: "destructive", title: "Couldn’t delete alert", description: "Please try again." }),
    });
  };

  if (alertsQuery.isLoading) {
    return <div data-testid="loading-property-alerts" className="space-y-4"><div className="h-32 animate-pulse rounded-2xl bg-muted" /><div className="h-28 animate-pulse rounded-2xl bg-muted" /></div>;
  }
  if (alertsQuery.isError) {
    return <Card data-testid="error-property-alerts" className="border-rose-200 bg-rose-50/60"><CardContent className="p-6"><p className="font-semibold text-rose-950">Your property alerts couldn’t load</p><p className="mt-1 text-sm text-rose-800">Please try again in a moment.</p><Button className="mt-4" variant="outline" onClick={() => alertsQuery.refetch()}>Try again</Button></CardContent></Card>;
  }

  const alerts = alertsQuery.data ?? [];
  return (
    <div data-testid="property-alerts-panel" className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-primary/15 bg-primary/[0.045] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Bell className="h-5 w-5" aria-hidden="true" /></div>
          <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Property alerts</p><h2 className="mt-1 font-display text-2xl text-foreground">We’ll watch the market for you</h2><p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Tell us what you’re looking for and get a notification when a matching property appears.</p></div>
        </div>
        <div className="shrink-0 rounded-xl bg-background/80 px-4 py-3 text-center shadow-sm sm:min-w-28"><p className="text-2xl font-semibold text-primary">{alerts.filter((alert) => alert.active).length}</p><p className="text-xs font-medium text-muted-foreground">active {alerts.filter((alert) => alert.active).length === 1 ? "alert" : "alerts"}</p></div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Your searches</p><h2 className="mt-1 font-display text-3xl text-foreground">My property alerts</h2></div><Button data-testid="button-create-property-alert" onClick={openCreate}><Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Create property alert</Button></div>

      {alerts.length === 0 ? (
        <Card data-testid="empty-property-alerts" className="border-dashed border-border/90 bg-background/60"><CardContent className="flex flex-col items-center px-6 py-14 text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary"><Search className="h-6 w-6" aria-hidden="true" /></div><h3 className="font-display text-2xl text-foreground">Nothing on your watchlist yet</h3><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Create an alert in under a minute and we’ll tell you when the right home becomes available.</p><Button variant="outline" className="mt-5" onClick={openCreate}>Create your first alert <Plus className="ml-2 h-4 w-4" aria-hidden="true" /></Button></CardContent></Card>
      ) : (
        <div data-testid="list-property-alerts" className="grid gap-4 lg:grid-cols-2">
          {alerts.map((alert) => {
            const summary = alertSummary(alert);
            return (
              <Card key={alert.id} data-testid={`card-property-alert-${alert.id}`} className={`border-border/70 shadow-sm ${!alert.active ? "opacity-75" : ""}`}>
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${alert.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}><Bell className="h-5 w-5" aria-hidden="true" /></div><div><h3 className="font-semibold text-foreground">{alert.name}</h3><p className="mt-1 text-sm capitalize text-muted-foreground">{alert.transactionType === "rent" ? "For rent" : "For sale"} · {alert.propertyTypes.map(displayName).join(", ")}</p></div></div><span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${alert.active ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{alert.active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}{alert.active ? "Active" : "Paused"}</span></div>
                  <div className="mt-5 grid grid-cols-1 gap-3 border-y border-border/60 py-4 text-sm sm:grid-cols-3"><div><p className="text-muted-foreground">Budget</p><p className="mt-1 font-medium text-foreground">{summary.budget}</p></div><div><p className="text-muted-foreground">Location</p><p className="mt-1 flex items-start gap-1 font-medium text-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{summary.location}</p></div><div><p className="text-muted-foreground">Home size</p><p className="mt-1 font-medium text-foreground">{summary.beds}</p></div></div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{alert.notificationFrequency === "immediately" ? "Instant alerts" : `${displayName(alert.notificationFrequency)} digest`}</span><span>{alert.matchedCount} matched · {alert.notificationsSent} sent</span>{alert.notificationChannels.includes("email") && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />Email on</span>}</div>
                  <div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => openEdit(alert)}><Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit</Button><Button variant="outline" size="sm" onClick={() => toggleActive(alert)}>{alert.active ? <><Pause className="mr-1.5 h-3.5 w-3.5" /> Pause</> : <><Play className="mr-1.5 h-3.5 w-3.5" /> Resume</>}</Button><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => remove(alert)}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete</Button></div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle className="font-display text-2xl">{editing ? "Edit property alert" : "Create a property alert"}</DialogTitle><DialogDescription>{editing ? "Keep your search preferences up to date." : "Choose the essentials and we’ll do the watching for you."}</DialogDescription></DialogHeader><AlertForm form={form} setForm={setForm} onSubmit={submit} onCancel={() => setDialogOpen(false)} pending={createAlert.isPending || updateAlert.isPending} editing={!!editing} /></DialogContent></Dialog>
    </div>
  );
}