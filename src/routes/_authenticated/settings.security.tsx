import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ShieldCheck, KeyRound, AlertTriangle, Loader2, PhoneCall, UserCog, Download, Mail, Camera } from "lucide-react";
import { toast } from "sonner";
import { SettingsPageShell } from "@/components/settings-page-shell";
import { UserAvatar } from "@/components/user-avatar";
import { uploadAvatar } from "@/services/avatars";
import { AVATAR_UPLOADS_ENABLED } from "@/lib/feature-flags";
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
import { LocationCombobox } from "@/components/location-combobox";
import { buildLocation, splitLocation } from "@/lib/locations";
import { normalizeBgPhone, phoneError } from "@/lib/phone";
import { SkillsEditor } from "@/components/settings/skills-editor";
import { MAX_SKILL_TAGS } from "@/components/settings/skills-editor";
import { useMySkills, useSaveSkills } from "@/lib/skills-api";
import { normalizeSkillTag, skillTagError, skillTagKey } from "@/lib/skill-tags";
import { CredentialsEditor } from "@/components/settings/credentials-editor";
import { PhoneVerificationCard } from "@/components/settings/phone-verification-card";
import { credentialError, type Credential } from "@/lib/credentials";
import { toastError } from "@/lib/toast-error";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  downloadJson,
  useDeactivateAccount,
  useExportMyData,
  useRequestAccountDeletion,
} from "@/lib/account-api";

function formatDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("bg-BG", { day: "numeric", month: "long", year: "numeric" });
}


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
  const { user, logout, updateUser, changePassword, resetPassword } = useAuth();
  const navigate = useNavigate();
  const hydrated = useHydrated();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState<string | undefined>(undefined);
  const [skillCategories, setSkillCategories] = useState<string[]>([]);
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState("");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const onPickAvatar = async (file: File) => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const path = await uploadAvatar(user.id, file);
      await updateUser({ avatarUrl: path });
      toast.success("Профилната снимка е обновена.");
    } catch (err) {
      toastError(err, { title: "Снимката не беше качена" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      await updateUser({ avatarUrl: null });
      toast.success("Профилната снимка е премахната.");
    } catch (err) {
      toastError(err, { title: "Снимката не беше премахната" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const skills = useMySkills(user?.id);
  const saveSkills = useSaveSkills();
  const deactivate = useDeactivateAccount();
  const requestDeletion = useRequestAccountDeletion();
  const exportData = useExportMyData();

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setPhone(user.phone ?? "");
    setLocation(user.city ? buildLocation(user.city, user.neighborhood) : undefined);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!skills.data) return;
    setSkillCategories(skills.data.categories);
    setSkillTags(skills.data.tags);
    setCredentials(skills.data.credentials);
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
    const pendingTag = normalizeSkillTag(skillDraft);
    const pendingError = pendingTag ? skillTagError(pendingTag) : null;
    if (pendingError) {
      toast.error(pendingError);
      return;
    }
    const hasPendingTag = pendingTag && !skillTags.some((tag) => skillTagKey(tag) === skillTagKey(pendingTag));
    if (hasPendingTag && skillTags.length >= MAX_SKILL_TAGS) {
      toast.error(`Може да добавиш най-много ${MAX_SKILL_TAGS} умения.`);
      return;
    }
    for (const entry of credentials) {
      const credErr = credentialError(entry);
      if (credErr) {
        toast.error(credErr);
        return;
      }
    }
    const tagsToSave = hasPendingTag ? [...skillTags, pendingTag] : skillTags;
    setSaving(true);
    try {
      const picked = splitLocation(location);
      await updateUser({
        name: name.trim(),
        phone: normalizeBgPhone(phone),
        city: picked.city ?? null,
        neighborhood: picked.neighborhood ?? null,
      });
      const skillsResult = await saveSkills.mutateAsync({
        userId: user.id,
        categories: skillCategories,
        tags: tagsToSave,
        credentials,
      });
      setSkillTags(skillsResult.tags);
      setCredentials(skillsResult.credentials);
      setSkillDraft("");
      if (skillsResult.droppedTags.length > 0) {
        toast.warning("Част от уменията не бяха запазени", {
          description: `Премахнати са: ${skillsResult.droppedTags.join(", ")}. Умения с телефони, имейли, линкове или профили в месинджъри не се запазват.`,
        });
      } else {
        toast.success("Профилът е обновен.");
      }
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

        {/* Голямата профилна икона е премахната. Качването е временно спряно
            (виж feature-flags.ts); бутоните остават за бъдещо включване. */}
        {AVATAR_UPLOADS_ENABLED ? (
          <div className="space-y-1.5">
            <UserAvatar
              userId={user?.id}
              name={name || user?.name}
              src={user?.avatarUrl}
              className="h-14 w-14"
              iconStrokeWidth={0.65}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void onPickAvatar(file);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={uploadingAvatar}
                onClick={() => fileRef.current?.click()}
              >
                {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {user?.avatarUrl ? "Смени снимката" : "Качи снимка"}
              </Button>
              {user?.avatarUrl && (
                <Button type="button" variant="ghost" size="sm" disabled={uploadingAvatar} onClick={() => void onRemoveAvatar()}>
                  Премахни
                </Button>
              )}
            </div>
          </div>
        ) : null}





        <div className="grid gap-1.5">
          <Label htmlFor="name">Име</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setTouched(true);
            }}
            placeholder="Име и фамилия"
            className="h-11"
          />
          {nameMsg && <p className="text-xs text-destructive">{nameMsg}</p>}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="location">Местоположение</Label>
          <LocationCombobox
            id="location"
            value={location}
            onChange={setLocation}
            allowClear
            placeholder="Търси община или град..."
          />
          <p className="text-xs text-muted-foreground">
            Показва се публично в профила ти. Можеш да го оставиш празно.
          </p>
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
              placeholder="08X XXX XXXX"
              className={`h-11 pl-9 ${phoneMsg ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
          </div>
          {phoneMsg ? (
            <p className="text-xs text-destructive">{phoneMsg}</p>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Номерът е скрит и се показва само на майстор, отключил контакта с точки.
            </p>
          )}
        </div>

        <PhoneVerificationCard />

        <div className="border-t border-border/60 pt-5">
          <SkillsEditor
            categories={skillCategories}
            tags={skillTags}
            draft={skillDraft}
            onDraftChange={setSkillDraft}
            onChange={(next) => {
              setSkillCategories(next.categories);
              setSkillTags(next.tags);
            }}
            disabled={saving || skills.isLoading}
          />
        </div>

        <div className="border-t border-border/60 pt-5">
          <CredentialsEditor
            entries={credentials}
            onChange={setCredentials}
            disabled={saving || skills.isLoading}
          />
        </div>

        <Button type="submit" disabled={!hydrated || saving || skills.isLoading} className="gap-2">
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
        {passwordOpen ? (
          <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="current-password">Текуща парола</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-password">Нова парола</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">Минимум 8 знака.</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirm-password">Потвърди новата парола</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={changingPassword} className="gap-2">
                {changingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                Смени паролата
              </Button>
              <Button type="button" variant="ghost" onClick={() => setPasswordOpen(false)}>
                Откажи
              </Button>
            </div>
            <button
              type="button"
              onClick={handleResetByEmail}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Mail className="h-3.5 w-3.5" />
              Забравих текущата си парола, изпрати линк на имейла ми
            </button>
          </form>
        ) : (
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setPasswordOpen(true)}>
            <KeyRound className="h-4 w-4" />
            Смени паролата
          </Button>
        )}
      </div>

      {/* Моите данни */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Моите данни</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Изтегли копие на профила си, задачите, отзивите и историята на точките във формат JSON.
        </p>
        <Button
          variant="outline"
          className="mt-4 gap-2"
          onClick={handleExport}
          disabled={exportData.isPending}
        >
          {exportData.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Изтегли моите данни
        </Button>
      </div>

      {/* Опасна зона */}
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <h2 className="text-lg font-semibold text-destructive">Действия по моя профил</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Деактивирането е обратимо. Изтриването се изпълнява след 14 дни и можеш да го откажеш
          през този период.
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-background px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Деактивирай профила</p>
              <p className="text-xs text-muted-foreground">
                Активните ти задачи се скриват от каталога, никой не може да отключва контакта ти и
                няма да можеш да публикуваш или да пишеш съобщения. Отзивите, договорките и точките
                ти се запазват. Можеш да активираш профила при следващо влизане.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={busy}>
                  Деактивирай
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Да деактивираме ли профила ти?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Задачите ти ще бъдат скрити и ще излезеш от профила. Всичките ти данни се
                    запазват и при следващо влизане ще те попитаме дали искаш да го активираш отново.
                    Задачите ти ще се върнат в предишното си състояние.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Откажи</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeactivate}>Да, деактивирай</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-background px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Изтрий профила</p>
              <p className="text-xs text-muted-foreground">
                Изтриването се изпълнява 14 дни след заявката. Дотогава профилът е деактивиран и
                можеш да откажеш изтриването при влизане.
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
                  <AlertDialogTitle>Заявка за изтриване на профила</AlertDialogTitle>
                  <AlertDialogDescription>
                    Профилът ти се деактивира веднага, а окончателното изтриване се изпълнява след 14
                    дни. През този период можеш да откажеш заявката при влизане. След това името,
                    телефонът, снимката, задачите, снимките, съобщенията и известията ти се изтриват
                    безвъзвратно. Отзивите, които си получил и оставил, и историята на плащанията
                    остават, но без твоята самоличност. Тя се заменя с анонимен потребител.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Откажи</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Да, заяви изтриване
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
