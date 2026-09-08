import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Връзката за нова парола понякога отваря началната страница, защото Supabase
 * пренасочва към адреса на сайта. Клиентът обработва тихо токена от адреса и
 * създава сесия за възстановяване, затова тук хващаме този момент и пращаме
 * потребителя към формата за нова парола.
 */
export function PasswordRecoveryRedirect() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (pathname === "/reset-password") return;

    const goToReset = () => {
      const suffix = `${window.location.search}${window.location.hash}`;
      window.sessionStorage.setItem("password-recovery", "1");
      navigate({ to: "/reset-password" });
      // Запазваме параметрите, ако още не е създадена сесия.
      if (suffix.includes("type=recovery")) {
        window.history.replaceState(null, "", `/reset-password${suffix}`);
      }
    };

    const url = `${window.location.search}${window.location.hash}`;
    if (url.includes("type=recovery")) {
      goToReset();
      return;
    }

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") goToReset();
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, pathname]);

  return null;
}
