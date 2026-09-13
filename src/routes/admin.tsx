import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Receipt,
  ClipboardList,
  Users,
  CreditCard,
  ScrollText,
  Star,
  Mail,
  ArrowLeft,
  ShieldAlert,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyStaffRole } from "@/services/admin";
import { BackLink } from "@/components/back-link";
import { noindexSeo } from "@/lib/seo";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => noindexSeo("Администрация"),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "login" } });
    const role = await getMyStaffRole();
    if (!role.isAdmin && !role.isModerator) {
      toast.error("Нямаш достъп до администраторския панел.");
      throw redirect({ to: "/" });
    }
    return { staff: role };
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Табло", icon: LayoutDashboard, exact: true },
  { to: "/admin/refunds", label: "Възстановявания", icon: Receipt },
  { to: "/admin/moderation", label: "Модерация", icon: ShieldAlert },
  { to: "/admin/tasks", label: "Задачи", icon: ClipboardList },
  { to: "/admin/reviews", label: "Отзиви", icon: Star },
  { to: "/admin/users", label: "Потребители", icon: Users },
  { to: "/admin/payments", label: "Плащания", icon: CreditCard },
  { to: "/admin/contact", label: "Контакти", icon: Mail },
  { to: "/admin/deletions", label: "Изтриване на профил", icon: UserMinus },
  { to: "/admin/audit", label: "Одит лог", icon: ScrollText },
] as { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1500px] gap-0 lg:gap-6 lg:px-6 lg:py-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-6 rounded-lg border border-border bg-card p-3">
            <div className="px-2 pb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Администрация
            </div>
            <nav className="space-y-0.5">
              {NAV.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                      active ? "bg-foreground text-background" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-3 border-t border-border pt-3">
              <Link
                to="/"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" /> Към сайта
              </Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur lg:hidden">
            <div className="flex items-center gap-1 px-3 py-2">
              <BackLink className="shrink-0" />
              <div className="flex gap-1 overflow-x-auto">
              {NAV.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
                      active ? "bg-foreground text-background" : "text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              </div>
            </div>
          </div>
          <main className="px-4 py-5 lg:px-0 lg:py-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
