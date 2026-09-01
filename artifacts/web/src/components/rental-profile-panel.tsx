import {
  getGetRentalProfileQueryKey,
  getSearchRentalAgenciesQueryKey,
  useCreateRentalHistory,
  useDisputeRentalReference,
  useGetRentalProfile,
  useRequestRentalVerification,
  useSearchRentalAgencies,
} from "@workspace/api-client-react";
import type {
  RentalHistory,
  RentalHistoryInput,
  ReferenceRequestInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Home,
  Info,
  Loader2,
  Mail,
  MapPin,
  Plus,
  ShieldCheck,
  Siren,
  UserRound,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FormState = {
  propertyAddress: string;
  suburb: string;
  city: string;
  startDate: string;
  endDate: string;
  tenancyType: "private_landlord" | "agency";
  refereeType: "private_landlord" | "agency";
  refereeName: string;
  refereeEmail: string;
  refereePhone: string;
  agencyId?: number | null;
};

const initialForm: FormState = {
  propertyAddress: "",
  suburb: "",
  city: "",
  startDate: "",
  endDate: "",
  tenancyType: "private_landlord",
  refereeType: "private_landlord",
  refereeName: "",
  refereeEmail: "",
  refereePhone: "",
  agencyId: null,
};

function formatDate(value: string) {
  if (!value) return "Date not provided";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-ZW", { month: "short", year: "numeric" }).format(date);
}

function statusCopy(status: RentalHistory["verificationStatus"]) {
  return {
    verified: { label: "Verified", tone: "verified", icon: CheckCircle2 },
    pending: { label: "Verification pending", tone: "pending", icon: Clock3 },
    self_reported: { label: "Self-reported", tone: "self", icon: UserRound },
    not_verified: { label: "Not verified", tone: "not", icon: XCircle },
  }[status];
}

function StatusPill({ status }: { status: RentalHistory["verificationStatus"] }) {
  const copy = statusCopy(status);
  const Icon = copy.icon;
  return (
    <span
      data-testid={`status-rental-${status}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        copy.tone === "verified"
          ? "bg-emerald-50 text-emerald-700"
          : copy.tone === "pending"
            ? "bg-amber-50 text-amber-700"
            : copy.tone === "self"
              ? "bg-sky-50 text-sky-700"
              : "bg-rose-50 text-rose-700"
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {copy.label}
    </span>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, required = true }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required ? <span className="text-primary"> *</span> : null}</Label>
      <Input
        data-testid={`input-${label.toLowerCase().replaceAll(" ", "-")}`}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ReferenceAnswers({ tenancy }: { tenancy: RentalHistory }) {
  const reference = tenancy.reference;
  if (!reference || tenancy.verificationStatus !== "verified") return null;
  return (
    <div data-testid={`reference-answers-${tenancy.id}`} className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-900">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        Reference verified
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-emerald-800/70">Rent paid on time</dt>
          <dd className="mt-1 font-semibold capitalize text-emerald-950">{reference.rentPaymentRating ?? "Not answered"}</dd>
        </div>
        <div>
          <dt className="text-emerald-800/70">Property care</dt>
          <dd className="mt-1 font-semibold capitalize text-emerald-950">{reference.propertyConditionRating ?? "Not answered"}</dd>
        </div>
        <div>
          <dt className="text-emerald-800/70">Would rent again</dt>
          <dd className="mt-1 font-semibold text-emerald-950">
            {reference.wouldRentAgain === null ? "Not answered" : reference.wouldRentAgain ? "Yes" : "No"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function TenancyCard({ tenancy, onRequest, onDispute }: {
  tenancy: RentalHistory;
  onRequest: (tenancy: RentalHistory) => void;
  onDispute: (tenancy: RentalHistory) => void;
}) {
  return (
    <Card data-testid={`card-rental-history-${tenancy.id}`} className="border-border/70 shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Home className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 data-testid={`text-rental-address-${tenancy.id}`} className="font-semibold text-foreground">{tenancy.propertyAddress}</h3>
              <p data-testid={`text-rental-location-${tenancy.id}`} className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {tenancy.suburb}, {tenancy.city}
              </p>
            </div>
          </div>
          <StatusPill status={tenancy.verificationStatus} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-y border-border/60 py-4 text-sm sm:max-w-md">
          <div>
            <p className="text-muted-foreground">Stayed</p>
            <p data-testid={`text-rental-dates-${tenancy.id}`} className="mt-1 flex items-center gap-1.5 font-medium text-foreground">
              <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {formatDate(tenancy.startDate)} – {formatDate(tenancy.endDate)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Reference</p>
            <p className="mt-1 font-medium capitalize text-foreground">
              {tenancy.refereeType === "agency" ? "Rental agency" : "Private landlord"}
            </p>
          </div>
        </div>

        {tenancy.verificationStatus === "pending" ? (
          <p className="mt-4 flex items-start gap-2 text-sm text-amber-800">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            We’ve sent a secure request to {tenancy.refereeName || "your referee"}. We’ll update this record when they respond.
          </p>
        ) : null}
        {tenancy.verificationStatus === "self_reported" ? (
          <div className="mt-4 flex flex-col gap-3 rounded-lg bg-sky-50/70 p-3.5 text-sm text-sky-900 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Only you have confirmed this stay so far.</p>
            <Button data-testid={`button-request-verification-${tenancy.id}`} variant="outline" size="sm" onClick={() => onRequest(tenancy)} className="shrink-0 border-sky-200 bg-background text-sky-800 hover:bg-sky-100">
              Request verification <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
        {tenancy.verificationStatus === "not_verified" ? (
          <p className="mt-4 flex items-start gap-2 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />This referee could not confirm the tenancy. If the details look wrong, contact QuickProp support.
          </p>
        ) : null}
        <ReferenceAnswers tenancy={tenancy} />
        {tenancy.verificationStatus === "verified" ? (
          <div className="mt-4 flex justify-end">
            <Button data-testid={`button-dispute-reference-${tenancy.id}`} variant="ghost" size="sm" onClick={() => onDispute(tenancy)} className="text-muted-foreground hover:text-destructive">
              <Siren className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Something looks wrong
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function RentalProfilePanel() {
  const queryClient = useQueryClient();
  const profileQuery = useGetRentalProfile({ query: { retry: false, queryKey: getGetRentalProfileQueryKey() } });
  const createHistory = useCreateRentalHistory();
  const requestVerification = useRequestRentalVerification();
  const disputeReference = useDisputeRentalReference();
  const [addOpen, setAddOpen] = useState(false);
  const [requestFor, setRequestFor] = useState<RentalHistory | null>(null);
  const [disputeFor, setDisputeFor] = useState<RentalHistory | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [agencySearch, setAgencySearch] = useState("");
  const [selectedAgency, setSelectedAgency] = useState<{ id: number; name: string } | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const agencyQuery = useSearchRentalAgencies(
    { q: agencySearch.length >= 2 ? agencySearch : "zz" },
    { query: { enabled: agencySearch.length >= 2, queryKey: getSearchRentalAgenciesQueryKey({ q: agencySearch.length >= 2 ? agencySearch : "zz" }) } },
  );

  const refreshProfile = () => queryClient.invalidateQueries({ queryKey: getGetRentalProfileQueryKey() });
  const updateForm = (key: keyof FormState, value: string | number | null) => setForm((current) => ({ ...current, [key]: value }));

  const submitHistory = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const payload: RentalHistoryInput = {
      propertyAddress: form.propertyAddress,
      suburb: form.suburb,
      city: form.city,
      startDate: form.startDate,
      endDate: form.endDate,
      tenancyType: form.tenancyType,
      refereeType: form.refereeType,
      refereeName: form.refereeName || undefined,
      refereeEmail: form.refereeEmail || undefined,
      refereePhone: form.refereePhone || undefined,
      agencyId: selectedAgency?.id ?? null,
    };
    createHistory.mutate({ data: payload }, {
      onSuccess: () => {
        setAddOpen(false);
        setForm(initialForm);
        setSelectedAgency(null);
        setAgencySearch("");
        setMessage({ tone: "success", text: "Previous tenancy added to your rental profile." });
        refreshProfile();
      },
      onError: () => setMessage({ tone: "error", text: "We couldn’t add that tenancy. Please check the details and try again." }),
    });
  };

  const openRequest = (tenancy: RentalHistory) => {
    setMessage(null);
    setRequestFor(tenancy);
  };

  const submitRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requestFor) return;
    const data: ReferenceRequestInput = {
      refereeType: requestFor.refereeType as ReferenceRequestInput["refereeType"],
      refereeName: requestFor.refereeName || undefined,
      refereeEmail: requestFor.refereeEmail || undefined,
      refereePhone: requestFor.refereePhone || undefined,
      agencyId: requestFor.agencyId,
    };
    requestVerification.mutate({ id: requestFor.id, data }, {
      onSuccess: () => {
        setRequestFor(null);
        setMessage({ tone: "success", text: "Verification request sent securely." });
        refreshProfile();
      },
      onError: () => setMessage({ tone: "error", text: "We couldn’t send the request. Please try again." }),
    });
  };

  const submitDispute = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!disputeFor || disputeReason.trim().length < 10) return;
    disputeReference.mutate({ id: disputeFor.id, data: { reason: disputeReason.trim() } }, {
      onSuccess: () => {
        setDisputeFor(null);
        setDisputeReason("");
        setMessage({ tone: "success", text: "Thanks. Your concern has been sent to QuickProp for review." });
        refreshProfile();
      },
      onError: () => setMessage({ tone: "error", text: "We couldn’t submit the dispute. Please try again." }),
    });
  };

  if (profileQuery.isLoading) {
    return (
      <div data-testid="loading-rental-profile" className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }
  if (profileQuery.isError) {
    return (
      <Card data-testid="error-rental-profile" className="border-rose-200 bg-rose-50/60">
        <CardContent className="flex flex-col items-start gap-3 p-6">
          <AlertCircle className="h-6 w-6 text-rose-700" aria-hidden="true" />
          <div><h2 className="font-semibold text-rose-950">Your rental profile couldn’t load</h2><p className="mt-1 text-sm text-rose-800">Please try again in a moment.</p></div>
          <Button data-testid="button-retry-rental-profile" variant="outline" onClick={() => profileQuery.refetch()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const profile = profileQuery.data;
  const tenancies = profile?.tenancies ?? [];
  return (
    <div data-testid="rental-profile-panel" className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-primary/15 bg-primary/[0.045] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-2xl text-foreground">A better way to introduce yourself</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Keep the rental history you choose to share in one place. Verified stays help new landlords get to know you without starting from scratch.</p>
          </div>
        </div>
        <div data-testid="text-rental-profile-summary" className="shrink-0 rounded-xl bg-background/80 px-4 py-3 text-center shadow-sm sm:min-w-28">
          <p className="text-2xl font-semibold text-primary">{profile?.verifiedCount ?? 0}</p>
          <p className="text-xs font-medium text-muted-foreground">verified {profile?.verifiedCount === 1 ? "stay" : "stays"}</p>
        </div>
      </div>

      {message ? (
        <div data-testid={`status-rental-profile-${message.tone}`} className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${message.tone === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
          {message.tone === "success" ? <Check className="h-4 w-4" aria-hidden="true" /> : <AlertCircle className="h-4 w-4" aria-hidden="true" />}
          {message.text}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Your history</p><h2 className="mt-1 font-display text-3xl text-foreground">Homes you’ve called home</h2></div>
        <Button data-testid="button-add-rental-history" onClick={() => { setMessage(null); setAddOpen(true); }}><Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Add previous tenancy</Button>
      </div>

      {tenancies.length === 0 ? (
        <Card data-testid="empty-rental-profile" className="border-dashed border-border/90 bg-background/60">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary"><Home className="h-6 w-6" aria-hidden="true" /></div>
            <h3 className="font-display text-2xl text-foreground">Start with a home you remember</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Add a previous tenancy and invite a landlord or agency to confirm it when you’re ready.</p>
            <Button data-testid="button-add-first-rental-history" variant="outline" className="mt-5" onClick={() => setAddOpen(true)}>Add your first tenancy <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Button>
          </CardContent>
        </Card>
      ) : (
        <div data-testid="list-rental-history" className="space-y-4">
          {tenancies.map((tenancy) => <TenancyCard key={tenancy.id} tenancy={tenancy} onRequest={openRequest} onDispute={(item) => { setDisputeFor(item); setDisputeReason(""); }} />)}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/40 p-4 text-sm text-muted-foreground">
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p>You’re in control. Nothing is shared with a prospective landlord unless you choose to share your profile with them.</p>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-display text-2xl">Add a previous tenancy</DialogTitle><DialogDescription>Tell us about the home. You can request verification now or later.</DialogDescription></DialogHeader>
          <form data-testid="form-add-rental-history" onSubmit={submitHistory} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Property address" value={form.propertyAddress} placeholder="12 Borrowdale Road" onChange={(value) => updateForm("propertyAddress", value)} /></div>
              <Field label="Suburb" value={form.suburb} placeholder="Borrowdale" onChange={(value) => updateForm("suburb", value)} />
              <Field label="City" value={form.city} placeholder="Harare" onChange={(value) => updateForm("city", value)} />
              <Field label="Start date" type="date" value={form.startDate} onChange={(value) => updateForm("startDate", value)} />
              <Field label="End date" type="date" value={form.endDate} onChange={(value) => updateForm("endDate", value)} />
              <div className="space-y-1.5"><Label>Tenancy type <span className="text-primary">*</span></Label><select data-testid="select-tenancy-type" value={form.tenancyType} onChange={(event) => updateForm("tenancyType", event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="private_landlord">Private landlord</option><option value="agency">Rental agency</option></select></div>
              <div className="space-y-1.5"><Label>Reference type <span className="text-primary">*</span></Label><select data-testid="select-referee-type" value={form.refereeType} onChange={(event) => updateForm("refereeType", event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="private_landlord">Private landlord</option><option value="agency">Rental agency</option></select></div>
            </div>
            <div className="border-t border-border/60 pt-5"><p className="mb-3 text-sm font-semibold text-foreground">Reference contact <span className="font-normal text-muted-foreground">(optional for now)</span></p><div className="grid gap-4 sm:grid-cols-3"><Field label="Referee name" required={false} value={form.refereeName} placeholder="Name" onChange={(value) => updateForm("refereeName", value)} /><Field label="Email" required={false} type="email" value={form.refereeEmail} placeholder="name@example.com" onChange={(value) => updateForm("refereeEmail", value)} /><Field label="Phone" required={false} value={form.refereePhone} placeholder="+263" onChange={(value) => updateForm("refereePhone", value)} /></div></div>
            {form.refereeType === "agency" ? <div className="space-y-2"><Label>Find the agency <span className="font-normal text-muted-foreground">(optional)</span></Label><Input data-testid="input-agency-search" value={agencySearch} placeholder="Search registered agencies" onChange={(event) => { setAgencySearch(event.target.value); setSelectedAgency(null); }} />{selectedAgency ? <button type="button" data-testid="button-clear-agency" className="text-left text-sm text-primary" onClick={() => setSelectedAgency(null)}>Selected: {selectedAgency.name} — change</button> : agencyQuery.data && agencyQuery.data.length > 0 ? <div className="max-h-28 overflow-y-auto rounded-md border border-border bg-background">{agencyQuery.data.map((agency) => <button type="button" data-testid={`button-select-agency-${agency.id}`} key={agency.id} onClick={() => { setSelectedAgency({ id: agency.id, name: agency.name }); setAgencySearch(agency.name); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary">{agency.name}</button>)}</div> : null}</div> : null}
            <DialogFooter><Button data-testid="button-cancel-add-rental-history" type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button data-testid="button-save-rental-history" type="submit" disabled={createHistory.isPending}>{createHistory.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}Save tenancy</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!requestFor} onOpenChange={(open) => !open && setRequestFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display text-2xl">Request a reference</DialogTitle><DialogDescription>We’ll send {requestFor?.refereeName || "your referee"} a secure link with three short questions. Their answers are only visible after they verify the tenancy.</DialogDescription></DialogHeader>
          <form data-testid="form-request-rental-verification" onSubmit={submitRequest} className="space-y-5"><div className="rounded-lg bg-secondary/50 p-4 text-sm"><p className="font-medium text-foreground">{requestFor?.propertyAddress}</p><p className="mt-1 text-muted-foreground">{requestFor ? formatDate(requestFor.startDate) : ""} – {requestFor ? formatDate(requestFor.endDate) : ""}</p></div><p className="text-sm text-muted-foreground">We’ll use the referee details saved on this tenancy. You can close this window if you need to edit them first.</p><DialogFooter><Button data-testid="button-cancel-request-verification" type="button" variant="outline" onClick={() => setRequestFor(null)}>Not now</Button><Button data-testid="button-send-request-verification" type="submit" disabled={requestVerification.isPending}>{requestVerification.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="mr-2 h-4 w-4" aria-hidden="true" />}Send secure request</Button></DialogFooter></form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!disputeFor} onOpenChange={(open) => !open && setDisputeFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display text-2xl">Tell us what looks wrong</DialogTitle><DialogDescription>Your concern will be reviewed privately. It won’t remove the reference while it’s being reviewed.</DialogDescription></DialogHeader>
          <form data-testid="form-dispute-rental-reference" onSubmit={submitDispute} className="space-y-4"><div className="rounded-lg bg-secondary/50 p-4 text-sm font-medium">{disputeFor?.propertyAddress}</div><div className="space-y-1.5"><Label htmlFor="dispute-reason">What should we know?</Label><Textarea id="dispute-reason" data-testid="textarea-dispute-reason" value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} placeholder="Please share at least 10 characters about the issue." minLength={10} required rows={4} /></div><DialogFooter><Button data-testid="button-cancel-dispute" type="button" variant="outline" onClick={() => setDisputeFor(null)}>Cancel</Button><Button data-testid="button-submit-dispute" type="submit" variant="destructive" disabled={disputeReference.isPending || disputeReason.trim().length < 10}>{disputeReference.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}Submit concern</Button></DialogFooter></form>
        </DialogContent>
      </Dialog>
    </div>
  );
}