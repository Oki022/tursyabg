import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { COMPANY, SUPPORT_EMAIL } from "@/lib/company";

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Начало
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Последна актуализация: {updatedAt}</p>
      <div className="mt-8 space-y-8">{children}</div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
/** Who runs the platform (company details come from src/lib/company.ts). */
export function CompanyDetails() {
  if (!COMPANY) {
    return (
      <p>
        Платформата се управлява от търговско дружество, регистрирано в България. Наименованието, ЕИК и
        адресът на управление ще бъдат публикувани тук след вписването на дружеството в Търговския
        регистър. До тогава можеш да се свържеш с нас на{" "}
        <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    );
  }
  return (
    <p>
      Платформата се управлява от <strong>{COMPANY.name}</strong>, ЕИК {COMPANY.eik}, със седалище и адрес на
      управление {COMPANY.address}. Имейл:{" "}
      <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
    </p>
  );
}
