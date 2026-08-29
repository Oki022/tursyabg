import { useCanGoBack, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

/**
 * History-based back navigation. Goes to the previous page the user came from,
 * falling back to the homepage when there is no history (direct link/refresh).
 * Icon only, the label lives in aria-label for screen readers.
 */
export function BackLink({
  label = "Назад",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const canGoBack = useCanGoBack();

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        if (canGoBack) router.history.back();
        else void router.navigate({ to: "/" });
      }}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
