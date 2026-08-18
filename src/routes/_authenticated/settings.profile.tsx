import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, PhoneCall, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SettingsPageShell } from "@/components/settings-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { nameError } from "@/lib/auth-errors";
import { normalizeBgPhone, phoneError } from "@/lib/phone";

export const Route = createFileRoute("/_authenticated/settings/profile")({
  head: () => ({
    meta: [
      { title: "Редакция на профил | Търся" },
      { name: "description", content: "Промени името и телефона за контакт в профила си." },
      { property: "og:title", content: "Редакция на профил | Търся" },
      { property: "og:description", content: "Промени данните в своя профил в Търся." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsProfilePage,
});

function SettingsProfilePage() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setPhone(user.phone ?? "");
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const phoneMsg = touched ? phoneError(phone) : null;
  const nameMsg = touched ? nameError(name) : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nameError(name) || phoneError(phone)) {
      toast.error("Провери маркираните полета.");
      return;
    }
    setSaving(true);
    try {
      await updateUser({ name: name.trim(), phone: normalizeBgPhone(phone) });
      toast.success("Профилът е обновен.");
    } catch {
      toast.error("Промените не бяха запазени. Опитай пак.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsPageShell
      title="Редакция на профил"
      description="Име и телефон за контакт. Телефонът е задължителен, за да публикуваш задачи и да пишеш съобщения."
    >
      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="grid gap-1.5">
          <Label htmlFor="name">Име</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setTouched(true);
            }}
            placeholder="Иван Петров"
            className="h-11"
          />
          {nameMsg && <p className="text-xs text-destructive">{nameMsg}</p>}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="phone">Телефон</Label>
          <div className="relative">
            <PhoneCall className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="phone"
              inputMode="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setTouched(true);
              }}
              placeholder="0888123456"
              className={`h-11 pl-9 ${phoneMsg ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
          </div>
          {phoneMsg ? (
            <p className="text-xs text-destructive">{phoneMsg}</p>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Номерът е скрит и се показва само на майстор, отключил контакта с кредити.
            </p>
          )}
        </div>

        <Button type="submit" disabled={saving} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Запази промените
        </Button>
      </form>
    </SettingsPageShell>
  );
}
