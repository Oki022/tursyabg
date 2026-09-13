import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark";
export type ThemeMode = "system" | Theme;

const STORAGE_KEY = "tursya-theme";
const TRANSITION_MS = 300;

type ThemeContextValue = {
  mode: ThemeMode;
  theme: Theme;
  cycleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function storedTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "dark" || value === "light" ? value : null;
}

function applyTheme(theme: Theme, animate: boolean) {
  const root = document.documentElement;
  if (animate) root.classList.add("transition-colors", "duration-300");
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#0f172a" : "#fff7ed",
  );
  if (animate) {
    window.setTimeout(() => root.classList.remove("transition-colors", "duration-300"), TRANSITION_MS);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = storedTheme();
    const initialMode: ThemeMode = stored ?? "system";
    const initialTheme = stored ?? systemTheme();
    setMode(initialMode);
    setTheme(initialTheme);
    applyTheme(initialTheme, false);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = (event: MediaQueryListEvent) => {
      if (storedTheme()) return;
      const next = event.matches ? "dark" : "light";
      setTheme(next);
      applyTheme(next, false);
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  const cycleTheme = useCallback(() => {
    setMode((currentMode) => {
      const nextMode: ThemeMode = currentMode === "system" ? "light" : currentMode === "light" ? "dark" : "system";
      if (nextMode === "system") {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, nextMode);
      }
      const nextTheme = nextMode === "system" ? systemTheme() : nextMode;
      setTheme(nextTheme);
      applyTheme(nextTheme, true);
      return nextMode;
    });
  }, []);

  const value = useMemo(() => ({ mode, theme, cycleTheme }), [mode, theme, cycleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}