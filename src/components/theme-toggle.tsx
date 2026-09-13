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
      <Button
        type="button"
        variant="ghost"
        onClick={cycleTheme}
        aria-label={nextLabel}
        className={cn(
          "h-auto w-full justify-start gap-3 rounded-xl border border-border bg-background px-3 py-3 hover:bg-accent/40",
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
          onClick={(event) => event.preventDefault()}
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none"
        />
      </Button>
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