import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Mail,
  Phone,
  Upload,
  LogOut,
  ClipboardList,
  Wrench,
  HandHeart,
  Wallet,
  UserCog,
  ShieldCheck,
  Bell,
  ChevronRight,
  KeyRound,
  Eye,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TaskCard } from "@/components/task-card";
import { useAuth, getInitials } from "@/lib/auth";
import { categories, type TaskStatus } from "@/lib/mock-data";
import { useMyTasks } from "@/lib/tasks-api";
import { useOwnerPromotions } from "@/lib/promotions-api";
import { PROMO_LABELS, remainingLabel, type TaskPromotion } from "@/services/promotions";
import { PromoteDialog } from "@/components/promotions/promote-dialog";
import { PromotedBadge, TopBadge, UrgentBadge } from "@/components/promotions/promo-badges";
import { OwnerTaskControls } from "@/components/tasks/owner-task-controls";
import { EngagementInbox } from "@/components/reviews/engagement-cards";
import type { Task } from "@/lib/mock-data";
import { toast } from "sonner";

const TASK_TABS: { value: TaskStatus; label: string; empty: string }[] = [
  { value: "active", label: "Активни", empty: "Нямаш активни задачи в момента." },
  { value: "assigned", label: "Възложени", empty: "Нямаш възложени задачи." },
  { value: "pending", label: "Изчакващи", empty: "Нямаш задачи, чакащи одобрение." },
  {
    value: "pending_payment",
    label: "Изчакващи плащане",
    empty: "Нямаш задачи, чакащи плащане.",
  },
  { value: "inactive", label: "Неактивни", empty: "Нямаш неактивни задачи." },
];

const SETTINGS_ITEMS: { icon: typeof Wallet; label: string; to: string }[] = [
  { icon: UserCog, label: "Редакция на профил", to: "/settings/profile" },
  { icon: ShieldCheck, label: "Влизане и сигурност", to: "/settings/security" },
  { icon: Wallet, label: "Баланс и плащания", to: "/settings/billing" },
  { icon: KeyRound, label: "Отключени задачи", to: "/unlocked" },
  { icon: Bell, label: "Нотификации", to: "/settings/notifications" },
];

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const { data: tasks = [] } = useMyTasks(user?.id);
  const { data: promotions = {} } = useOwnerPromotions(user?.id);
  const [promoteTaskId, setPromoteTaskId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [tab, setTab] = useState<TaskStatus>("active");

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, typeof tasks> = {
      active: [],
      assigned: [],
      pending: [],
      pending_payment: [],
      inactive: [],
    };
    if (!user) return map;
    for (const t of tasks) {
      if (t.userId !== user.id) continue;
      map[t.status ?? "active"].push(t);
    }
    return map;
  }, [tasks, user]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-sm text-muted-foreground">
        Зареждане...
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    toast.success("Излязохте от профила си.");
    navigate({ to: "/" });
  };

  const toggleSkill = (id: string) => {
    const current = user.skills ?? [];
    const next = current.includes(id) ? current.filter((s) => s !== id) : [...current, id];
    updateUser({ skills: next });
  };

  const mockVerify = () => {
    updateUser({ verified: true });
    toast.success("Самоличността е потвърдена (демо).");
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
      {/* Header card */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border border-border md:h-20 md:w-20">
              <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
                  {user.name}
                </h1>
                {user.verified && (
                  <span
                    title="Потвърден профил"
                    className="inline-flex items-center gap-1 rounded-full bg-[#1da1f2]/10 px-2 py-0.5 text-xs font-medium text-[#1da1f2]"
                  >
                    <BadgeCheck className="h-4 w-4 fill-[#1da1f2] text-white" />
                    Потвърден
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Възлагай задачи и отключвай контакти без ограничения.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2 self-start md:self-auto">
            <LogOut className="h-4 w-4" />
            Изход
          </Button>
        </div>

        <div className="mt-4">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 px-2">
            <Link to="/user/$id" params={{ id: user.id }}>
              <Eye className="h-4 w-4" /> Виж публичния ми профил и отзиви
            </Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <InfoRow icon={<Mail className="h-4 w-4" />} label="Имейл" value={user.email} />
          <InfoRow
            icon={<Phone className="h-4 w-4" />}
            label="Телефон"
            value={user.phone || "Не е въведен"}
          />
        </div>
      </div>

      {/* Role-specific sections */}
      <div className="mt-6 grid gap-6">
        <EngagementInbox />

        {/* Твоите задачи */}
        <section className="min-w-0 rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Твоите задачи</h2>
            <Button asChild size="sm" variant="outline">
              <Link to="/post">Възложи нова</Link>
            </Button>
          </div>
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as TaskStatus)}
            className="mt-4"
          >
            <TabsList className="flex h-auto w-full max-w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TASK_TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs md:text-sm"
                >
                  {t.label} ({byStatus[t.value].length})
                </TabsTrigger>
              ))}
            </TabsList>
            {TASK_TABS.map((t) => (
              <TabsContent key={t.value} value={t.value} className="mt-4">
                {byStatus[t.value].length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {byStatus[t.value].map((task) => (
                      <OwnerTaskCard
                        key={task.id}
                        task={task}
                        promotions={promotions[task.id] ?? []}
                        onPromote={() => setPromoteTaskId(task.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                    <ClipboardList className="mx-auto mb-2 h-6 w-6 opacity-60" />
                    {t.empty}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
          {promoteTaskId && (
            <PromoteDialog
              taskId={promoteTaskId}
              open={Boolean(promoteTaskId)}
              onOpenChange={(open) => !open && setPromoteTaskId(null)}
            />
          )}
        </section>

        {/* Настройки */}
        <section className="min-w-0 rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-7">
          <h2 className="text-lg font-semibold text-foreground">Настройки</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {SETTINGS_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-3 transition-colors hover:bg-accent/40"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </section>

        <>
          <section className="min-w-0 rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-7">
              <h2 className="text-lg font-semibold text-foreground">Моите умения</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Избери категориите, в които предлагаш услуги.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {categories.map((c) => {
                  const Icon = c.icon;
                  const active = (user.skills ?? []).includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleSkill(c.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-accent"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="min-w-0 rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-7">
              <h2 className="text-lg font-semibold text-foreground">Проверка на самоличността</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Качи документ за самоличност, за да получиш синя значка и повече доверие.
              </p>
              <div className="mt-4 flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                    <Upload className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {user.verified ? "Самоличността ти е потвърдена" : "Качи лична карта или паспорт"}
                    </p>
                    <p className="text-xs text-muted-foreground">JPG, PNG или PDF, до 5 MB</p>
                  </div>
                </div>
                <Button onClick={mockVerify} disabled={user.verified} className="gap-2">
                  <Upload className="h-4 w-4" />
                  {user.verified ? "Потвърдено" : "Качи документ"}
                </Button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

/** Owner view of a task: promo state, views and a promote shortcut. */
function OwnerTaskCard({
  task,
  promotions,
  onPromote,
}: {
  task: Task;
  promotions: TaskPromotion[];
  onPromote: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <TaskCard task={{ ...task, isTop: promotions.some((p) => p.type === "top"), isUrgent: promotions.some((p) => p.type === "urgent") }} />
      <div className="min-w-0 rounded-xl border border-border/60 bg-card p-2 text-[11px]">
        {promotions.length > 0 && <PromotedBadge className="mb-1" />}
        <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
          <Eye className="h-3 w-3 shrink-0" />
          <span className="break-words">{task.viewCount ?? 0} преглеждания</span>
        </div>
        {promotions.length > 0 ? (
          <div className="mt-1.5 flex flex-col gap-1">
            {promotions.map((p) => (
              <div key={p.id} className="flex min-w-0 flex-wrap items-center gap-1">
                {p.type === "top" ? (
                  <TopBadge />
                ) : p.type === "urgent" ? (
                  <UrgentBadge />
                ) : (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground">
                    {PROMO_LABELS[p.type]}
                  </span>
                )}
                <span className="break-words text-muted-foreground">
                  {remainingLabel(p.expiresAt).replace("Активна още ", "")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-muted-foreground">Няма активни промоции.</p>
        )}
        <Button size="sm" variant="outline" className="mt-2 h-7 w-full gap-1 text-[11px]" onClick={onPromote}>
          <Rocket className="h-3 w-3" />
          {promotions.length > 0 ? "Управлявай" : "Промотирай"}
        </Button>
        {(task.status === "active" || task.status === "assigned") && (
          <div className="mt-2">
            <OwnerTaskControls task={task} compact />
          </div>
        )}
        {task.status === "pending" && (
          <div className="mt-2 space-y-1.5 rounded-xl bg-amber-50 p-2 text-[11px] leading-snug text-amber-900">
            <p className="font-medium">В проверка от екипа</p>
            <p>
              Задачата ще стане публична след одобрение, обикновено до няколко часа. Ще получиш
              известие.
            </p>
            <Button asChild size="sm" variant="outline" className="h-auto w-full py-1.5 text-[11px]">
              <Link to="/task/$id/edit" params={{ id: task.id }}>
                Редактирай задачата
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
