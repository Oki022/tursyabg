import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminCard, AdminPage, EmptyState } from "@/components/admin/admin-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adjustCredits, formatDateBg, getAdminUsers, setBan, setModerator, type AdminUser } from "@/services/admin";
import { formatEur } from "@/services/credits";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Потребители | Админ" },
      { name: "description", content: "Търсене на потребители, корекция на кредити, блокиране и роли." },
      { property: "og:title", content: "Потребители" },
      { property: "og:description", content: "Управление на потребителите на платформата." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminUsers,
});

function AdminUsers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [creditsTarget, setCreditsTarget] = useState<AdminUser | null>(null);
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const list = useQuery({ queryKey: ["admin", "users", query], queryFn: () => getAdminUsers(query) });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["admin"] });

  const errorText = (e: Error) =>
    ({
      FORBIDDEN: "Нямаш права за това действие.",
      INVALID_INPUT: "Въведи валидна стойност и причина.",
      REASON_REQUIRED: "Причината е задължителна.",
      SELF: "Не можеш да блокираш собствения си профил.",
      LAST_ADMIN: "Това е последният администратор — профилът не може да бъде блокиран.",
      USER_NOT_FOUND: "Потребителят не е намерен.",
    })[e.message] ?? "Действието не беше изпълнено.";

  const mCredits = useMutation({
    mutationFn: () => adjustCredits(creditsTarget!.id, Number(amount), reason),
    onSuccess: () => { toast.success("Балансът е коригиран."); setCreditsTarget(null); setAmount(""); setReason(""); invalidate(); },
    onError: (e: Error) => toast.error(errorText(e)),
  });

  const mBan = useMutation({
    mutationFn: () => setBan(banTarget!.id, !banTarget!.bannedAt, reason),
    onSuccess: () => {
      toast.success(banTarget?.bannedAt ? "Профилът е възстановен." : "Профилът е блокиран.");
      setBanTarget(null); setReason(""); invalidate();
    },
    onError: (e: Error) => toast.error(errorText(e)),
  });

  const mRole = useMutation({
    mutationFn: (v: { id: string; grant: boolean }) => setModerator(v.id, v.grant),
    onSuccess: () => { toast.success("Ролята е обновена."); invalidate(); },
    onError: (e: Error) => toast.error(errorText(e)),
  });

  const rows = list.data ?? [];

  return (
    <AdminPage
      title="Потребители"
      description="Търси по име или имейл. Всяко действие се записва в одит лога."
      actions={
        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); setQuery(search); }}
        >
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="име или имейл" className="h-9 w-56 rounded-md bg-white" />
          <Button type="submit" size="sm" className="h-9 rounded-md">Търси</Button>
        </form>
      }
    >
      <AdminCard>
        {list.isLoading ? (
          <EmptyState text="Зареждане…" />
        ) : rows.length === 0 ? (
          <EmptyState text="Няма намерени потребители." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Потребител</TableHead>
                  <TableHead>Регистрация</TableHead>
                  <TableHead className="text-right">Задачи</TableHead>
                  <TableHead className="text-right">Кредити</TableHead>
                  <TableHead className="text-right">Отключвания</TableHead>
                  <TableHead className="text-right">Похарчени / Платени</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{u.fullName ?? "Без име"}</span>
                        {u.isAdmin && <Badge className="rounded bg-slate-900">админ</Badge>}
                        {u.isModerator && <Badge variant="secondary" className="rounded">модератор</Badge>}
                        {u.bannedAt && <Badge className="rounded bg-rose-600">блокиран</Badge>}
                        {u.refundFlagged && (
                          <Badge
                            variant="outline"
                            className="rounded border-amber-300 text-amber-700"
                            title={`${u.refundCount} заявки от ${u.unlockCount} отключвания`}
                          >
                            висок дял връщания
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{u.email ?? "няма"}</div>
                      {u.banReason ? <div className="text-xs text-rose-600">{u.banReason}</div> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">{formatDateBg(u.createdAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{u.taskCount}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{u.credits}</TableCell>
                    <TableCell className="text-right tabular-nums">{u.unlockCount}</TableCell>
                    <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-600">
                      {u.totalSpentCredits} кр. / {formatEur(u.totalPaidEur)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="h-8 rounded-md" onClick={() => { setCreditsTarget(u); setAmount(""); setReason(""); }}>
                          Кредити
                        </Button>
                        {!u.isAdmin && (
                          <Button size="sm" variant="outline" className="h-8 rounded-md" onClick={() => mRole.mutate({ id: u.id, grant: !u.isModerator })}>
                            {u.isModerator ? "Отнеми модератор" : "Направи модератор"}
                          </Button>
                        )}
                        {!u.isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 rounded-md text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => { setBanTarget(u); setReason(""); }}
                          >
                            {u.bannedAt ? "Отблокирай" : "Блокирай"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AdminCard>

      <Dialog open={Boolean(creditsTarget)} onOpenChange={(o) => !o && setCreditsTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Корекция на кредити</DialogTitle>
            <DialogDescription>
              {creditsTarget?.fullName ?? "Потребител"}, текущ баланс {creditsTarget?.credits} кредита. Положително число добавя, отрицателно отнема.
            </DialogDescription>
          </DialogHeader>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="напр. 10 или -5" className="rounded-md" />
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Причина (задължителна)" />
          <DialogFooter>
            <Button variant="outline" className="rounded-md" onClick={() => setCreditsTarget(null)}>Отказ</Button>
            <Button className="rounded-md" disabled={!reason.trim() || !Number(amount) || mCredits.isPending} onClick={() => mCredits.mutate()}>
              Приложи
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(banTarget)} onOpenChange={(o) => !o && setBanTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{banTarget?.bannedAt ? "Отблокирай потребител" : "Блокирай потребител"}</DialogTitle>
            <DialogDescription>
              {banTarget?.bannedAt
                ? "Потребителят ще може отново да влиза и да публикува задачи."
                : "Достъпът се блокира и задачите му се скриват от публичния списък."}
            </DialogDescription>
          </DialogHeader>
          {!banTarget?.bannedAt && (
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Причина (задължителна)" />
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-md" onClick={() => setBanTarget(null)}>Отказ</Button>
            <Button
              variant={banTarget?.bannedAt ? "default" : "destructive"}
              className="rounded-md"
              disabled={mBan.isPending || (!banTarget?.bannedAt && !reason.trim())}
              onClick={() => mBan.mutate()}
            >
              {banTarget?.bannedAt ? "Отблокирай" : "Блокирай"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
