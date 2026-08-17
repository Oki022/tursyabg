import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Съобщения — ЗадачаНет" },
      { name: "description", content: "Чат с възложители и изпълнители." },
    ],
  }),
  component: MessagesPage,
});

type Message = { id: string; from: "me" | "them"; text: string; time: string };
type Conversation = {
  id: string;
  name: string;
  task: string;
  lastMessage: string;
  time: string;
  unread?: number;
  phone: string;
  messages: Message[];
};

const CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    name: "Иван Петров",
    task: "Ремонт на баня",
    lastMessage: "Кога бихте могли да започнете?",
    time: "10:42",
    unread: 2,
    phone: "+359 88 123 4567",
    messages: [
      { id: "m1", from: "them", text: "Здравейте, видях вашата задача за ремонт на баня.", time: "10:30" },
      { id: "m2", from: "me", text: "Здравейте! Да, още е активна.", time: "10:35" },
      { id: "m3", from: "them", text: "Кога бихте могли да започнете?", time: "10:42" },
    ],
  },
  {
    id: "2",
    name: "Мария Георгиева",
    task: "Почистване на апартамент",
    lastMessage: "Благодаря, ще се свържа отново.",
    time: "Вчера",
    phone: "+359 87 765 4321",
    messages: [
      { id: "m1", from: "me", text: "Здравейте, имам свободни часове в петък.", time: "Вчера 14:10" },
      { id: "m2", from: "them", text: "Благодаря, ще се свържа отново.", time: "Вчера 14:25" },
    ],
  },
  {
    id: "3",
    name: "Стоян Димитров",
    task: "Монтаж на климатик",
    lastMessage: "Готово, до утре!",
    time: "Пон",
    phone: "+359 89 555 1212",
    messages: [
      { id: "m1", from: "them", text: "Можете ли утре сутрин?", time: "Пон 09:00" },
      { id: "m2", from: "me", text: "Готово, до утре!", time: "Пон 09:05" },
    ],
  },
];

function MessagesPage() {
  const [activeId, setActiveId] = useState(CONVERSATIONS[0].id);
  const [draft, setDraft] = useState("");
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState<Record<string, boolean>>({});

  const active = CONVERSATIONS.find((c) => c.id === activeId)!;
  const [threads, setThreads] = useState<Record<string, Message[]>>(
    Object.fromEntries(CONVERSATIONS.map((c) => [c.id, c.messages]))
  );

  const send = () => {
    if (!draft.trim()) return;
    setThreads((prev) => ({
      ...prev,
      [activeId]: [
        ...prev[activeId],
        { id: `m${Date.now()}`, from: "me", text: draft.trim(), time: "сега" },
      ],
    }));
    setDraft("");
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Съобщения</h1>
      <div className="grid h-[calc(100vh-12rem)] grid-cols-1 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[320px_1fr]">
        {/* Sidebar */}
        <aside className="flex flex-col border-b border-border md:border-b-0 md:border-r">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Търси разговор" className="pl-8" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {CONVERSATIONS.map((c) => {
              const isActive = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
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
                      <span className="shrink-0 text-xs text-muted-foreground">{c.time}</span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{c.task}</div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-foreground/80">{c.lastMessage}</span>
                      {c.unread ? (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                          {c.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Chat window */}
        <section className="flex min-h-0 flex-col">
          {/* Header */}
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
              {phoneRevealed[active.id] ? active.phone : "Покажи телефон"}
            </Button>
          </div>

          {/* System warning */}
          <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              За вашата сигурност, препоръчваме да комуникирате само през платформата и да внимавате при споделяне на лични данни.
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
            {threads[activeId].map((m) => (
              <div
                key={m.id}
                className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                    m.from === "me"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-card text-foreground border border-border"
                  }`}
                >
                  <p>{m.text}</p>
                  <div
                    className={`mt-1 text-[10px] ${
                      m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {m.time}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Composer */}
          <div className="border-t border-border p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2"
            >
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
                setPhoneRevealed((p) => ({ ...p, [active.id]: true }));
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