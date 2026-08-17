import { useUnreadCount } from "@/lib/messages-api";
import { useAuth } from "@/lib/auth";

export function UnreadBadge({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const { data } = useUnreadCount(Boolean(user));
  const count = data ?? 0;
  if (!user || count <= 0) return null;
  return (
    <span
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-1 text-[10px] font-bold leading-none text-white ${className}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
