import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCookieConsent } from "@/lib/cookie-consent";

function CategoryRow({
  title,
  description,
  checked,
  disabled,
  onChange,
  hint,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        {hint && <p className="text-xs font-medium text-muted-foreground">{hint}</p>}
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange?.(v)}
        aria-label={title}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

export function CookieConsent() {
  const { bannerOpen, prefsOpen, openPreferences, closePreferences, consent, optOutSignal, acceptAll, rejectAll, save } =
    useCookieConsent();
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (prefsOpen) {
      setAnalytics(!optOutSignal && consent?.analytics === true);
      setMarketing(!optOutSignal && consent?.marketing === true);
    }
  }, [prefsOpen, consent, optOutSignal]);

  return (
    <>
      {bannerOpen && (
        <div
          role="region"
          aria-label="Съгласие за бисквитки"
          className="fixed inset-x-0 bottom-0 z-50 w-full max-w-full border-t border-border bg-background/95 md:bottom-4 md:backdrop-blur md:left-1/2 md:w-[min(46rem,calc(100%-2rem))] md:-translate-x-1/2 md:rounded-2xl md:border md:shadow-2xl"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pt-4 md:pb-1">
            <div className="flex items-start gap-2.5">
              <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-foreground">Използваме бисквитки</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Необходимите бисквитки поддържат входа, сигурността и плащанията и не могат да се изключат. С твое
                  съгласие бихме ползвали и аналитични и маркетингови бисквитки. Виж{" "}
                  <Link to="/cookies" className="underline hover:text-foreground">
                    Политика за бисквитките
                  </Link>
                  .
                </p>
                {optOutSignal && (
                  <p className="text-xs font-medium text-muted-foreground">
                    Браузърът ти изпраща сигнал за отказ (GPC/DNT), затова незадължителните бисквитки остават изключени.
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 pb-4 sm:grid-cols-3 md:pb-4">
              <Button onClick={acceptAll} className="w-full" disabled={optOutSignal}>
                Приемам всички
              </Button>
              <Button onClick={rejectAll} className="w-full">
                Само необходимите
              </Button>
              <Button variant="outline" onClick={openPreferences} className="w-full">
                Настройки
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={prefsOpen} onOpenChange={(open) => (open ? openPreferences() : closePreferences())}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Настройки на бисквитките</DialogTitle>
            <DialogDescription>
              Избери кои категории да разрешиш. Можеш да промениш избора си по всяко време от връзката „Бисквитки“ във
              футъра.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <CategoryRow
              title="Необходими"
              description="Вход и сесия, защита от злоупотреби, плащания през Stripe. Без тях платформата не работи."
              checked
              disabled
              hint="Винаги активни"
            />
            <CategoryRow
              title="Аналитични"
              description="Анонимна статистика колко хора използват страниците, за да ги подобряваме. Скриптовете се зареждат само след съгласие."
              checked={analytics}
              disabled={optOutSignal}
              onChange={setAnalytics}
            />
            <CategoryRow
              title="Маркетингови"
              description="Измерване на резултати от реклами и показване на подходящи съобщения. По подразбиране са изключени."
              checked={marketing}
              disabled={optOutSignal}
              onChange={setMarketing}
            />
            {optOutSignal && (
              <p className="text-xs text-muted-foreground">
                Браузърът ти изпраща сигнал за отказ от проследяване (GPC/DNT). Уважаваме го и незадължителните
                бисквитки не могат да бъдат включени.
              </p>
            )}
          </div>
          <DialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button onClick={() => save({ analytics: false, marketing: false })} className="w-full">
              Само необходимите
            </Button>
            <Button onClick={() => save({ analytics, marketing })} className="w-full">
              Запази избора
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
