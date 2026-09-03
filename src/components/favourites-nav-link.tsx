import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useFavouritesCount } from "@/lib/favourites-api";
import { cn } from "@/lib/utils";

/** Heart shortcut to /favourites. Shows a filled state when the user has saved tasks,
 *  but never a numeric badge — that would look like an unread indicator. */
export function FavouritesNavLink() {
  const { user } = useAuth();
  const { data } = useFavouritesCount();
  const hasFavourites = (data ?? 0) > 0;
  if (!user) return null;
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className={cn(
        "relative h-10 w-10 [&_svg]:size-7",
        hasFavourites
          ? "text-rose-500 hover:text-rose-600"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Link to="/favourites" aria-label="Любими задачи">
        <Heart
          className={cn("transition-colors", hasFavourites && "fill-current")}
          strokeWidth={1.6}
        />
      </Link>
    </Button>
  );
}
