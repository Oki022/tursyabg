import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { AdminCard, AdminPage, EmptyState } from "@/components/admin/admin-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateBg } from "@/services/admin";
import { listContactMessages, setContactStatus, type ContactStatus } from "@/services/contact";

export const Route = createFileRoute("/admin/contact")({
  head: () => ({
    meta: [
      { title: "Съобщения от контактната форма | Админ" },
      { name: "description", content: "Обработвай запитвания и сигнали, изпратени през контактната форма." },
      { property: "og:title", content: "Съобщения от контактната форма" },
      { property: "og:description", content: "Поддръжка и сигнали от потребители." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminContact,
});

const STATUS_BG: Record<ContactStatus, string> = {
  new: "Ново",
  in_progress: "В обработка",
  closed: "Затворено",
};

function AdminContact() {
  const [status, setStatus] = useState<ContactStatus | "all">("new");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["admin", "contact", status],
    queryFn: () => listContactMessages(status === "all" ? undefined : status),
  });

  const update = useMutation({
    mutationFn: setContactStatus,
    onSuccess: () => {
      toast.success("Статусът е обновен.");
      void qc.invalidateQueries({ queryKey: ["admin", "contact"] });
      void qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
    onError: (e: unknown) => toastError(e, { title: "Статусът не беше обновен" }),
  });

  const rows = list.data ?? [];

  return (
    <AdminPage
      title="Контактна форма"
      description="Запитвания и сигнали от потребители. Всяко ново съобщение уведомява екипа."
      actions={
        <Select value={status} onValueChange={(v) => setStatus(v as ContactStatus | "all")}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">Нови</SelectItem>
            <SelectItem value="in_progress">В обработка</SelectItem>
            <SelectItem value="closed">Затворени</SelectItem>
            <SelectItem value="all">Всички</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <AdminCard>
        {rows.length === 0 ? (
          <EmptyState text="Няма съобщения в тази категория." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Подател</TableHead>
                <TableHead>Тема и съобщение</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id} id={`msg-${m.id}`} className="align-top scroll-mt-24">
                  <TableCell className="max-w-[220px]">
                    <SenderCell message={m} />
                  </TableCell>
                  <TableCell className="max-w-[420px]">
                    <div className="text-sm font-medium text-slate-900">{m.subject}</div>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{m.body}</p>
                    {m.adminNote && (
                      <p className="mt-1 text-xs italic text-slate-500">Бележка: {m.adminNote}</p>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-slate-600">
                    {formatDateBg(m.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded">
                      {STATUS_BG[m.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-[240px] space-y-2 text-right">
                    <Textarea
                      rows={2}
                      placeholder="Вътрешна бележка"
                      value={notes[m.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [m.id]: e.target.value }))}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={update.isPending || m.status === "in_progress"}
                        onClick={() =>
                          update.mutate({ id: m.id, status: "in_progress", note: notes[m.id] ?? "" })
                        }
                      >
                        Поемам
                      </Button>
                      <Button
                        size="sm"
                        disabled={update.isPending || m.status === "closed"}
                        onClick={() => update.mutate({ id: m.id, status: "closed", note: notes[m.id] ?? "" })}
                      >
                        Затвори
                      </Button>
                    </div>
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
