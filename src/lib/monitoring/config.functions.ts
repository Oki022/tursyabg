import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { appRelease } from "./release";

export type MonitoringConfig = {
  /** Sentry DSN. Public by design, but kept out of the repo as a secret. */
  dsn: string | null;
  environment: "production" | "development";
  release: string;
};

/** Hands the browser the DSN + environment so nothing is hardcoded in the bundle. */
export const getMonitoringConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<MonitoringConfig> => {
    let host = "";
    try {
      host = getRequestHost() ?? "";
    } catch {
      host = "";
    }
    const explicit = process.env["SENTRY_ENVIRONMENT"];
    const environment: "production" | "development" =
      explicit === "production" || explicit === "development"
        ? explicit
        : host.includes("localhost") || host.includes("127.0.0.1")
          ? "development"
          : "production";

    return {
      dsn: process.env["SENTRY_DSN"] ?? null,
      environment,
      release: appRelease(),
    };
  },
);
