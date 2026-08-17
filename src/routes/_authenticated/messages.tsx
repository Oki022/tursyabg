import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send, Phone, ShieldAlert, AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Съобщения — ЗадачаНет" },
      { name: "description", content: "Чат с възложители и изпълнители." },
    ],
  }),
  component: MessagesPage,
});

type Row = {
  id: string;
  task_id: string | null;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  tasks?: { title: string | null } | null;
  sender?: { full_name: string | null; phone: string | null } | null;
  receiver?: { full_name: string | null; phone: string | null } | null;
};

type Conversation = {
  key: string;
  otherId: string;
  name: string;
  phone: string | null;
  taskId: string | null;
  task: string;
  messages: Row[];
};

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("bg-BG", { day: "2-digit", month: "short" });
}

function MessagesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState<Record<string, boolean>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["messages", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(
          "id, task_id, sender_id, receiver_id, content, created_at, tasks(title), sender:profiles!messages_sender_id_fkey(full_name, phone), receiver:profiles!messages_receiver_id_fkey(full_name, phone)",
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("messages-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["messages"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const conversations = useMemo<Conversation[]>(() => {
    if (!user) return [];
    const map = new Map<string, Conversation>();
    for (const row of rows) {
      const isMine = row.sender_id === user.id;
      const otherId = isMine ? row.receiver_id : row.sender_id;
      const other = isMine ? row.receiver : row.sender;
      const key = `${otherId}:${row.task_id ?? "none"}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          otherId,
          name: other?.full_name ?? "Потребител",
          phone: other?.phone ?? null,
          taskId: row.task_id,
          task: row.tasks?.title ?? "Общ разговор",
          messages: [],
        });
      }
      map.get(key)!.messages.push(row);
    }
    return Array.from(map.values()).sort((a, b) => {
      const at = a.messages[a.messages.length - 1]?.created_at ?? "";
      const bt = b.messages[b.messages.length - 1]?.created_at ?? "";
      return bt.localeCompare(at);
    });
  }, [rows, user]);

  const visible = conversations.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.task.toLowerCase().includes(search.toLowerCase()),
  );

  const active = conversations.find((c) => c.key === activeKey) ?? conversations[0] ?? null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !active || !user) return;
    const content = draft.trim();
    setDraft("");
    const { error } = await supabase.from("messages").insert({
      task_id: active.taskId,
      sender_id: user.id,
      receiver_id: active.otherId,
      content,
    });
    if (!error) queryClient.invalidateQueries({ queryKey: ["messages"] });
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Съобщения</h1>
      <div className="grid h-[calc(100vh-12rem)] grid-cols-1 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[320px_1fr]">
        <aside className="flex flex-col border-b border-border md:border-b-0 md:border-r">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Търси разговор"
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            )}
            {!isLoading && visible.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Нямаш разговори още. Пиши на автора на задача, за да започнеш.
              </p>
            )}
            {visible.map((c) => {
              const last = c.messages[c.messages.length - 1];
              const isActive = c.key === active?.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setActiveKey(c.key)}
                  className={`flex w-full items-start gap-3 border-b border-border/60 px-3 py-3 text-left transition-colors hover:bg-accent/50 ${
                    isActive ? "bg-accent" : ""
                  }`}
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {c.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {last ? timeLabel(last.created_at) : ""}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{c.task}</div>
                    <div className="mt-0.5 truncate text-xs text-foreground/80">{last?.content}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          {!active ? (
            <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground">
              Избери разговор от списъка.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {active.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{active.name}</div>
                    <div className="text-xs text-muted-foreground">Относно: {active.task}</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPhoneDialog(true)}
                  className="gap-1.5"
                >
                  <Phone className="h-4 w-4" />
                  {phoneRevealed[active.key]
                    ? active.phone ?? "Няма телефон"
                    : "Покажи телефон"}
                </Button>
              </div>

              <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  За вашата сигурност, препоръчваме да комуникирате само през платформата и да внимавате при споделяне на лични данни.
                </p>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
                {active.messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                          mine
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm border border-border bg-card text-foreground"
                        }`}
                      >
                        <p>{m.content}</p>
                        <div
                          className={`mt-1 text-[10px] ${
                            mine ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}
                        >
                          {timeLabel(m.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border p-3">
                <form onSubmit={send} className="flex items-center gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Напишете съобщение…"
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={!draft.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>

      <Dialog open={showPhoneDialog} onOpenChange={setShowPhoneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Внимание преди да продължите
            </DialogTitle>
            <DialogDescription>
              Препоръчваме да продължите комуникацията в платформата. Не споделяйте лични данни,
              банкови сметки или плащания извън ЗадачаНет. Сигурни ли сте, че искате да видите телефонния номер?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPhoneDialog(false)}>
              Отказ
            </Button>
            <Button
              onClick={() => {
                if (active) setPhoneRevealed((p) => ({ ...p, [active.key]: true }));
                setShowPhoneDialog(false);
              }}
            >
              <MessageCircle className="h-4 w-4" />
              Покажи номера
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
