import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatarUrl } from "@/services/avatars";
import { cn } from "@/lib/utils";

/**
 * Аватар на потребител: снимка, ако има качена, иначе генериран градиент с
 * инициали. Градиентът се извежда от идентификатора, така че един и същ
 * човек винаги изглежда еднакво навсякъде в сайта.
 */

/** Топли, приглушени двойки в тона на марката (оранжево → розово). */
const PALETTE: [string, string][] = [
  ["#f97316", "#e11d48"],
  ["#fb923c", "#db2777"],
  ["#f59e0b", "#ea580c"],
  ["#ef4444", "#9f1239"],
  ["#f472b6", "#b45309"],
  ["#fb7185", "#c2410c"],
  ["#d97706", "#be123c"],
  ["#f87171", "#7c2d12"],
  ["#fbbf24", "#b91c1c"],
  ["#e879f9", "#c026d3"],
];

function hashOf(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function avatarGradient(seed: string): string {
  const pair = PALETTE[hashOf(seed || "anon") % PALETTE.length]!;
  const angle = 120 + (hashOf(`${seed}-a`) % 5) * 30;
  return `linear-gradient(${angle}deg, ${pair[0]} 0%, ${pair[1]} 100%)`;
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
  /** Идентификатор на потребителя — определя градиента. */
  userId?: string | null;
  name?: string | null;
  src?: string | null;
  /** Път в хранилището или готов адрес към снимката. */
  /** Tailwind класове за размера, например "h-16 w-16". */
  className?: string;
  /** Размер на текста, например "text-lg". */
  textClassName?: string;
  /** Добавя дискретна иконка на човек, за да се чете като профилна снимка. */
  withPersonIcon?: boolean;
};

export function UserAvatar({
  userId,
  name,
  src,
  className,
  textClassName,
  withPersonIcon,
}: Props) {
  const seed = userId || name || "anon";
  const { data: resolved } = useQuery({
    queryKey: ["avatar-url", src],
    queryFn: () => resolveAvatarUrl(src),
    enabled: Boolean(src),
    staleTime: 60 * 60 * 1000,
  });
  return (
    <Avatar
      className={cn(
        "shrink-0 shadow-[inset_0_1px_2px_rgba(255,255,255,0.35),0_1px_3px_rgba(15,23,42,0.18)] ring-1 ring-black/5",
        className,
      )}
    >
      {resolved ? <AvatarImage src={resolved} alt={name ?? "Профилна снимка"} /> : null}
      <AvatarFallback
        className={cn(
          "select-none font-semibold uppercase tracking-[0.06em] text-white",
          textClassName,
        )}
        style={{ backgroundImage: avatarGradient(seed) }}
      >
        <span className="-mr-[0.06em] leading-none">{avatarInitials(name)}</span>
      </AvatarFallback>
    </Avatar>
  );
}
