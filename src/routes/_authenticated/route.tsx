import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { noindexSeo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => noindexSeo("Личен профил"),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "login" } });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
