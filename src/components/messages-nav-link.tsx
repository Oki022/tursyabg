import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useUnreadCount } from "@/lib/messages-api";

/** Compact messages shortcut with unread badge, paired with the heart icon. Desktop only (mobile uses the bottom nav). */
export function MessagesNavLink() {
  const { user } = useAuth();
  const { data } = useUnreadCount(Boolean(user));
  const count = data ?? 0;
  if (!user) return null;
  return (
    <Button asChild variant="ghost" size="icon" className="relative hidden h-9! w-9! text-slate-700 [&_svg]:size-[22px] md:inline-flex">
      <Link to="/messages" aria-label="Съобщения">
        <MessageCircle strokeWidth={1.6} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Link>
    </Button>
  );
}
