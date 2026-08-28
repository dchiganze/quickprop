import React, { useEffect, useState } from 'react';
import { useListDuplicateReviews } from '@workspace/api-client-react';
import { AlertTriangle, Check, GitMerge, HelpCircle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

async function applyReviewAction(id: number, action: string, canonicalPropertyId?: number) {
  const response = await fetch(`/api/admin/duplicates/${id}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: canonicalPropertyId ? JSON.stringify({ canonicalPropertyId }) : JSON.stringify({}),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export default function Duplicates() {
  const { data, isLoading, refetch } = useListDuplicateReviews();
  const [mergedReviews, setMergedReviews] = useState<NonNullable<typeof data>>([]);
  const { toast } = useToast();

  const refreshMergedReviews = async () => {
    const response = await fetch('/api/admin/duplicates?status=merged');
    if (response.ok) setMergedReviews(await response.json());
  };

  useEffect(() => {
    void refreshMergedReviews();
  }, []);

  const act = async (id: number, action: string, canonicalPropertyId?: number) => {
    try {
      await applyReviewAction(id, action, canonicalPropertyId);
      toast({ title: action === 'merge' ? 'Properties merged' : action === 'unmerge' ? 'Merge reversed' : 'Review updated' });
      await Promise.all([refetch(), refreshMergedReviews()]);
    } catch {
      toast({ title: 'Could not update duplicate review', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Duplicate Review</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Resolve possible duplicate property records without losing history, leads or media attribution.
        </p>
      </div>
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-36 w-full" />)}</div>
      ) : data?.length ? (
        <div className="space-y-4">
          {data.map((review) => {
            const source = review.sourceProperty;
            const candidate = review.candidateProperty;
            return (
              <Card key={review.id} className="border-amber-200/70">
                <CardHeader className="pb-3 flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      {source?.title ?? `Property #${review.sourcePropertyId}`}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Candidate: {candidate?.title ?? `Property #${review.candidatePropertyId}`}
                    </p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                    {Math.round(review.confidenceScore)}% match
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    {[source, candidate].map((property, index) => (
                      <div key={index} className="rounded-lg bg-muted/40 p-3">
                        <p className="font-mono text-xs text-muted-foreground">{property?.reference ?? '—'}</p>
                        <p className="font-medium">{property?.address || property?.suburb || 'Location unavailable'}</p>
                        <p className="text-muted-foreground">{property?.currency} {Number(property?.price ?? 0).toLocaleString()} · {property?.photos?.length ?? 0} photos</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground mr-auto">
                      Matching: {review.matchingFields.join(', ')}
                    </span>
                    <Button size="sm" onClick={() => act(review.id, 'merge', review.candidatePropertyId)}>
                      <GitMerge className="w-3.5 h-3.5 mr-1.5" /> Merge into candidate
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => act(review.id, 'merge', review.sourcePropertyId)}>
                      <GitMerge className="w-3.5 h-3.5 mr-1.5" /> Keep source canonical
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => act(review.id, 'keep-separate')}>
                      <X className="w-3.5 h-3.5 mr-1.5" /> Keep separate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => act(review.id, 'request-information')}>
                      <HelpCircle className="w-3.5 h-3.5 mr-1.5" /> Request info
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Check className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
            <h2 className="font-semibold">No duplicate reviews waiting</h2>
            <p className="text-sm text-muted-foreground mt-1">New possible matches will appear here for a reversible decision.</p>
          </CardContent>
        </Card>
      )}
      {mergedReviews.length > 0 && (
        <div className="space-y-3 pt-2">
          <div>
            <h2 className="text-base font-semibold">Merged history</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Reverse a merge to restore the source property and its operational records.
            </p>
          </div>
          {mergedReviews.map((review) => {
            const source = review.sourceProperty;
            const candidate = review.candidateProperty;
            return (
              <Card key={review.id} className="border-blue-200/70">
                <CardContent className="py-4 flex flex-wrap items-center gap-3">
                  <div className="mr-auto">
                    <p className="font-medium">
                      {source?.reference ?? `Property #${review.sourcePropertyId}`}
                      <span className="text-muted-foreground font-normal"> merged into </span>
                      {candidate?.reference ?? `Property #${review.candidatePropertyId}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      The canonical property remains available after reversal.
                    </p>
                  </div>
                  <Badge variant="outline">Merged</Badge>
                  <Button size="sm" variant="outline" onClick={() => act(review.id, 'unmerge')}>
                    <GitMerge className="w-3.5 h-3.5 mr-1.5" /> Unmerge
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}