import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  BadgeCheck,
  Mail,
  Phone,
  Upload,
  LogOut,
  ClipboardList,
  Wrench,
  HandHeart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth, getInitials } from "@/lib/auth";
import { categories, getCategory } from "@/lib/mock-data";
import { useTasks } from "@/lib/tasks-context";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const { tasks } = useTasks();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window !== "undefined" && user === null) {
      // small delay to allow hydration of auth state
      const t = setTimeout(() => {
        if (!localStorage.getItem("zadacha-net-auth-user")) {
          navigate({ to: "/auth", search: { mode: "login" } });
        }
      }, 50);
      return () => clearTimeout(t);
    }
  }, [user, navigate]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-sm text-muted-foreground">
        Зареждане...
      </div>
    );
  }

  const isWorker = user.role === "worker";
  const myTasks = tasks.slice(0, 3);

  const handleLogout = () => {
    logout();
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
                {isWorker && user.verified && (
                  <span
                    title="Потвърден профил"
                    className="inline-flex items-center gap-1 rounded-full bg-[#1da1f2]/10 px-2 py-0.5 text-xs font-medium text-[#1da1f2]"
                  >
                    <BadgeCheck className="h-4 w-4 fill-[#1da1f2] text-white" />
                    Потвърден
                  </span>
                )}
              </div>
              <Badge variant="secondary" className="mt-1.5 gap-1">
                {isWorker ? <Wrench className="h-3 w-3" /> : <HandHeart className="h-3 w-3" />}
                {isWorker ? "Предлагам услуги" : "Търся помощ"}
              </Badge>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2 self-start md:self-auto">
            <LogOut className="h-4 w-4" />
            Изход
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
        {isWorker ? (
          <>
            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-7">
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

            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-7">
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
                    <p className="text-xs text-muted-foreground">JPG, PNG или PDF — до 5 MB</p>
                  </div>
                </div>
                <Button onClick={mockVerify} disabled={user.verified} className="gap-2">
                  <Upload className="h-4 w-4" />
                  {user.verified ? "Потвърдено" : "Качи документ"}
                </Button>
              </div>
            </section>
          </>
        ) : null}
        {false && !isWorker && (
          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-7">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Моите активни задачи</h2>
              <Button asChild size="sm" variant="outline">
                <Link to="/post">Възложи нова</Link>
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              {myTasks.map((t) => {
                const cat = getCategory(t.category);
                const Icon = cat.icon;
                return (
                  <Link
                    key={t.id}
                    to="/tasks/$taskId"
                    params={{ taskId: t.id }}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-accent/40"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.location} · {t.postedAt}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-foreground">
                      {t.budget} €
                    </span>
                  </Link>
                );
              })}
              {myTasks.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  <ClipboardList className="mx-auto mb-2 h-6 w-6 opacity-60" />
                  Все още нямаш активни задачи.
                </div>
              )}
            </div>
          </section>
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