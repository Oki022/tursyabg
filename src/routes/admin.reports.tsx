import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AdminCard, AdminPage, EmptyState } from "@/components/admin/admin-page";
import { AdminUserLink } from "@/components/admin/user-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRevenueMonths, getRevenuePayments, type RevenueMonth } from "@/services/admin";
import { formatEur } from "@/services/credits";
import {
  KIND_BG,
  REVENUE_STATUS_BG,
  downloadCsv,
  inSofiaMonth,
  monthLabelBg,
  revenueCsv,
  sofiaDateTime,
} from "@/lib/revenue-report";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Отчети | Админ" },
      { name: "description", content: "Приходи по месеци и списък на плащанията за счетоводството." },
      { property: "og:title", content: "Отчети" },
      { property: "og:description", content: "Приходи по месеци." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Money data is for admins only; the database checks this again.
  beforeLoad: ({ context }) => {
    if (!context.staff.isAdmin) throw redirect({ to: "/admin" });
  },
  component: AdminReports,
});

const MONTHS = 12;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <AdminCard className="p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </AdminCard>
  );
}

function AdminReports() {
  const months = useQuery({ queryKey: ["admin", "revenue", "months"], queryFn: () => getRevenueMonths(MONTHS) });
  const list = months.data ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const month = selected ?? list[0]?.month ?? null;
  const summary: RevenueMonth | undefined = list.find((m) => m.month === month);

  const payments = useQuery({
    queryKey: ["admin", "revenue", "payments", month],
    queryFn: () => getRevenuePayments(month as string),
    enabled: !!month,
  });
  const rows = payments.data ?? [];

  const exportCsv = () => {
    if (!month || !payments.data) return;
    if (payments.data.length === 0) {
      toast.info("Няма плащания за този месец.");
      return;
    }
    downloadCsv(revenueCsv(payments.data, month), `tursya-prihodi-${month.slice(0, 7)}.csv`);
  };

  return (
    <AdminPage
      title="Отчети"
      description="Приходи по месеци, по българско време. Плащането се брои в месеца, в който е платено, а възстановяването — в месеца, в който е върнато."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={month ?? undefined} onValueChange={setSelected} disabled={list.length === 0}>
            <SelectTrigger className="w-[180px]" aria-label="Месец">
              <SelectValue placeholder="Месец" />
            </SelectTrigger>
            <SelectContent>
              {list.map((m) => (
                <SelectItem key={m.month} value={m.month}>
                  {monthLabelBg(m.month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={exportCsv} disabled={!month || payments.isLoading} variant="outline">
            <Download className="mr-1.5 h-4 w-4" /> Изтегли CSV
          </Button>
        </div>
      }
    >
      {months.isLoading ? (
        <AdminCard>
          <EmptyState text="Зареждане…" />
        </AdminCard>
      ) : months.isError ? (
        <AdminCard>
          <EmptyState text="Отчетът не можа да се зареди." />
        </AdminCard>
      ) : (
        <>
          {summary ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Продажби"
                value={formatEur(summary.salesEur)}
                hint={`${summary.salesCount} ${summary.salesCount === 1 ? "плащане" : "плащания"}`}
              />
              <Stat
                label="От тях"
                value={formatEur(summary.creditsEur)}
                hint={`точки · ${formatEur(summary.promotionEur)} промотиране`}
              />
              <Stat
                label="Възстановени"
                value={formatEur(summary.refundsEur)}
                hint={`${summary.refundsCount} ${summary.refundsCount === 1 ? "плащане" : "плащания"}`}
              />
              <Stat label="Нетно" value={formatEur(summary.netEur)} hint={monthLabelBg(summary.month)} />
            </div>
          ) : null}

          <AdminCard>
            <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
              Последните {MONTHS} месеца
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Месец</TableHead>
                    <TableHead className="text-right">Плащания</TableHead>
                    <TableHead className="text-right">Продажби</TableHead>
                    <TableHead className="text-right">Възстановени</TableHead>
                    <TableHead className="text-right">Нетно</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((m) => (
                    <TableRow
                      key={m.month}
                      onClick={() => setSelected(m.month)}
                      className={`cursor-pointer ${m.month === month ? "bg-muted/60" : ""}`}
                    >
                      <TableCell className="font-medium capitalize text-foreground">{monthLabelBg(m.month)}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.salesCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatEur(m.salesEur)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatEur(m.refundsEur)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatEur(m.netEur)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AdminCard>

          <AdminCard>
            <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
              Плащания за <span className="capitalize">{month ? monthLabelBg(month) : ""}</span>
            </div>
            {payments.isLoading ? (
              <EmptyState text="Зареждане…" />
            ) : payments.isError ? (
              <EmptyState text="Плащанията не можаха да се заредят." />
            ) : rows.length === 0 ? (
              <EmptyState text="Няма плащания за този месец." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Платено</TableHead>
                      <TableHead>Потребител</TableHead>
                      <TableHead>Продукт</TableHead>
                      <TableHead className="text-right">Сума</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="text-right">Разписка</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((p) => {
                      const refundedHere = month ? inSofiaMonth(p.refundedAt, month) : false;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {sofiaDateTime(p.paidAt)}
                            {p.refundedAt ? (
                              <div className={refundedHere ? "text-destructive" : ""}>
                                върнато {sofiaDateTime(p.refundedAt)}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            <AdminUserLink id={p.userId} name={p.userName} />
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="text-foreground">{p.item || "—"}</div>
                            <div className="text-xs text-muted-foreground">{KIND_BG[p.kind] ?? p.kind}</div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatEur(p.amountEur)}</TableCell>
                          <TableCell>
                            <Badge variant={p.status === "completed" ? "default" : "secondary"} className="rounded">
                              {REVENUE_STATUS_BG[p.status] ?? p.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {p.receiptUrl ? (
                              <a
                                href={p.receiptUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                              >
                                Виж <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">няма</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </AdminCard>
        </>
      )}
    </AdminPage>
  );
}
