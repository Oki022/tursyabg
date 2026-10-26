import { createFileRoute } from "@tanstack/react-router";
import { Cookie } from "lucide-react";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { Button } from "@/components/ui/button";
import { clampDescription, seo } from "@/lib/seo";
import { CONSENT_COOKIE } from "@/lib/cookie-consent";
import { useCookieConsent } from "@/lib/cookie-consent";

export const Route = createFileRoute("/cookies")({
  head: () =>
    seo({
      title: "Политика за бисквитките",
      description: clampDescription(
        "Какви бисквитки използва ТърсяБГ, защо са нужни, кои са задължителни и как да промениш съгласието си по всяко време.",
      ),
      path: "/cookies",
    }),
  component: CookiesPage,
});

function CookiesPage() {
  const { openPreferences } = useCookieConsent();

  return (
    <LegalPage title="Политика за бисквитките" updatedAt="26 октомври 2026">
      <LegalSection title="1. Какво са бисквитките">
        <p>
          Бисквитките са малки текстови файлове, които браузърът записва на устройството ти. Те позволяват на
          платформата да те разпознае при следващо посещение, да поддържа влязлата ти сесия и да пази избраните от теб
          настройки.
        </p>
        <p>
          Изборът ти се пази в собствена бисквитка ({CONSENT_COOKIE}) със срок 12 месеца и можеш да го промениш по
          всяко време от бутона по-долу или от връзката „Бисквитки“ във футъра.
        </p>
        <Button onClick={openPreferences} variant="outline" className="gap-2">
          <Cookie className="h-4 w-4" />
          Настройки на бисквитките
        </Button>
      </LegalSection>

      <LegalSection title="2. Необходими бисквитки (винаги активни)">
        <p>Без тези бисквитки платформата не може да работи. Те не изискват съгласие по закон.</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>sb-…-auth-token</strong> (локално хранилище) поддържа влязлата ти сесия. Срок: до изход от
            профила.
          </li>
          <li>
            <strong>{CONSENT_COOKIE}</strong> запазва избора ти от банера за съгласие. Срок: 12 месеца.
          </li>
          <li>
            <strong>Stripe (__stripe_mid, __stripe_sid)</strong> защита от измами при плащания с карта. Задават се само
            на страницата за плащане от доставчика на платежни услуги.
          </li>
          <li>
            <strong>tursya-theme</strong> (локално хранилище) запомня избраната светла или тъмна тема.
          </li>
          <li>
            <strong>tasks-filters-open</strong> (локално хранилище) запомня дали филтрите в „Намери работа“ са
            отворени.
          </li>
          <li>
            <strong>Кратки технически записи</strong> (локално хранилище / хранилище за сесията) например за
            възстановяване на парола и за довършване на вход или покупка в мобилното приложение. Изтриват се
            сами, след като свършат работата си.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Аналитични бисквитки (изискват съгласие)">
        <p>
          В момента не използваме аналитични бисквитки. Ако в бъдеще добавим анонимна статистика за това кои
          страници се посещават, тя ще се зарежда само след твоето съгласие, а тази страница ще бъде
          обновена.
        </p>
      </LegalSection>

      <LegalSection title="4. Маркетингови бисквитки (изискват съгласие)">
        <p>
          В момента не използваме маркетингови бисквитки. Ако в бъдеще измерваме рекламни кампании, това ще
          става само след твоето съгласие. Не продаваме данни на трети страни.
        </p>
      </LegalSection>

      <LegalSection title="5. Сигнали за отказ от проследяване">
        <p>
          Ако браузърът ти изпраща сигнал Global Privacy Control (GPC) или Do Not Track, приемаме го като отказ и
          незадължителните бисквитки остават изключени, дори ако банерът още не е показан.
        </p>
      </LegalSection>

      <LegalSection title="6. Как да промениш или оттеглиш съгласието си">
        <p>
          От връзката „Бисквитки“ във футъра на всяка страница можеш да отвориш настройките и да промениш избора си.
          Можеш също да изтриеш бисквитките от настройките на браузъра си, това ще излезе от профила ти.
        </p>
        <p>
          За въпроси пиши на <a className="underline" href="mailto:privacy@tursya.bg">privacy@tursya.bg</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
