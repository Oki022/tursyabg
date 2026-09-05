/**
 * Browser monitoring. The DSN comes from the server at runtime (see
 * config.functions.ts) so nothing sensitive lives in the bundle.
 *
 * Every event passes through the shared scrub/noise/sampling policy before it
 * leaves the browser: no emails, phones, message bodies or payment details.
 */
import * as Sentry from "@sentry/react";
import {
  errorMessageOf,
  isExpectedUserError,
  isIgnoredError,
  priorityForArea,
  sampleRateFor,
  scrubText,
  scrubUrl,
  scrubValue,
  shouldSend,
  type MonitoringArea,
} from "./shared";
import type { MonitoringConfig } from "./config.functions";

let initialized = false;
let currentUserId: string | null = null;

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  const area = (event.tags?.["area"] as MonitoringArea | undefined) ?? "ui";
  const message =
    event.exception?.values?.[0]?.value ?? (typeof event.message === "string" ? event.message : "");
  const stack = event.exception?.values?.[0]?.stacktrace?.frames
    ?.map((f) => f.filename ?? "")
    .join(" ");

  const priority = priorityForArea(area);
  if (isExpectedUserError(message)) return null;
  if (priority !== "critical") {
    if (isIgnoredError(message, stack)) return null;
    if (!shouldSend(area)) return null;
  }

  // Identity: user id only.
  event.user = currentUserId ? { id: currentUserId } : undefined;

  if (event.request) {
    event.request = {
      url: event.request.url ? scrubUrl(event.request.url) : undefined,
      method: event.request.method,
    };
  }
  if (event.exception?.values) {
    for (const v of event.exception.values) if (v.value) v.value = scrubText(v.value);
  }
  if (typeof event.message === "string") event.message = scrubText(event.message);
  if (event.extra) event.extra = scrubValue(event.extra) as Record<string, unknown>;
  event.breadcrumbs = (event.breadcrumbs ?? [])
    .filter((b) => b.category !== "console")
    .map((b) => ({
      ...b,
      message: b.message ? scrubText(b.message) : undefined,
      data: b.data ? (scrubValue(b.data) as Record<string, unknown>) : undefined,
    }));

  event.tags = { ...event.tags, area, alert_priority: priority };
  return event;
}

export function initMonitoring(config: MonitoringConfig): void {
  if (initialized || !config.dsn || typeof window === "undefined") return;
  initialized = true;

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    // Errors only — no performance/replay quota burn on the free tier.
    tracesSampleRate: 0,
    sendDefaultPii: false,
    integrations: (defaults) => defaults.filter((i) => i.name !== "BrowserSession"),
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (crumb) => (crumb.category === "console" ? null : crumb),
  });

  Sentry.setTag("runtime", "browser");
}

export function setMonitoringUser(userId: string | null): void {
  currentUserId = userId;
  if (!initialized) return;
  if (userId) Sentry.setUser({ id: userId });
  else Sentry.setUser(null);
}

export type ClientIssue = {
  area: MonitoringArea;
  /** What the user was trying to do, in plain words. */
  action: string;
  error: unknown;
  route?: string;
  extra?: Record<string, unknown>;
};

/** Reports a handled failure (failed API call, mutation, auth attempt...). */
export function captureIssue({ area, action, error, route, extra }: ClientIssue): void {
  const message = errorMessageOf(error);
  const priority = priorityForArea(area);
  // Expected user mistakes are never reported, even on money/access paths.
  if (isExpectedUserError(message)) return;
  if (priority !== "critical" && isIgnoredError(message)) return;

  if (!initialized) {
    if (priority === "critical" || priority === "high") console.error(`[${area}] ${action}:`, message);
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag("area", area);
    scope.setTag("alert_priority", priority);
    scope.setTag("action", action);
    scope.setLevel(priority === "critical" ? "fatal" : priority === "high" ? "error" : "warning");
    scope.setFingerprint([area, action, scrubText(message).slice(0, 120)]);
    scope.setExtras({
      action,
      route: route ?? (typeof window !== "undefined" ? scrubUrl(window.location.pathname) : undefined),
      ...(extra ? (scrubValue(extra) as Record<string, unknown>) : {}),
    });
    if (priority === "critical" || priority === "high" || Math.random() < sampleRateFor(area)) {
      Sentry.captureException(error instanceof Error ? error : new Error(scrubText(message)));
    }
  });
}
