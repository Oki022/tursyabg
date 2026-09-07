import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatarUrl } from "@/services/avatars";
import { cn } from "@/lib/utils";

/**
 * Аватар на потребител: снимка, ако има качена, иначе неутрален силует.
 * Силуетът е един и същ за всички — спокоен сив кръг със светла фигура,
 * който се чете като стандартна профилна снимка, а не като украса.
 */

/** Плътен силует (глава и рамене), който запълва кръга. */
function PersonSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn("h-full w-full", className)}>
      <circle cx="24" cy="18" r="8.4" fill="currentColor" />
      <path
        d="M8.6 43.2c1.4-8.3 8-13.4 15.4-13.4s14 5.1 15.4 13.4c.2 1.1-.6 2-1.6 2H10.2c-1 0-1.8-.9-1.6-1.8z"
        fill="currentColor"
      />
    </svg>
  );
}

export function avatarInitials(name?: string | null): string {
  const parts = (name ?? "")
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

type Props = {
  /** Идентификатор на потребителя (запазен за съвместимост). */
  userId?: string | null;
  name?: string | null;
  /** Път в хранилището или готов адрес към снимката. */
  src?: string | null;
  /** Tailwind класове за размера, например "h-16 w-16". */
  className?: string;
  /** Запазено за съвместимост — вече не се използва. */
  textClassName?: string;
  /** Запазено за съвместимост — силуетът се показва винаги. */
  withPersonIcon?: boolean;
};

export function UserAvatar({ userId: _userId, name, src, className }: Props) {
  const { data: resolved } = useQuery({
    queryKey: ["avatar-url", src],
    queryFn: () => resolveAvatarUrl(src),
    enabled: Boolean(src),
    staleTime: 60 * 60 * 1000,
  });
  return (
    <Avatar className={cn("shrink-0 ring-1 ring-black/5", className)}>
      {resolved ? <AvatarImage src={resolved} alt={name ?? "Профилна снимка"} /> : null}
      <AvatarFallback className="select-none bg-slate-200 text-slate-500">
        <span className="block h-[86%] w-[86%] translate-y-[7%] overflow-hidden">
          <PersonSilhouette />
        </span>
      </AvatarFallback>
    </Avatar>
  );
}
