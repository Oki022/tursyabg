import { createFileRoute, Link } from "@tanstack/react-router";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/billing/cancel")({
  head: () => ({
    meta: [
      { title: "Плащането е прекратено | ТърсяБГ" },
      { name: "description", content: "Плащането не беше завършено. Можеш да опиташ отново по всяко време." },
      { property: "og:title", content: "Плащането е прекратено | ТърсяБГ" },
      { property: "og:description", content: "Плащането не беше завършено, нищо не е таксувано." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BillingCancelPage,
});

function BillingCancelPage() {
  return (
    <div className="container mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <XCircle className="h-12 w-12 text-muted-foreground" />
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Плащането е прекратено</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Нищо не е таксувано и балансът ти остава непроменен. Можеш да опиташ отново, когато си готов.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/settings/billing">Обратно към пакетите</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/tasks">Разгледай задачите</Link>
        </Button>
      </div>
    </div>
  );
}