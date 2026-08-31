import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { useParams, Link } from "wouter";
import { z } from "zod";
import {
  type AgentReviewResult,
  getGetPublicReviewInvitationQueryKey,
  useGetPublicReviewInvitation,
  useSubmitAgentReview,
} from "@workspace/api-client-react";
import { ArrowLeft, Check, Clock3, LockKeyhole, MessageSquare, ShieldCheck, Star, TriangleAlert } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RatingStars } from "@/components/review-rating";

const reviewSchema = z.object({
  rating: z.number().min(1, "Choose a rating to continue.").max(5),
  reviewText: z
    .string()
    .trim()
    .min(10, "Please share at least 10 characters.")
    .max(600, "Keep your review to 600 characters or fewer."),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

type ApiLikeError = {
  status?: number;
  data?: unknown;
  message?: string;
};

function getErrorStatus(error: unknown) {
  return (error as ApiLikeError | undefined)?.status;
}

function getErrorBodyStatus(error: unknown) {
  const data = (error as ApiLikeError | undefined)?.data;
  return data && typeof data === "object" && "status" in data && typeof data.status === "string"
    ? data.status
    : undefined;
}

function formatOutcome(outcome: string) {
  return outcome.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ReviewSkeleton() {
  return (
    <div className="grid animate-pulse gap-8 lg:grid-cols-[0.7fr_1.3fr]" data-testid="loading-review">
      <div className="space-y-5">
        <div className="h-3 w-24 rounded-full bg-secondary" />
        <div className="h-14 w-4/5 rounded-xl bg-secondary" />
        <div className="h-5 w-3/5 rounded-full bg-secondary" />
        <div className="h-36 rounded-2xl bg-secondary" />
      </div>
      <div className="h-[30rem] rounded-[2rem] bg-secondary" />
    </div>
  );
}

function ReviewState({
  kind,
  onRetry,
}: {
  kind: "invalid" | "expired" | "used" | "error";
  onRetry?: () => void;
}) {
  const content = {
    invalid: {
      icon: TriangleAlert,
      eyebrow: "Invitation not found",
      title: "This link does not look right.",
      body: "Check the link in your message and try again. If you still need help, contact the person who shared it with you.",
    },
    expired: {
      icon: Clock3,
      eyebrow: "Invitation expired",
      title: "This review link has timed out.",
      body: "Review invitations are one-time links with a limited window. Ask your agent to send a fresh invitation.",
    },
    used: {
      icon: Check,
      eyebrow: "Review already received",
      title: "Thank you — your review is already on its way.",
      body: "This invitation can only be used once. Your feedback is linked to a completed property mandate and helps other sellers choose with confidence.",
    },
    error: {
      icon: TriangleAlert,
      eyebrow: "Something went wrong",
      title: "We could not open this invitation.",
      body: "Please check your connection and try again. Your link remains private and can be opened later.",
    },
  }[kind];
  const Icon = content.icon;

  return (
    <div className="mx-auto max-w-xl rounded-[2rem] border border-border bg-card p-8 text-center shadow-[0_18px_60px_hsl(var(--primary)/0.08)] sm:p-12" data-testid={`status-review-${kind}`}>
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">{content.eyebrow}</p>
      <h1 className="font-display text-4xl leading-tight text-foreground">{content.title}</h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted-foreground">{content.body}</p>
      {onRetry && (
        <Button type="button" onClick={onRetry} className="mt-8" data-testid="button-retry-review">
          Try again
        </Button>
      )}
      <Link href="/agents" className="mt-5 block text-sm font-semibold text-primary hover:underline" data-testid="link-find-agent">
        Browse agents
      </Link>
    </div>
  );
}

export default function Review() {
  const params = useParams();
  const token = params.token || "";
  const invitationQuery = useGetPublicReviewInvitation(token, {
    query: { enabled: Boolean(token), queryKey: getGetPublicReviewInvitationQueryKey(token) },
  });
  const reviewMutation = useSubmitAgentReview();
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, reviewText: "" },
    mode: "onTouched",
  });
  const rating = form.watch("rating");
  const reviewText = form.watch("reviewText");
  const invitation = invitationQuery.data;
  const validInvitation = invitation as NonNullable<typeof invitation>;
  const [submitted, setSubmitted] = useState(false);
  const [submittedReview, setSubmittedReview] = useState<AgentReviewResult["review"] | null>(null);
  const queryStatus = getErrorStatus(invitationQuery.error);
  const queryBodyStatus = getErrorBodyStatus(invitationQuery.error);
  const mutationStatus = getErrorStatus(reviewMutation.error);
  const mutationBodyStatus = getErrorBodyStatus(reviewMutation.error);
  const invitationStatus = invitation?.status as string | undefined;
  const invitationHasExpired = Boolean(invitation?.expiresAt && new Date(invitation.expiresAt).getTime() < Date.now());

  const onSubmit = (values: ReviewFormValues) => {
    reviewMutation.mutate(
      { token, data: { rating: values.rating, reviewText: values.reviewText.trim() } },
      {
        onSuccess: (result) => {
          if (result.success) {
            setSubmittedReview(result.review);
            setSubmitted(true);
          }
        },
      },
    );
  };

  const body = invitationQuery.isLoading ? (
    <ReviewSkeleton />
  ) : invitationQuery.isError ? (
    <ReviewState
      kind={queryBodyStatus === "used" || queryStatus === 409 ? "used" : queryStatus === 410 ? "expired" : queryStatus === 404 ? "invalid" : "error"}
      onRetry={queryStatus !== 404 && queryStatus !== 409 && queryStatus !== 410 ? () => invitationQuery.refetch() : undefined}
    />
  ) : invitationStatus === "expired" || invitationHasExpired ? (
    <ReviewState kind="expired" />
  ) : invitationStatus === "used" || invitationStatus === "already_used" ? (
    <ReviewState kind="used" />
  ) : invitationStatus !== "available" ? (
    <ReviewState kind="invalid" />
  ) : submitted ? (
    <div className="mx-auto max-w-2xl rounded-[2rem] border border-border bg-card p-8 text-center shadow-[0_18px_60px_hsl(var(--primary)/0.08)] sm:p-14" data-testid="status-review-success">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-8 w-8" strokeWidth={2.5} />
      </div>
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">Review received</p>
      <h1 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">Your words matter.</h1>
      <p className="mx-auto mt-5 max-w-lg text-base leading-8 text-muted-foreground">
        Thank you for recognising {validInvitation.agent.name}. Your verified review will help future property owners find the right guidance.
      </p>
      {submittedReview && (
        <div className="mx-auto mt-7 flex max-w-sm items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3" data-testid="status-submitted-review">
          <RatingStars rating={submittedReview.rating} size="h-4 w-4" />
          <span className="text-sm font-semibold text-foreground">{submittedReview.rating}.0 rating recorded</span>
        </div>
      )}
      <div className="mx-auto mt-8 flex max-w-sm items-center gap-3 rounded-xl bg-secondary p-4 text-left">
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
        <span className="text-xs leading-5 text-muted-foreground">Your review is tied to a completed mandate and marked as verified.</span>
      </div>
      <Link href={`/agents`} className="mt-8 inline-block text-sm font-semibold text-primary hover:underline" data-testid="link-return-agents">
        Continue exploring agents
      </Link>
    </div>
  ) : (
    <div className="grid items-start gap-8 lg:grid-cols-[0.72fr_1.28fr]">
      <aside className="space-y-5 lg:sticky lg:top-24" data-testid="review-invitation-context">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          <ShieldCheck className="h-4 w-4" />
          Verified invitation
        </div>
        <div>
          <p className="text-sm text-muted-foreground">A note for</p>
          <h1 className="mt-2 font-display text-5xl leading-[0.95] text-foreground sm:text-6xl" data-testid="text-agent-name">
            {validInvitation.agent.name}
          </h1>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/60 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Completed mandate</p>
          <p className="mt-3 text-sm font-semibold text-foreground" data-testid="text-property-reference">{validInvitation.property.reference}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground" data-testid="text-property-title">{validInvitation.property.title}</p>
          <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-primary" />
            {formatOutcome(validInvitation.outcome)}
          </div>
        </div>
        <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          One response per invitation. No account needed.
        </p>
      </aside>

      <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[0_18px_60px_hsl(var(--primary)/0.08)] sm:p-10" data-testid="review-form-card">
        <div className="mb-8">
          <p className="text-sm font-semibold text-primary">A quick reflection</p>
          <h2 className="mt-2 font-display text-4xl leading-tight text-foreground sm:text-5xl">How did it feel to work together?</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">A few honest words are more useful than a perfect paragraph.</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-8">
          <div>
            <Label className="text-sm font-semibold text-foreground">Your overall experience</Label>
            <div className="mt-3 flex items-center gap-2">
              <RatingStars interactive selected={rating} onSelect={(value) => form.setValue("rating", value, { shouldValidate: true, shouldTouch: true })} />
              <span className="ml-2 text-sm text-muted-foreground" data-testid="text-rating-label">
                {rating ? `${rating} out of 5` : "Select a rating"}
              </span>
            </div>
            {form.formState.errors.rating && <p className="mt-2 text-sm text-destructive" data-testid="validation-error-rating">{form.formState.errors.rating.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="review-text" className="text-sm font-semibold text-foreground">Your review</Label>
              <span className={`text-xs ${reviewText.length > 600 ? "text-destructive" : "text-muted-foreground"}`} data-testid="text-review-character-count">
                {reviewText.length}/600
              </span>
            </div>
            <Textarea
              id="review-text"
              placeholder="What did your agent do particularly well?"
              rows={7}
              {...form.register("reviewText")}
              className="mt-3 resize-none rounded-xl border-border bg-background p-4 text-sm leading-6"
              data-testid="input-review-text"
            />
            {form.formState.errors.reviewText && <p className="mt-2 text-sm text-destructive" data-testid="validation-error-review-text">{form.formState.errors.reviewText.message}</p>}
          </div>

          {reviewMutation.isError && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive" role="alert" data-testid={`status-review-submit-${mutationStatus === 409 ? "already-used" : mutationStatus === 422 || mutationStatus === 400 ? "validation-error" : "error"}`}>
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {mutationBodyStatus === "used" || mutationStatus === 409
                  ? "This invitation has already been used."
                  : mutationStatus === 410 && mutationBodyStatus !== "used"
                    ? "This invitation has expired or has already been used."
                    : mutationStatus === 422 || mutationStatus === 400
                    ? "Please check your rating and review, then try again."
                    : "We could not submit your review. Please try again."}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs leading-5 text-muted-foreground">
              <MessageSquare className="h-4 w-4 text-primary" />
              Usually takes less than a minute
            </p>
            <Button type="submit" size="lg" disabled={reviewMutation.isPending} className="w-full rounded-xl sm:w-auto" data-testid="button-submit-review">
              {reviewMutation.isPending ? "Sending review…" : "Submit review"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="border-b border-border bg-secondary/30">
        <div className="container mx-auto flex h-12 items-center px-4">
          <Link href="/agents" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary" data-testid="link-review-back">
            <ArrowLeft className="h-3.5 w-3.5" />
            Agent directory
          </Link>
        </div>
      </div>
      <section className="container mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-16">
        <div className="mb-10 max-w-xl">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            <Star className="h-4 w-4 fill-accent text-accent" />
            QuickProp recognition
          </div>
          <p className="text-sm leading-6 text-muted-foreground">A private invitation to publicly recognise the professional who guided your property journey.</p>
        </div>
        {body}
      </section>
    </Layout>
  );
}