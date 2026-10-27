import { useState } from "react";
import { useParams } from "wouter";
import { getGetPublicRentalApplicationQueryKey, useGetPublicRentalApplication, useSubmitPublicRentalApplication } from "@workspace/api-client-react";
import type { RentalApplicationInput } from "@workspace/api-client-react";
import { AlertCircle, ArrowLeft, ArrowRight, BadgeCheck, CheckCircle2, Clock3, Home, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ApplicationFormState = Omit<RentalApplicationInput, "consent"> & { consent: boolean };

const emptyForm: ApplicationFormState = {
  fullName: "", email: "", phone: "", moveInDate: "", occupants: 1, employmentStatus: "employed",
  employerName: "", jobTitle: "", monthlyIncome: null, incomeCurrency: "USD", applicantNote: "", consent: false,
};

function errorKind(error: unknown) {
  if (!error || typeof error !== "object") return "error";
  const e = error as { status?: number; statusCode?: number; response?: { status?: number }; message?: string };
  const status = e.status ?? e.statusCode ?? e.response?.status;
  if (status === 410 || e.message?.toLowerCase().includes("expired")) return "expired";
  if (status === 409 || e.message?.toLowerCase().includes("used")) return "used";
  if (status === 404 || e.message?.toLowerCase().includes("invalid")) return "invalid";
  return "error";
}

export default function RentalApplicationPage() {
  const { token = "" } = useParams<{ token: string }>();
  const listing = useGetPublicRentalApplication(token, { query: { enabled: !!token, queryKey: getGetPublicRentalApplicationQueryKey(token) } });
  const submitApplication = useSubmitPublicRentalApplication();
  const [form, setForm] = useState<ApplicationFormState>(emptyForm);
  const setField = <K extends keyof ApplicationFormState>(key: K, value: ApplicationFormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  if (!token) return <ApplicationState kind="invalid" />;
  if (listing.isLoading) return <main className="min-h-[100dvh] bg-background px-5 py-10"><div className="mx-auto max-w-4xl space-y-5"><div className="h-9 w-40 animate-pulse rounded bg-muted" /><div className="h-56 animate-pulse rounded-3xl bg-muted" /><div className="h-[30rem] animate-pulse rounded-3xl bg-muted" /></div></main>;
  if (listing.isError) return <ApplicationState kind={errorKind(listing.error)} onRetry={() => listing.refetch()} />;
  if (submitApplication.isSuccess) return <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10"><Card className="w-full max-w-lg border-border/70"><CardContent className="flex flex-col items-center p-8 text-center sm:p-12"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><CheckCircle2 className="h-7 w-7" /></div><h1 className="mt-5 font-display text-4xl">Application received</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Your application is with the listing agent. Thank you for sharing your details securely.</p></CardContent></Card></main>;
  const home = listing.data;
  if (!home) return <ApplicationState kind="error" />;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: RentalApplicationInput = { ...form, occupants: Number(form.occupants), monthlyIncome: form.monthlyIncome == null ? null : Number(form.monthlyIncome), consent: true };
    submitApplication.mutate({ token, data: payload });
  };

  return (
    <main className="min-h-[100dvh] bg-[#f4f3eb] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex items-center justify-between"><a href="/tenants" className="flex items-center gap-2 font-display text-xl text-primary"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Home className="h-4 w-4" /></span>QuickProp</a><span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5 text-primary" /> Secure application</span></header>
        <div className="grid gap-5 lg:grid-cols-[.82fr_1.18fr]">
          <aside className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
            <div className="relative h-56 bg-[#dce4d8] sm:h-64">{home.imageUrl ? <img src={home.imageUrl} alt={home.propertyTitle} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-primary/35"><Home className="h-16 w-16" /></div>}<div className="absolute left-4 top-4 rounded-full bg-[#f8f5e9]/95 px-3 py-1.5 text-xs font-bold text-primary"><BadgeCheck className="mr-1 inline h-3.5 w-3.5" />Rental application</div></div>
            <div className="p-6 sm:p-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">{home.propertyReference}</p><h1 className="mt-2 font-display text-3xl leading-tight">{home.propertyTitle}</h1><p className="mt-2 text-sm text-muted-foreground">{home.propertyAddress}, {home.suburb}, {home.city}</p><p className="mt-5 font-display text-3xl text-primary">{home.currency} {new Intl.NumberFormat("en-ZW").format(home.price)}<span className="ml-1 font-sans text-sm font-medium text-muted-foreground">/ month</span></p><div className="mt-5 flex items-center gap-2 border-t border-border/70 pt-4 text-sm text-muted-foreground"><Building2Icon />Listed by <span className="font-semibold text-foreground">{home.agentName}</span></div><p className="mt-4 flex items-start gap-2 rounded-xl bg-secondary/55 p-3 text-xs leading-5 text-muted-foreground"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />This secure application link expires {new Intl.DateTimeFormat("en-ZW", { dateStyle: "medium" }).format(new Date(home.expiresAt))}.</p></div>
          </aside>
          <Card className="rounded-3xl border-border/70 shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Rental application</p><h2 className="mt-2 font-display text-3xl">Tell the agent about you</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Your details are sent securely to the listing agent for this home.</p></div>
            <form onSubmit={submit} className="space-y-6">
                <section><h3 className="mb-4 text-sm font-bold uppercase tracking-[.12em] text-muted-foreground">Your details</h3><div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" value={form.fullName} onChange={(v) => setField("fullName", v)} required />
                  <Field label="Email" type="email" value={form.email} onChange={(v) => setField("email", v)} required />
                  <Field label="Phone" type="tel" value={form.phone} onChange={(v) => setField("phone", v)} required />
                  <Field label="Preferred move-in date" type="date" value={form.moveInDate} onChange={(v) => setField("moveInDate", v)} required />
                  <Field label="Number of occupants" type="number" min="1" max="20" value={String(form.occupants)} onChange={(v) => setField("occupants", Number(v))} required />
                </div></section>
                <section className="border-t border-border/70 pt-5"><h3 className="mb-4 text-sm font-bold uppercase tracking-[.12em] text-muted-foreground">Employment & income</h3><div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="employmentStatus">Employment status</Label><select id="employmentStatus" value={form.employmentStatus} onChange={(e) => setField("employmentStatus", e.target.value as RentalApplicationInput["employmentStatus"])} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="employed">Employed</option><option value="self_employed">Self-employed</option><option value="unemployed">Unemployed</option><option value="student">Student</option><option value="retired">Retired</option><option value="other">Other</option></select></div>
                  <Field label={form.employmentStatus === "self_employed" ? "Business or employer name" : "Employer name"} value={form.employerName ?? ""} onChange={(v) => setField("employerName", v)} required={form.employmentStatus === "employed" || form.employmentStatus === "self_employed"} />
                  <Field label="Job title" value={form.jobTitle ?? ""} onChange={(v) => setField("jobTitle", v)} required={false} />
                  <div className="grid grid-cols-[1fr_110px] gap-2"><Field label="Monthly income" type="number" min="0" step="0.01" value={form.monthlyIncome == null ? "" : String(form.monthlyIncome)} onChange={(v) => setField("monthlyIncome", v === "" ? null : Number(v))} required={form.employmentStatus === "employed" || form.employmentStatus === "self_employed"} /><div className="space-y-2"><Label htmlFor="incomeCurrency">Currency</Label><select id="incomeCurrency" value={form.incomeCurrency ?? "USD"} onChange={(e) => setField("incomeCurrency", e.target.value as RentalApplicationInput["incomeCurrency"])} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"><option>USD</option><option>ZWG</option><option>ZAR</option><option value="other">Other</option></select></div></div>
                </div></section>
                <section className="border-t border-border/70 pt-5"><div className="space-y-2"><Label htmlFor="applicantNote">Note to the agent</Label><Textarea id="applicantNote" maxLength={1000} rows={3} value={form.applicantNote ?? ""} onChange={(e) => setField("applicantNote", e.target.value)} placeholder="Anything you'd like the agent to know" /></div></section>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-primary/15 bg-primary/[.04] p-4 text-sm leading-6"><input type="checkbox" data-testid="checkbox-application-consent" checked={form.consent} onChange={(e) => setField("consent", e.target.checked)} className="mt-1 h-4 w-4 accent-primary" /><span>I consent to sharing the information in this application with the listing agent for this property.</span></label>
                {submitApplication.isError ? <p className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />We couldn’t submit your application. Please check your details and try again.</p> : null}
                <Button type="submit" disabled={submitApplication.isPending || !form.consent} className="h-12 w-full rounded-full text-base">{submitApplication.isPending ? "Sending application…" : <>Send application <ArrowRight className="ml-2 h-4 w-4" /></>}</Button>
                <p className="text-center text-xs leading-5 text-muted-foreground"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-primary" />Your information is only shared with the listing agent for this home.</p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", required = true, min, max, step }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; min?: string; max?: string; step?: string }) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return <div className="space-y-2"><Label htmlFor={id}>{label}{required ? <span className="ml-1 text-primary">*</span> : null}</Label><Input id={id} data-testid={`input-application-${id}`} type={type} min={min} max={max} step={step} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></div>;
}

function Building2Icon() {
  return <Home className="h-4 w-4 text-primary" aria-hidden="true" />;
}

function ApplicationState({ kind, onRetry }: { kind: string; onRetry?: () => void }) {
  const content = kind === "expired" ? ["This application link has expired", "Ask the listing agent to send a new secure application link."] : kind === "used" ? ["This application is already submitted", "This secure link has already been used. No further action is needed."] : kind === "invalid" ? ["This link isn’t valid", "Check that you opened the complete link from the agent’s message."] : ["We couldn’t open this application", "Please try again shortly or contact the listing agent."];
  return <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4"><Card className="w-full max-w-md border-border/70"><CardContent className="p-8 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary"><AlertCircle className="h-7 w-7" /></div><h1 className="mt-5 font-display text-3xl">{content[0]}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{content[1]}</p><div className="mt-6 flex flex-wrap justify-center gap-3">{onRetry ? <Button variant="outline" className="rounded-full" onClick={onRetry}>Try again</Button> : null}<Button asChild variant="outline" className="rounded-full"><a href="/tenants"><ArrowLeft className="mr-2 h-4 w-4" />Back to rentals</a></Button></div></CardContent></Card></main>;
}
