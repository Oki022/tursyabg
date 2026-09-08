import { cn } from "@/lib/utils";

/**
 * Име на потребител в админ панела, което води към публичния му профил.
 * Отваря се в нов раздел, за да не се губи мястото в списъка.
 */
export function AdminUserLink({
  id,
  name,
  className,
  fallback = "Потребител",
}: {
  id?: string | null;
  name?: string | null;
  className?: string;
  fallback?: string;
}) {
  const label = (name ?? "").trim() || fallback;
  if (!id) return <span className={className}>{label}</span>;
  return (
    <a
      href={`/user/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Отвори публичния профил в нов раздел"
      className={cn("underline decoration-dotted underline-offset-2 hover:text-primary", className)}
    >
      {label}
    </a>
  );
}
