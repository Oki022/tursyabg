import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Политика за връщане на кредити — ЗадачаНет" },
      { name: "description", content: "Кога и как можеш да поискаш връщане на кредити в 14-дневен срок." },
      { property: "og:title", content: "Политика за връщане на кредити — ЗадачаНет" },
      { property: "og:description", content: "14-дневен срок и приети причини за връщане на кредити." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundPolicyPage,
});

const reasons = [
  { title: "Фалшива задача", desc: "Задачата е измислена, подвеждаща или рекламна." },
  { title: "Задачата вече е заета", desc: "Възложителят вече е избрал изпълнител преди отключването." },
  { title: "Няма отговор", desc: "Възложителят не отговаря на обажданията и съобщенията ти." },
  { title: "Грешна категория", desc: "Задачата няма нищо общо с обявената категория или описание." },
  { title: "Друга причина", desc: "Опиши накратко проблема — разглеждаме всеки случай индивидуално." },
];

function RefundPolicyPage() {
  return (
    <LegalPage title="Политика за връщане на кредити" updatedAt="17 август 2026">
      <LegalSection title="14-дневен срок">
        <p>
          Можеш да поискаш връщане на кредити в рамките на <strong>14 дни</strong> от момента на отключване на
          контакт. Заявката се подава от страница „Отключени задачи“ с бутона „Заяви връщане“.
        </p>
      </LegalSection>
      <LegalSection title="Приети причини за връщане">
        <ul className="space-y-2">
          {reasons.map((r) => (
            <li key={r.title} className="rounded-lg border border-border/60 bg-card p-3">
              <p className="text-sm font-medium text-foreground">{r.title}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </li>
          ))}
        </ul>
      </LegalSection>
      <LegalSection title="Как протича проверката">
        <p>
          Разглеждаме заявката до 5 работни дни. При одобрение кредитите се връщат по баланса ти автоматично и
          виждаш движението в „Баланс и плащания“. Върнатите кредити не се изплащат в пари.
        </p>
      </LegalSection>
      <LegalSection title="Връщане на пари за закупен пакет">
        <p>
          Като потребител имаш право на отказ от покупка на пакет кредити в 14-дневен срок, ако кредитите не са
          използвани. Ако част от кредитите вече са похарчени, връщаме пропорционалната стойност на
          неизползваните.
        </p>
        <p>
          При възстановено или оспорено плащане съответните кредити се отнемат автоматично от баланса.
        </p>
      </LegalSection>
      <LegalSection title="Злоупотреби">
        <p>
          Системни или неоснователни заявки за връщане могат да доведат до ограничаване на профила.
        </p>
      </LegalSection>
    </LegalPage>
  );
}