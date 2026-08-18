import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { AdminCard, AdminPage, EmptyState } from "@/components/admin/admin-page";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateBg, getAdminPayments } from "@/services/admin";
import { formatEur } from "@/services/credits";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({
    meta: [
      { title: "Плащания | Админ" },
      { name: "description", content: "Всички плащания със статус, сума, доставчик и потребител." },
      { property: "og:title", content: "Плащания" },
      { property: "og:description", content: "Преглед на плащанията на платформата." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPayments,
});

const STATUS_BG: Record<string, string> = {
  pending: "Чакащо",
  completed: "Успешно",
  refunded: "Възстановено",
  disputed: "Оспорено",
  failed: "Неуспешно",
};

function AdminPayments() {
  const list = useQuery({ queryKey: ["admin", "payments"], queryFn: getAdminPayments });
  const rows = list.data ?? [];

  return (
    <AdminPage title="Плащания" description="Само за преглед.">
      <AdminCard>
        {list.isLoading ? (
          <EmptyState text="Зареждане…" />
        ) : rows.length === 0 ? (
          <EmptyState text="Няма плащания." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Потребител</TableHead>
                  <TableHead className="text-right">Кредити</TableHead>
                  <TableHead className="text-right">Сума</TableHead>
                  <TableHead>Доставчик</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Детайли</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">{formatDateBg(p.createdAt)}</TableCell>
                    <TableCell className="font-medium text-slate-900">{p.userName}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.credits}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEur(p.amountEur)}</TableCell>
                    <TableCell className="text-xs uppercase text-slate-500">{p.provider}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "completed" ? "default" : "secondary"} className="rounded">
                        {STATUS_BG[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.provider === "stripe" && p.paymentIntentId ? (
                        <a
                          href={`https://dashboard.stripe.com/test/payments/${p.paymentIntentId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:underline"
                        >
                          Виж <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">няма</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AdminCard>
    </AdminPage>
  );
}
