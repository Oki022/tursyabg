import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck, KeyRound, AlertTriangle, Loader2, PhoneCall, UserCog } from "lucide-react";
import { toast } from "sonner";
import { SettingsPageShell } from "@/components/settings-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { nameError } from "@/lib/auth-errors";
import { normalizeBgPhone, phoneError } from "@/lib/phone";
import { SkillsEditor } from "@/components/settings/skills-editor";
import { useMySkills, useSaveSkills } from "@/lib/skills-api";
import { toastError } from "@/lib/toast-error";


export const Route = createFileRoute("/_authenticated/settings/security")({
  head: () => ({
    meta: [
      { title: "Влизане и сигурност | ТърсяБГ" },
      { name: "description", content: "Редактирай профила и умението си и управлявай сигурността на акаунта си." },
      { property: "og:title", content: "Влизане и сигурност | ТърсяБГ" },
      { property: "og:description", content: "Профил, умения и настройки за сигурност в ТърсяБГ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsSecurityPage,
});

function SettingsSecurityPage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [skillCategories, setSkillCategories] = useState<string[]>([]);
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const skills = useMySkills(user?.id);
  const saveSkills = useSaveSkills();

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setPhone(user.phone ?? "");
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!skills.data) return;
    setSkillCategories(skills.data.categories);
    setSkillTags(skills.data.tags);
  }, [skills.data]);

  const phoneMsg = touched ? phoneError(phone) : null;
  const nameMsg = touched ? nameError(name) : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nameError(name) || phoneError(phone)) {
      toast.error("Провери маркираните полета.");
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      await updateUser({ name: name.trim(), phone: normalizeBgPhone(phone) });
      await saveSkills.mutateAsync({ userId: user.id, categories: skillCategories, tags: skillTags });
      toast.success("Профилът е обновен.");
    } catch (err) {
      toastError(err, { title: "Промените не бяха запазени" });
    } finally {

      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setBusy(true);
    try {
      await deactivate.mutateAsync();
      toast.success("Профилът ти е деактивиран. Можеш да го активираш при следващо влизане.");
      await logout();
      navigate({ to: "/" });
    } catch (err) {
      toastError(err, { title: "Профилът не беше деактивиран" });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      const scheduledFor = await requestDeletion.mutateAsync();
      toast.success(
        `Заявката е приета. Профилът ще бъде изтрит на ${formatDate(scheduledFor)}. Можеш да откажеш до тази дата.`,
      );
      await logout();
      navigate({ to: "/" });
    } catch (err) {
      toastError(err, { title: "Заявката не беше приета" });
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportData.mutateAsync();
      downloadJson(data, `tursya-danni-${new Date().toISOString().slice(0, 10)}.json`);
      toast.success("Данните ти са изтеглени като JSON файл.");
    } catch (err) {
      toastError(err, { title: "Експортът не беше успешен" });
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Новата парола трябва да е поне 8 знака.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Двете нови пароли не съвпадат.");
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordOpen(false);
      toast.success("Паролата е сменена успешно.");
    } catch (err) {
      toastError(err, { title: "Паролата не беше сменена" });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleResetByEmail = async () => {
    if (!user?.email) return;
    try {
      await resetPassword(user.email);
      toast.success(`Изпратихме линк за смяна на паролата на ${user.email}.`);
    } catch (err) {
      toastError(err, { title: "Линкът не беше изпратен" });
    }
  };

  return (
    <SettingsPageShell
      title="Влизане и сигурност"
      description="Профил, умения и настройки за достъп до твоя акаунт."
    >
      {/* Профил */}
      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-2">
          <UserCog className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Профил</h2>
        </div>

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

        <div className="border-t border-border/60 pt-5">
          <SkillsEditor
            categories={skillCategories}
            tags={skillTags}
            onChange={(next) => {
              setSkillCategories(next.categories);
              setSkillTags(next.tags);
            }}
            disabled={saving || skills.isLoading}
          />
        </div>

        <Button type="submit" disabled={saving || skills.isLoading} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Запази промените
        </Button>
      </form>

      {/* Вход в акаунта */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Вход в акаунта</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Имейл за вход: <span className="font-medium text-foreground">{user?.email}</span>
        </p>
        <Button variant="outline" className="mt-4 gap-2">
          <KeyRound className="h-4 w-4" />
          Смени паролата
        </Button>
      </div>

      {/* Опасна зона */}
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <h2 className="text-lg font-semibold text-destructive">Действия по моя профил</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Тези действия са необратими или ще ограничат достъпа ти до платформата.
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-background px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Деактивирай профила</p>
              <p className="text-xs text-muted-foreground">
                Задачите ти се скриват, но данните се запазват.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDeactivate}>
              Деактивирай
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-background px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Изтрий профила</p>
              <p className="text-xs text-muted-foreground">
                Профилът и всички твои задачи се премахват завинаги.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Изтрий профила
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Сигурен ли си?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Това действие е необратимо. Профилът, задачите и съобщенията ти ще бъдат
                    изтрити завинаги.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Откажи</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Да, изтрий
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </SettingsPageShell>
  );
}
