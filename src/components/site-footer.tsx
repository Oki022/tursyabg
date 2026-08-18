import { Link } from "@tanstack/react-router";
import { Logo, BRAND_NAME } from "@/components/Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container mx-auto flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground">
        <Logo size="sm" />
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link to="/terms" className="hover:text-foreground hover:underline">
            Общи условия
          </Link>
          <Link to="/privacy" className="hover:text-foreground hover:underline">
            Политика за поверителност
          </Link>
          <Link to="/refund-policy" className="hover:text-foreground hover:underline">
            Връщане на кредити
          </Link>
        </nav>
        <p>© {new Date().getFullYear()} {BRAND_NAME} — Свържи се с хората, които могат да го свършат.</p>
      </div>
    </footer>
  );
}