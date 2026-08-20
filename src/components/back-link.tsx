import { useCanGoBack, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

/**
 * History-based back navigation. Goes to the previous page the user came from,
 * falling back to the homepage when there is no history (direct link/refresh).
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
      onClick={() => {
        if (canGoBack) router.history.back();
        else void router.navigate({ to: "/" });
      }}
      className={`inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground ${className}`}
    >
      <ChevronLeft className="h-4 w-4" />
      {label}
    </button>
  );
}