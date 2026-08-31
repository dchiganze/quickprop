import { Star } from "lucide-react";

export function RatingStars({
  rating,
  size = "h-4 w-4",
  interactive = false,
  selected,
  onSelect,
}: {
  rating?: number;
  size?: string;
  interactive?: boolean;
  selected?: number;
  onSelect?: (rating: number) => void;
}) {
  const activeRating = selected ?? rating ?? 0;

  return (
    <div
      className="flex items-center gap-1"
      role={interactive ? "radiogroup" : undefined}
      aria-label={interactive ? "Choose a rating from one to five stars" : `${rating ?? 0} out of 5 stars`}
      data-testid={interactive ? "rating-selector" : "rating-stars"}
    >
      {[1, 2, 3, 4, 5].map((value) => {
        const star = (
          <Star
            key={value}
            className={`${size} transition-transform ${value <= activeRating ? "fill-accent text-accent" : "text-border"} ${interactive ? "group-hover:scale-110" : ""}`}
            strokeWidth={value <= activeRating ? 1.5 : 1.8}
          />
        );

        if (!interactive) {
          return <span key={value} aria-hidden="true">{star}</span>;
        }

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={value === selected}
            aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
            onClick={() => onSelect?.(value)}
            className="group rounded-md p-1.5 outline-none transition-colors hover:bg-accent/15 focus-visible:ring-2 focus-visible:ring-ring"
            data-testid={`button-rating-${value}`}
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}

export function ReviewSummary({
  averageRating,
  reviewCount,
  compact = false,
}: {
  averageRating: number;
  reviewCount: number;
  compact?: boolean;
}) {
  if (!reviewCount) {
    return (
      <span className="text-sm text-muted-foreground" data-testid="text-no-reviews">
        No reviews yet
      </span>
    );
  }

  return (
    <div className={`flex items-center ${compact ? "gap-2" : "gap-3"}`} data-testid="review-summary">
      <RatingStars rating={averageRating} size={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      <span className={`${compact ? "text-sm" : "text-base"} font-semibold text-foreground`} data-testid="text-average-rating">
        {averageRating.toFixed(1)}
      </span>
      <span className="text-sm text-muted-foreground" data-testid="text-review-count">
        {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
      </span>
    </div>
  );
}