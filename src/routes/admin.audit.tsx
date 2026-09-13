import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminCard, AdminPage, EmptyState } from "@/components/admin/admin-page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACTION_TYPE_BG, formatDateBg, getAuditLog } from "@/services/admin";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Одит лог | Админ" },
      { name: "description", content: "Пълна история на административните действия в платформата." },
      { property: "og:title", content: "Одит лог" },
      { property: "og:description", content: "История на административните действия." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminAudit,
});

function AdminAudit() {
  const [admin, setAdmin] = useState("all");
  const [actionType, setActionType] = useState("all");

  const all = useQuery({ queryKey: ["admin", "audit", "all"], queryFn: () => getAuditLog({ admin: "all", actionType: "all" }) });
  const list = useQuery({ queryKey: ["admin", "audit", admin, actionType], queryFn: () => getAuditLog({ admin, actionType }) });

  const admins = useMemo(() => {
    const map = new Map<string, string>();
    (all.data ?? []).forEach((e) => map.set(e.adminId ?? "system", e.adminName));
    return [...map.entries()];
  }, [all.data]);

  const actionTypes = useMemo(
    () => [...new Set((all.data ?? []).map((e) => e.actionType))],
    [all.data],
  );

  const rows = list.data ?? [];

  return (
    <AdminPage
      title="Одит лог"
      description="Всяко административно действие се записва тук."
      actions={
        <div className="flex gap-2">
          <Select value={admin} onValueChange={setAdmin}>
            <SelectTrigger className="h-9 w-44 rounded-md bg-background"><SelectValue placeholder="Админ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всички админи</SelectItem>
              {admins.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger className="h-9 w-52 rounded-md bg-background"><SelectValue placeholder="Действие" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всички действия</SelectItem>
              {actionTypes.map((t) => <SelectItem key={t} value={t}>{ACTION_TYPE_BG[t] ?? t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <AdminCard>
        {list.isLoading ? (
          <EmptyState text="Зареждане…" />
        ) : rows.length === 0 ? (
          <EmptyState text="Няма записани действия." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Админ</TableHead>
                  <TableHead>Действие</TableHead>
                  <TableHead>Обект</TableHead>
                  <TableHead>Детайли</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateBg(e.createdAt)}</TableCell>
                    <TableCell className="font-medium text-foreground">{e.adminName}</TableCell>
                    <TableCell>{ACTION_TYPE_BG[e.actionType] ?? e.actionType}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.targetType}
                      <div className="font-mono text-[11px] text-slate-400">{e.targetId?.slice(0, 8) ?? "няма"}</div>
                    </TableCell>
                    <TableCell className="max-w-[360px] break-words font-mono text-[11px] text-muted-foreground">
                      {JSON.stringify(e.details)}
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
