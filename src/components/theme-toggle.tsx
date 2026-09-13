import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const { mode, theme, cycleTheme } = useTheme();
  const stateLabel = mode === "system" ? "Системна" : mode === "light" ? "Светла" : "Тъмна";
  const nextLabel = `Тема: ${stateLabel}. Смени режима`;
  const Icon = theme === "dark" ? Sun : Moon;

  if (showLabel) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={cycleTheme}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            cycleTheme();
          }
        }}
        aria-label={nextLabel}
        className={cn(
          "flex h-auto w-full cursor-pointer items-center justify-start gap-3 rounded-xl border border-border bg-background px-3 py-3 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-medium text-foreground">Тема</span>
          <span className="block text-xs font-normal text-muted-foreground">{stateLabel}</span>
        </span>
        <Switch
          checked={theme === "dark"}
          onCheckedChange={cycleTheme}
          onClick={(event) => event.stopPropagation()}
          aria-label={nextLabel}
        />
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      aria-label={nextLabel}
      title={nextLabel}
      className={cn("h-9 w-9 rounded-full", className)}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={1.6} />
    </Button>
  );
}