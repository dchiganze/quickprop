import { useState } from "react";
import { useConfirmPublicSale, useGetPublicSaleConfirmation, getGetPublicSaleConfirmationQueryKey } from "@workspace/api-client-react";
import { AlertCircle, BadgeCheck, CheckCircle2, Clock3, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatMoney(amount: number | null, currency: string) {
  if (amount == null) return "Not provided";
  return `${currency} ${amount.toLocaleString()}`;
}

export default function SaleConfirmationPage() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [confirmed, setConfirmed] = useState(false);
  const confirmation = useGetPublicSaleConfirmation(
    { token },
    { query: { enabled: /^[a-f0-9]{64}$/i.test(token), queryKey: getGetPublicSaleConfirmationQueryKey({ token }) } },
  );
  const confirmSale = useConfirmPublicSale();

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return <ConfirmationState title="This link isn’t valid" body="Ask the agent to create a new conveyancer confirmation link." icon="error" />;
  }
  if (confirmation.isLoading) {
    return <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4"><Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Loading confirmation" /></main>;
  }
  if (confirmation.isError) {
    const code = (confirmation.error as { status?: number }).status;
    return <ConfirmationState title={code === 410 ? "This link has expired" : code === 404 ? "This link isn’t valid" : "We couldn’t open this request"} body={code === 410 ? "Ask the agent to create a new confirmation link." : "Check the link and try again, or ask the agent to create a new one."} icon={code === 410 ? "expired" : "error"} />;
  }
  const details = confirmation.data;
  if (!details) return <ConfirmationState title="We couldn’t open this request" body="Ask the agent to create a new confirmation link." icon="error" />;
  if (confirmed || details.status === "confirmed" || confirmSale.data?.status === "confirmed" || confirmSale.data?.status === "already_confirmed") {
    return <ConfirmationState title="Sale confirmation recorded" body={`Thank you. The sale of ${details.propertyReference} is confirmed and will appear in ${details.agentName}’s verified sales history.`} icon="success" />;
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-lg border-border/70 shadow-lg" data-testid="sale-confirmation-card">
        <CardHeader className="border-b border-border/60 bg-primary/[0.035] p-6 sm:p-8">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></div>
          <CardTitle className="font-display text-3xl text-foreground">Confirm completed sale</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">Please confirm that this property sale has completed. The confirmation will be recorded against the agent’s QuickProp selling history.</p>
        </CardHeader>
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="grid gap-4 rounded-xl bg-secondary/45 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-[.15em] text-muted-foreground">Property</p><p className="mt-1 font-semibold text-foreground">{details.propertyTitle}</p><p className="text-sm text-muted-foreground">{details.propertyReference}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-[.15em] text-muted-foreground">Agent</p><p className="mt-1 text-sm font-medium text-foreground">{details.agentName}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-[.15em] text-muted-foreground">Sale price</p><p className="mt-1 text-sm font-medium text-foreground">{formatMoney(details.salePrice, details.currency)}</p></div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">By selecting confirm, you attest that the sale shown above has completed.</p>
          {confirmSale.isError && <p role="alert" className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />We couldn’t record the confirmation. Please try again.</p>}
          <Button className="w-full" data-testid="button-confirm-sale" disabled={confirmSale.isPending} onClick={() => confirmSale.mutate({ data: { token } }, { onSuccess: () => setConfirmed(true) })}>
            {confirmSale.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <BadgeCheck className="mr-2 h-4 w-4" aria-hidden="true" />}
            Confirm completed sale
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function ConfirmationState({ title, body, icon }: { title: string; body: string; icon: "success" | "expired" | "error" }) {
  const Icon = icon === "success" ? CheckCircle2 : icon === "expired" ? Clock3 : AlertCircle;
  return <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10"><Card className="w-full max-w-md border-border/70 shadow-lg"><CardContent className="flex flex-col items-center p-8 text-center sm:p-10"><div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-full ${icon === "success" ? "bg-emerald-50 text-emerald-700" : "bg-secondary text-primary"}`}><Icon className="h-7 w-7" aria-hidden="true" /></div><h1 className="font-display text-3xl text-foreground">{title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p></CardContent></Card></main>;
}
