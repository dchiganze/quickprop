import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useClearAdminPlatformData,
  useGetAdminPlatformDataCleanupPreview,
} from '@workspace/api-client-react';
import { AlertTriangle, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const CONFIRMATION_PHRASE = 'DELETE ALL DASHBOARD DATA';

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const responseError = error as { data?: { error?: string }; message?: string };
    const message = responseError.data?.error ?? responseError.message;
    if (message && /<!doctype|<html[\s>]|<pre>/i.test(message)) {
      return 'The server returned an error. Review the refreshed counts before trying again.';
    }
    if (message) return message;
  }
  return 'The cleanup could not be completed. Review the refreshed counts before trying again.';
}

export default function DataCleanup() {
  const queryClient = useQueryClient();
  const previewQuery = useGetAdminPlatformDataCleanupPreview();
  const cleanupMutation = useClearAdminPlatformData();
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deletedCounts, setDeletedCounts] = useState<{
    properties: number;
    agents: number;
    buyers: number;
    branches: number;
    leads: number;
    demoBuyerLogins: number;
  } | null>(null);

  const counts = previewQuery.data?.counts;
  const totalRows = counts
    ? Object.values(counts).reduce((sum, count) => sum + count, 0)
    : 0;
  const isProduction = previewQuery.data?.environment === 'production';
  const canSubmit =
    isProduction &&
    confirmation === CONFIRMATION_PHRASE &&
    totalRows > 0 &&
    !cleanupMutation.isPending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDeletedCounts(null);

    if (!counts || !canSubmit) return;

    try {
      const result = await cleanupMutation.mutateAsync({
        data: {
          confirmation,
          expectedCounts: counts,
        },
      });
      setDeletedCounts(result.deletedCounts);
      setConfirmation('');
      await queryClient.invalidateQueries();
    } catch (caughtError) {
      setError(errorMessage(caughtError));
      setConfirmation('');
      await previewQuery.refetch();
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Production data cleanup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Permanently remove the records counted on the platform dashboard and their linked database history.
        </p>
      </div>

      <Card className="border-destructive/40">
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <CardTitle className="text-base">This cannot be undone</CardTitle>
              <CardDescription className="mt-1">
                The action removes all properties, agents, buyer records, branches, leads, and related database
                history, including genuine records. Administrator accounts are preserved.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {previewQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading the current counts…</p>
          )}

          {previewQuery.isError && (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
              Could not load the cleanup preview. Refresh the preview before continuing.
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-3"
                onClick={() => void previewQuery.refetch()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          )}

          {previewQuery.data && (
            <>
              {!isProduction && (
                <div role="status" className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
                  This is the development preview. The destructive action is disabled here and is available only
                  on the published production app.
                </div>
              )}

              <div className="rounded-lg border border-border">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold">Current records to be removed</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Preview source: {previewQuery.data.environment}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
                  {([
                    ['Properties', counts?.properties],
                    ['Agents', counts?.agents],
                    ['Buyer records', counts?.buyers],
                    ['Branches / agencies', counts?.branches],
                    ['Leads', counts?.leads],
                    ['Demo buyer logins', counts?.demoBuyerLogins],
                  ] as Array<[string, number | undefined]>).map(([label, value]) => (
                    <div key={label} className="bg-card px-4 py-3">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 text-lg font-semibold text-foreground">{value ?? 0}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Administrator accounts, including the current account, will remain.
                </p>
                <p className="mt-2">
                  Uploaded photos and files in object storage are not deleted by this action; their database links
                  will be removed with the listings.
                </p>
              </div>

              {deletedCounts && (
                <div role="status" className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
                  Cleanup completed. Removed {deletedCounts.properties} properties, {deletedCounts.agents} agents,{' '}
                  {deletedCounts.buyers} buyer records, {deletedCounts.branches} branches, {deletedCounts.leads} leads,
                  and {deletedCounts.demoBuyerLogins} demo buyer logins. Administrator accounts and uploaded files
                  were retained.
                </div>
              )}

              {error && (
                <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {error}
                </div>
              )}

              {totalRows > 0 && (
                <form onSubmit={handleSubmit} className="space-y-3 border-t border-border pt-5">
                  <label htmlFor="cleanup-confirmation" className="block text-sm font-medium">
                    Type <span className="font-mono text-destructive">{CONFIRMATION_PHRASE}</span> to confirm
                  </label>
                  <input
                    id="cleanup-confirmation"
                    autoComplete="off"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={CONFIRMATION_PHRASE}
                    disabled={!isProduction || cleanupMutation.isPending}
                  />
                  <Button type="submit" variant="destructive" disabled={!canSubmit}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {cleanupMutation.isPending ? 'Removing records…' : 'Delete all dashboard data'}
                  </Button>
                </form>
              )}

              {totalRows === 0 && (
                <p className="text-sm text-muted-foreground">There are no counted records to remove.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
