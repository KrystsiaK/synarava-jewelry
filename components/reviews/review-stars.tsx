import { Star } from "@phosphor-icons/react/ssr";

export function ReviewStars({ rating, label, className = "size-4" }: { rating: number; label: string; className?: string }) {
  return (
    <span className="inline-flex gap-1 text-couture-red" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={className}
          weight={index < Math.round(rating) ? "fill" : "regular"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
