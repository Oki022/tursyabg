import type { ReactNode } from "react";
import { BackLink } from "@/components/back-link";

export function SettingsPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-10">
      <BackLink />
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
        {title}
      </h1>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  );
}
