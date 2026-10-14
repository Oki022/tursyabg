import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { mapFeedRows, type FeedRow } from "@/lib/tasks-api";

/** Tasks that matched the user's task alerts in the last 14 days, newest match first. */
export function useMyAlertTasks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["task-alerts", "tasks", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      // my_alert_tasks is newer than the generated types; it returns feed_tasks rows.
      const { data, error } = await supabase.rpc("my_alert_tasks" as never, { _limit: 60 } as never);
      if (error) throw error;
      return mapFeedRows((data ?? []) as unknown as FeedRow[]);
    },
  });
}
