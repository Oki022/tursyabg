export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} ЗадачаНет — Свържи се с хората, които могат да го свършат.
      </div>
    </footer>
  );
}