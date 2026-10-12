import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { clampDescription, seo } from "@/lib/seo";

export const Route = createFileRoute("/refund-policy")({
  head: () => seo({
    title: "Политика за връщане на точки",
    description: clampDescription("Кога връщаме точки автоматично: измамни или изтрити задачи, и как се връщат парите за неизползвани пакети точки."),
    path: "/refund-policy",
  }),
  component: RefundPolicyPage,
});

function RefundPolicyPage() {
  return (
    <LegalPage title="Политика за връщане на точки" updatedAt="17 август 2026">
      <LegalSection title="Автоматични връщания">
        <p>
          Не е нужно да подаваш заявка. Точките се връщат <strong>автоматично</strong> по баланса ти в
          следните случаи:
        </p>
        <ul className="space-y-2">
          <li className="rounded-lg border border-border/60 bg-card p-3">
            <p className="text-sm font-medium text-foreground">Измамна задача</p>
            <p className="text-xs text-muted-foreground">
              Ако екипът ни премахне задача като измамна, всички изпълнители, отключили контакта, получават
              пълната стойност на точките си обратно и бъдат уведомени.
            </p>
          </li>
          <li className="rounded-lg border border-border/60 bg-card p-3">
            <p className="text-sm font-medium text-foreground">Изтрита от възложителя задача</p>
            <p className="text-xs text-muted-foreground">
              Ако възложителят изтрие задачата си от архива, всички, които са платили за контакта, получават
              точките си обратно автоматично.
            </p>
          </li>
        </ul>
        <p>
          Върнатите точки се виждат веднага в „Баланс и плащания“ и не се изплащат в пари.
        </p>
      </LegalSection>
      <LegalSection title="Проблем с конкретна задача">
        <p>
          Ако смяташ, че задача е измамна или нарушава правилата, използвай бутона „Докладвай“ на страницата
          на задачата. При потвърдена измама връщането става автоматично за всички засегнати изпълнители.
        </p>
      </LegalSection>
      <LegalSection title="Лимит от 5 отключвания">
        <p>
          Всяка задача приема най-много 5 отключвания на контакт. Така се намалява шансът да платиш точки
          за задача, за която вече се борят десетки изпълнители.
        </p>
      </LegalSection>
      <LegalSection title="Връщане на пари за закупен пакет">
        <p>
          Като потребител имаш право на отказ от покупка на пакет точки в 14-дневен срок, ако точките
          не са използвани.
        </p>
        <p>
          При възстановено или оспорено плащане съответните точки се отнемат автоматично от баланса.
        </p>
      </LegalSection>

      <LegalSection title="Злоупотреби">
        <p>
          Системни или неоснователни доклади могат да доведат до ограничаване на профила. Решенията за
          връщане при измама се вземат от екипа след преглед на доказателствата.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
