type StarRatingProps = {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
};

const sizeClass = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-3xl',
};

export function StarRating({ rating, size = 'md', label }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={label ?? `${rating} out of 5 stars`}
    >
      {stars.map((star) => (
        <span
          key={star}
          className={`${sizeClass[size]} leading-none ${
            star <= rating ? 'text-purple-300' : 'text-purple-950/70'
          }`}
          aria-hidden
        >
          ★
        </span>
      ))}
    </div>
  );
}
