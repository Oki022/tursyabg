import { useQuery } from "@tanstack/react-query";
import { CircleUserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatarUrl } from "@/services/avatars";
import { cn } from "@/lib/utils";

/**
 * Аватар на потребител: снимка, ако има качена, иначе неутрална икона.
 * Плейсхолдерът е същата контурна икона на човек в кръг като бутона в
 * навигацията (CircleUserRound), върху мек неутрален фон — без инициали
 * и без градиенти, за да се чете като профилна снимка на сайта.
 */

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
        <span className="block h-full w-full translate-y-[12%] scale-110 overflow-hidden">
          <PersonSilhouette />
        </span>
      </AvatarFallback>
    </Avatar>
  );
}
