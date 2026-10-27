import { useState } from "react";
import { useParams } from "wouter";
import { getGetPublicRentalReferenceQueryKey, useGetPublicRentalReference, useSubmitPublicRentalReference } from "@workspace/api-client-react";
import type { RentalReferenceInput } from "@workspace/api-client-react";
import { AlertCircle, CheckCircle2, Clock3, Home, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-ZW", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { status?: number; statusCode?: number; response?: { status?: number }; message?: string };
  const status = candidate.status ?? candidate.statusCode ?? candidate.response?.status;
  if (status) return status;
  const message = candidate.message?.toLowerCase() ?? "";
  if (message.includes("expired")) return 410;
  if (message.includes("used")) return 409;
  if (message.includes("invalid") || message.includes("not found")) return 404;
  return undefined;
}

function LinkState({ kind, onRetry }: { kind: "expired" | "used" | "invalid" | "error"; onRetry?: () => void }) {
  const content = {
    expired: { icon: Clock3, title: "This link has expired", body: "For your security, reference links are only active for a limited time. Ask the tenant to send a new request." },
    used: { icon: CheckCircle2, title: "This reference is already complete", body: "This secure link has already been used. No further action is needed." },
    invalid: { icon: AlertCircle, title: "This link isn’t valid", body: "Check that you opened the complete link from the message, or ask the tenant to send a new request." },
    error: { icon: AlertCircle, title: "We couldn’t open this request", body: "Please try again shortly. If the problem continues, ask the tenant to resend the reference request." },
  }[kind];
  const Icon = content.icon;
  return <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10"><Card data-testid={`state-reference-${kind}`} className="w-full max-w-md border-border/70 shadow-lg"><CardContent className="flex flex-col items-center p-8 text-center sm:p-10"><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary"><Icon className="h-7 w-7" aria-hidden="true" /></div><h1 className="font-display text-3xl text-foreground">{content.title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{content.body}</p>{onRetry ? <Button variant="outline" className="mt-5" onClick={onRetry}>Try again</Button> : null}</CardContent></Card></main>;
}

export default function RentalReference() {
  const { token } = useParams<{ token: string }>();
  const [tenancyPeriod, setTenancyPeriod] = useState("");
  const [rentPaymentRating, setRentPaymentRating] = useState<RentalReferenceInput["rentPaymentRating"]>();
  const [propertyConditionRating, setPropertyConditionRating] = useState<RentalReferenceInput["propertyConditionRating"]>();
  const [wouldRentAgain, setWouldRentAgain] = useState<boolean | undefined>();
  const submitReference = useSubmitPublicRentalReference();
  const referenceQuery = useGetPublicRentalReference(token ?? "", { query: { enabled: !!token, queryKey: getGetPublicRentalReferenceQueryKey(token ?? "") } });

  if (!token) return <LinkState kind="invalid" />;
  if (referenceQuery.isLoading) return <main data-testid="loading-rental-reference" className="flex min-h-[100dvh] items-center justify-center bg-background px-4"><div className="w-full max-w-md space-y-4"><div className="h-8 w-36 animate-pulse rounded bg-muted" /><div className="h-72 animate-pulse rounded-2xl bg-muted" /></div></main>;
  if (referenceQuery.isError) {
    const code = errorCode(referenceQuery.error);
    return <LinkState kind={code === 410 ? "expired" : code === 409 ? "used" : code === 404 ? "invalid" : "error"} onRetry={!code || (code !== 410 && code !== 409 && code !== 404) ? () => referenceQuery.refetch() : undefined} />;
  }
  if (submitReference.isSuccess) {
    const result = submitReference.data;
    return <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10"><Card data-testid="state-reference-success" className="w-full max-w-md border-border/70 shadow-lg"><CardContent className="flex flex-col items-center p-8 text-center sm:p-10"><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-7 w-7" aria-hidden="true" /></div><h1 className="font-display text-3xl text-foreground">Thank you for your time</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{result.status === "verified" ? "Your reference has been recorded and the tenancy is now marked as verified." : "Your response has been recorded. The tenant will see that the tenancy could not be verified."}</p></CardContent></Card></main>;
  }
  const reference = referenceQuery.data;
  if (!reference) return <LinkState kind="error" />;
  const complete = !!tenancyPeriod.trim() && !!rentPaymentRating && !!propertyConditionRating && wouldRentAgain !== undefined;
  const submit = () => {
    if (!complete) return;
    const payload: RentalReferenceInput = { tenancyPeriod: tenancyPeriod.trim(), rentPaymentRating: rentPaymentRating!, propertyConditionRating: propertyConditionRating!, wouldRentAgain: wouldRentAgain! };
    submitReference.mutate({ token, data: payload });
  };

  return (
    <main className="min-h-[100dvh] bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-2 text-primary"><img src={`${import.meta.env.BASE_URL}logo.png`} alt="QuickProp" className="h-8 w-auto" /><span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Secure reference</span></div>
        <Card className="border-border/70 shadow-lg">
          <CardHeader className="border-b border-border/60 bg-primary/[0.035] p-6 sm:p-8"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></div><CardTitle className="font-display text-3xl text-foreground sm:text-4xl">A quick rental reference</CardTitle><p className="max-w-xl text-sm leading-6 text-muted-foreground">Please confirm the details below for the tenant. Your response helps them carry a trusted rental history forward.</p></CardHeader>
          <CardContent className="space-y-7 p-6 sm:p-8">
            <div data-testid="reference-request-details" className="grid gap-5 rounded-xl bg-secondary/45 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-[.15em] text-muted-foreground">Tenant</p><p data-testid="text-reference-tenant" className="mt-1 text-lg font-semibold text-foreground">{reference.tenantName}</p></div><div><p className="text-xs font-semibold uppercase tracking-[.15em] text-muted-foreground">Property</p><p data-testid="text-reference-property" className="mt-1 flex items-start gap-1.5 text-sm font-medium text-foreground"><Home className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />{reference.propertyAddress}, {reference.suburb}, {reference.city}</p></div><div><p className="text-xs font-semibold uppercase tracking-[.15em] text-muted-foreground">Claimed dates</p><p data-testid="text-reference-dates" className="mt-1 text-sm font-medium text-foreground">{formatDate(reference.startDate)} – {formatDate(reference.endDate)}</p></div></div>
            <div data-testid="reference-questions" className="space-y-6">
              <div className="space-y-2"><Label htmlFor="tenancy-period">What period did the tenant stay at the property?</Label><Input id="tenancy-period" data-testid="input-tenancy-period" maxLength={120} value={tenancyPeriod} onChange={(event) => setTenancyPeriod(event.target.value)} placeholder="For example, March 2022 – January 2024" required /></div>
              <RatingQuestion label="Did the tenant pay rent on time?" testId="rent-rating" value={rentPaymentRating} onChange={setRentPaymentRating} />
              <RatingQuestion label="Did the tenant keep the property in a presentable manner?" testId="condition-rating" value={propertyConditionRating} onChange={setPropertyConditionRating} />
              <fieldset><legend className="text-sm font-semibold text-foreground">Would you lease to the tenant again?</legend><div className="mt-3 grid grid-cols-2 gap-2">{([true, false] as const).map((value) => <button type="button" data-testid={`button-rent-again-${value ? "yes" : "no"}`} key={String(value)} onClick={() => setWouldRentAgain(value)} aria-pressed={wouldRentAgain === value} className={`rounded-lg border px-3 py-2.5 text-sm ${wouldRentAgain === value ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>{value ? "Yes" : "No"}</button>)}</div></fieldset>
            </div>
            <p className="rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-950">This is an official document. Providing fraudulent references is a criminal offence.</p>
            {submitReference.isError ? <p data-testid="error-submit-reference" className="flex items-center gap-2 text-sm text-rose-700"><AlertCircle className="h-4 w-4" aria-hidden="true" />We couldn’t save your response. This link may have expired or already been used.</p> : null}
            <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-muted-foreground">QuickProp keeps your response private and secure.</p><Button data-testid="button-submit-reference" onClick={submit} disabled={!complete || submitReference.isPending}>{submitReference.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}Submit reference</Button></div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function RatingQuestion({ label, testId, value, onChange }: {
  label: string;
  testId: string;
  value: RentalReferenceInput["rentPaymentRating"] | undefined;
  onChange: (value: "always" | "sometimes" | "never") => void;
}) {
  return <fieldset><legend className="text-sm font-semibold text-foreground">{label}</legend><div className="mt-3 grid grid-cols-3 gap-2">{(["always", "sometimes", "never"] as const).map((answer) => <button type="button" data-testid={`button-${testId}-${answer}`} key={answer} onClick={() => onChange(answer)} aria-pressed={value === answer} className={`rounded-lg border px-3 py-2.5 text-sm capitalize ${value === answer ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>{answer}</button>)}</div></fieldset>;
}
