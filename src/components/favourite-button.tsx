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
  const icon = size === "md" ? "h-5 w-5" : "h-4 w-4";
  const box = size === "md" ? "h-10 w-10" : "h-8 w-8";

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
        "grid place-items-center rounded-full bg-background/90 shadow-sm backdrop-blur transition-transform active:scale-90",
        box,
        className,
      )}
    >
      <Heart
        className={cn(icon, saved ? "fill-rose-500 text-rose-500" : "text-muted-foreground")}
        strokeWidth={2}
      />
    </button>
  );
}
