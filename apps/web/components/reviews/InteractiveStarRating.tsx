'use client';

type InteractiveStarRatingProps = {
  rating: number;
  hoverRating: number;
  onSelect: (rating: number) => void;
  onHover: (rating: number) => void;
  onHoverEnd: () => void;
  disabled?: boolean;
  labelledBy?: string;
};

export function InteractiveStarRating({
  rating,
  hoverRating,
  onSelect,
  onHover,
  onHoverEnd,
  disabled = false,
  labelledBy,
}: InteractiveStarRatingProps) {
  const display = hoverRating || rating;

  return (
    <div
      id="star-rating"
      className="flex gap-2"
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : 'Star rating'}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(star)}
          onMouseEnter={() => onHover(star)}
          onMouseLeave={onHoverEnd}
          role="radio"
          aria-checked={rating === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          className="min-h-12 min-w-12 rounded-xl text-3xl leading-none transition disabled:opacity-50 sm:text-4xl"
        >
          <span
            className={
              star <= display ? 'text-purple-300' : 'text-purple-950/70'
            }
            aria-hidden
          >
            ★
          </span>
        </button>
      ))}
    </div>
  );
}
