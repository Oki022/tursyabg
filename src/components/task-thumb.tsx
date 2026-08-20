import { ImageOff } from "lucide-react";
import { getCategory } from "@/lib/mock-data";

type Props = {
  /** Resolved (signed) URL of the task's first image, if it has one. */
  src?: string | null;
  /** Task category id, used to pick the placeholder icon. */
  category?: string | null;
  /** Task title, used for the alt text. */
  title: string;
  /** True when the task no longer exists: neutral placeholder instead of a category icon. */
  deleted?: boolean;
  className?: string;
  iconClassName?: string;
  loading?: "lazy" | "eager";
};

/**
 * Single place that decides what a task thumbnail looks like.
 * Real photo when there is one, category icon when the task has no images,
 * neutral icon when the task was deleted. Never a stock photo.
 */
export function TaskThumb({
  src,
  category,
  title,
  deleted = false,
  className = "",
  iconClassName = "h-1/2 w-1/2",
  loading = "lazy",
}: Props) {
  if (src && !deleted) {
    return (
      <img
        src={src}
        alt={title}
        loading={loading}
        decoding="async"
        className={`object-cover ${className}`}
      />
    );
  }

  const Icon = deleted || !category ? ImageOff : getCategory(category).icon;
  return (
    <span
      role="img"
      aria-label={title}
      className={`flex items-center justify-center bg-muted text-muted-foreground ${className}`}
    >
      <Icon className={iconClassName} aria-hidden="true" />
    </span>
  );
}
