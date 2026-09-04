import { useNavigate } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useFavouriteIds, useToggleFavourite } from "@/lib/favourites-api";

interface FavouriteButtonProps {
  taskId: string;
  /** Owner of the task. The button is hidden on your own tasks. */
  ownerId?: string;
  className?: string;
  size?: "sm" | "md";
}

export function FavouriteButton({ taskId, ownerId, className, size = "sm" }: FavouriteButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const ids = useFavouriteIds();
  const toggle = useToggleFavourite();

  if (user && ownerId && user.id === ownerId) return null;

  const saved = (ids.data ?? []).includes(taskId);
  const isMd = size === "md";
  // The outer button is the touch target (min 36 px); the inner circle is the visible element.
  const outer = isMd ? "h-10 w-10" : "h-9 w-9";
  const inner = isMd ? "h-8 w-8" : "h-6 w-6 sm:h-7 sm:w-7";
  const icon = isMd ? "h-4 w-4" : "h-3 w-3 sm:h-3.5 sm:w-3.5";

  return (
    <button
      type="button"
      aria-label={saved ? "Премахни от любими" : "Запази в любими"}
      aria-pressed={saved}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) {
          navigate({ to: "/auth", search: { mode: "login", redirect: window.location.pathname } });
          return;
        }
        // Грешката се показва централно от мутацията (виж favourites-api).
        toggle.mutate({ taskId, saved });

      }}
      className={cn(
        "grid place-items-center rounded-full transition-transform active:scale-90",
        outer,
        className,
      )}
    >
      <span
        className={cn(
          "grid place-items-center rounded-full bg-background/90 shadow-sm backdrop-blur",
          inner,
        )}
      >
        <Heart
          className={cn(icon, saved ? "fill-rose-500 text-rose-500" : "text-muted-foreground")}
          strokeWidth={2}
        />
      </span>
    </button>
  );
}
