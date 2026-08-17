import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Receipt,
  ClipboardList,
  Users,
  CreditCard,
  ScrollText,
  Star,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyStaffRole } from "@/services/admin";

export const Route = createFileRoute("/admin")({
  ssr: false,
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
  { to: "/admin/tasks", label: "Задачи", icon: ClipboardList },
  { to: "/admin/reviews", label: "Отзиви", icon: Star },
  { to: "/admin/users", label: "Потребители", icon: Users },
  { to: "/admin/payments", label: "Плащания", icon: CreditCard },
  { to: "/admin/audit", label: "Одит лог", icon: ScrollText },
] as { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-[1500px] gap-0 lg:gap-6 lg:px-6 lg:py-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-6 rounded-lg border border-slate-200 bg-white p-3">
            <div className="px-2 pb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                      active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-3 border-t border-slate-200 pt-3">
              <Link
                to="/"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4" /> Към сайта
              </Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-white lg:hidden">
            <div className="flex gap-1 overflow-x-auto px-3 py-2">
              {NAV.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
                      active ? "bg-slate-900 text-white" : "text-slate-600"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
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
