import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMonitoringConfig } from "@/lib/monitoring/config.functions";
import { initMonitoring, setMonitoringUser } from "@/lib/monitoring/client";
import { useAuth } from "@/lib/auth";

/**
 * Boots browser error monitoring once, then keeps the (id-only) user tag in
 * sync. Renders nothing.
 */
export function MonitoringBoot() {
  const fetchConfig = useServerFn(getMonitoringConfig);
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    fetchConfig()
      .then((config) => {
        if (!cancelled) initMonitoring(config);
      })
      .catch(() => {
        /* monitoring must never break the app */
      });
    return () => {
      cancelled = true;
    };
  }, [fetchConfig]);

  useEffect(() => {
    setMonitoringUser(user?.id ?? null);
  }, [user?.id]);

  return null;
}
