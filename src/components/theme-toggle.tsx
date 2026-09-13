import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === "dark" ? "Включи светла тема" : "Включи тъмна тема";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? "default" : "icon"}
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
      className={cn(
        showLabel ? "h-auto w-full justify-start rounded-xl border border-border bg-background px-3 py-3" : "h-9 w-9 rounded-full",
        className,
      )}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={1.6} />
      {showLabel && <span>{theme === "dark" ? "Светла тема" : "Тъмна тема"}</span>}
    </Button>
  );
}