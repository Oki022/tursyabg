import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminCard, AdminPage, EmptyState } from "@/components/admin/admin-page";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateBg } from "@/services/admin";
import { useDeletionRequests } from "@/lib/account-api";

export const Route = createFileRoute("/admin/deletions")({
  head: () => ({
    meta: [
      { title: "Заявки за изтриване на профил | Админ" },
      { name: "description", content: "Проследявай заявките за изтриване на профил и 14-дневния гратисен период." },
      { property: "og:title", content: "Заявки за изтриване на профил" },
      { property: "og:description", content: "GDPR заявки за изтриване и техният статус." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDeletions,
});

const STATUS_BG: Record<string, string> = {
  pending: "Изчаква (гратисен период)",
  cancelled: "Отказана",
  completed: "Изпълнена",
};

function AdminDeletions() {
  const [status, setStatus] = useState<string>("pending");
  const list = useDeletionRequests(status === "all" ? undefined : status);
  const rows = list.data ?? [];

  return (
    <AdminPage
      title="Заявки за изтриване на профил"
      description="Заявките се изпълняват автоматично 14 дни след подаване. Профилът е деактивиран през целия период."
    >
      <AdminCard
        title={`Заявки (${rows.length})`}
        actions={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Изчакващи</SelectItem>
              <SelectItem value="completed">Изпълнени</SelectItem>
              <SelectItem value="cancelled">Отказани</SelectItem>
              <SelectItem value="all">Всички</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        {list.isLoading ? (
          <EmptyState text="Зареждане…" />
        ) : rows.length === 0 ? (
          <EmptyState text="Няма заявки за изтриване." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Потребител</TableHead>
                <TableHead>Заявено на</TableHead>
                <TableHead>Изтриване на</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name || "Без име"}</TableCell>
                  <TableCell>{formatDateBg(r.requested_at)}</TableCell>
                  <TableCell>{formatDateBg(r.scheduled_for)}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "pending" ? "secondary" : "outline"}>
                      {STATUS_BG[r.status] ?? r.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminCard>
    </AdminPage>
  );
}
