import { Star } from "lucide-react";
import { Link } from "@tanstack/react-router";

/** Read-only star row. */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5" aria-label={`${value} от 5 звезди`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}
        />
      ))}
    </span>
  );
}

/**
 * Compact rating next to a name. Users without reviews read as "Нов потребител"
 * instead of an empty zero-star row.
 */
export function RatingInline({
  rating,
  count,
  className = "",
  size = 12,
}: {
  rating?: number | null;
  count?: number | null;
  className?: string;
  size?: number;
}) {
  if (!rating || !count) {
    return (
      <span className={`inline-flex items-center text-[11px] text-muted-foreground ${className}`}>
        Нов потребител
      </span>
    );
  }
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground ${className}`}>
      <Star style={{ width: size, height: size }} className="shrink-0 fill-amber-400 text-amber-400" />
      <span className="font-semibold text-foreground">{rating.toFixed(1).replace(".", ",")}</span>
      <span className="truncate">({count})</span>
    </span>
  );
}

export function ProfileLink({
  userId,
  children,
  className = "",
}: {
  userId: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link to="/user/$id" params={{ id: userId }} className={className}>
      {children}
    </Link>
  );
}

/** Large tappable star selector for the review form. */
export function StarSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-1 sm:justify-start sm:gap-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          aria-label={`${i} звезди`}
          aria-pressed={value === i}
          onClick={() => onChange(i)}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-14 sm:w-14"
        >
          <Star
            className={`h-8 w-8 sm:h-9 sm:w-9 ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
          />
        </button>
      ))}
    </div>
  );
}