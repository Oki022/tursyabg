import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Mail, MessageSquare, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { sendContactMessage } from "@/services/contact";
import { seo } from "@/lib/seo";
import { BRAND_NAME } from "@/components/Logo";

const SUBJECTS = [
  "Проблем с задача",
  "Кредити и плащания",
  "Възстановяване на кредити",
  "Жалба или сигнал",
  "Партньорство",
  "Друго",
];

export const Route = createFileRoute("/contact")({
  head: () =>
    seo({
      title: "Контакти и поддръжка",
      description:
        "Свържи се с екипа на Търся при въпрос за задача, кредити, плащане или сигнал. Отговаряме в рамките на един работен ден.",
      path: "/contact",
    }),
  component: ContactPage,
});

function ContactPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<string | undefined>(undefined);
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user?.name && !name) setName(user.name);
    if (user?.email && !email) setEmail(user.email);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useMutation({
    mutationFn: sendContactMessage,
    onSuccess: () => {
      setSent(true);
      setBody("");
      toast.success("Съобщението е изпратено.");
    },
    onError: (err: Error) => {
      const raw = err.message || "";
      if (raw.includes("CONTACT_RATE_LIMIT")) {
        toast.error("Твърде много съобщения", {
          description: "Изпрати не повече от 5 съобщения на час. Опитай отново по-късно.",
        });
        return;
      }
      toast.error("Съобщението не беше изпратено.", { description: raw || undefined });
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject || body.trim().length < 10) {
      toast.error("Попълни всички полета (съобщението, поне 10 символа).");
      return;
    }
    send.mutate({ name, email, subject, body });
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 md:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Контакти</h1>
        <p className="mt-2 text-muted-foreground">
          Пиши ни при въпрос, проблем или сигнал. Екипът на {BRAND_NAME} отговаря обикновено в рамките на
          един работен ден.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoCard icon={Mail} title="Имейл" text="support@tursya.bg" />
        <InfoCard icon={MessageSquare} title="Отговор" text="До 1 работен ден" />
        <InfoCard icon={ShieldQuestion} title="Сигнали" text="Проверяваме всеки сигнал" />
      </div>

      {sent ? (
        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <h2 className="mt-3 text-lg font-semibold text-emerald-900">Получихме съобщението ти</h2>
          <p className="mt-1 text-sm text-emerald-800">
            Ще ти отговорим на {email}. Ако е спешно, изпрати ново съобщение с повече детайли.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setSent(false)}>
            Изпрати ново съобщение
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c-name">Име</Label>
              <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-email">Имейл за отговор</Label>
              <Input
                id="c-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-subject">Тема</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger id="c-subject" className="h-11">
                <SelectValue placeholder="Избери тема" />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-body">Съобщение</Label>
            <Textarea
              id="c-body"
              rows={6}
              placeholder="Опиши случая възможно най-конкретно, линк към задача, дата, сума и др."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Не споделяй пароли или платежни данни в съобщението.
            </p>
            <Button type="submit" size="lg" disabled={send.isPending} className="sm:px-8">
              {send.isPending ? "Изпращане..." : "Изпрати съобщението"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Icon className="h-5 w-5 text-primary" />
      <div className="mt-2 text-sm font-semibold text-foreground">{title}</div>
      <div className="text-sm text-muted-foreground">{text}</div>
    </div>
  );
}
