import { Star } from "lucide-react";

export function ReviewStars({ rating, label, className = "size-4" }: { rating: number; label: string; className?: string }) {
  return (
    <span className="inline-flex gap-1 text-couture-red" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={className}
          fill={index < Math.round(rating) ? "currentColor" : "none"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
