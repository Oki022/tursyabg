import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";


export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Нова парола | ТърсяБГ" },
      { name: "description", content: "Задай нова парола за своя профил в ТърсяБГ." },
      { property: "og:title", content: "Нова парола | ТърсяБГ" },
      { property: "og:description", content: "Задай нова парола за своя профил." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Паролата трябва да е поне 6 символа.");
      return;
    }
    if (password !== confirm) {
      toast.error("Паролите не съвпадат.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      toast.success("Паролата е сменена успешно.");
      navigate({ to: "/profile" });
    } catch (err) {
      toastError(err, { title: "Неуспешна смяна на паролата" });
    } finally {

      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-10">
      <div className="w-full rounded-2xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Нова парола</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Въведи новата си парола, за да влезеш отново в профила си.
        </p>
        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="password">Нова парола</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 pl-9"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirm">Повтори паролата</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="h-10 pl-9"
              />
            </div>
          </div>
          <Button type="submit" className="h-11" disabled={busy}>
            {busy ? "Запазване..." : "Запази новата парола"}
          </Button>
        </form>
      </div>
    </div>
  );
}
