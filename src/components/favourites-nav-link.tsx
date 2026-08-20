import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useFavouritesCount } from "@/lib/favourites-api";

/** Heart shortcut to /favourites, paired visually with the notification bell. */
export function FavouritesNavLink() {
  const { user } = useAuth();
  const { data } = useFavouritesCount();
  const count = data ?? 0;
  if (!user) return null;
  return (
    <Button asChild variant="ghost" size="icon" className="relative text-slate-700">
      <Link to="/favourites" aria-label="Любими задачи">
        <Heart className="h-5 w-5" strokeWidth={2.25} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Link>
    </Button>
  );
}
