/**
 * Minimal Sentry reporter for the Worker/edge runtime.
 *
 * The browser SDK cannot run here, so we post a Sentry envelope directly with
 * fetch — no Node built-ins, no bundling surprises. Everything goes through the
 * shared scrubbing/noise/sampling policy in `shared.ts`.
 *
 * SERVER ONLY (blocked from client bundles by the *.server.* filename).
 */
import {
  errorMessageOf,
  isIgnoredError,
  priorityForArea,
  scrubText,
  scrubUrl,
  scrubValue,
  shouldSend,
  type MonitoringArea,
} from "./shared";
import { appRelease } from "./release";

export type ServerIssue = {
  area: MonitoringArea;
  /** What the code was trying to do, e.g. "grant credits from stripe webhook". */
  action: string;
  error: unknown;
  /** Supabase user id only. Never email, phone or name. */
  userId?: string | null;
  /** Route or endpoint path. */
  route?: string | null;
  /** Extra debugging context; scrubbed before sending. */
  extra?: Record<string, unknown>;
};

type Dsn = { host: string; projectId: string; publicKey: string; protocol: string };

function parseDsn(dsn: string): Dsn | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    if (!projectId || !u.username) return null;
    return { host: u.host, projectId, publicKey: u.username, protocol: u.protocol.replace(":", "") };
  } catch {
    return null;
  }
}

export function serverEnvironment(): "production" | "development" {
  const explicit = process.env["SENTRY_ENVIRONMENT"];
  if (explicit === "production" || explicit === "development") return explicit;
  let host = "";
  try {
    // Lazily imported to keep this usable outside a request context.
    host = process.env["PUBLIC_HOSTNAME"] ?? "";
  } catch {
    host = "";
  }
  if (host.includes("-dev.lovable.app") || host.includes("localhost")) return "development";
  return process.env["NODE_ENV"] === "production" ? "production" : "development";
}

function stacktraceOf(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) return scrubText(error.stack).slice(0, 6000);
  return undefined;
}

/**
 * Sends one error to Sentry. Never throws and never blocks the caller's result;
 * monitoring must not be able to break a payment or a page render.
 */
export async function captureServerIssue(issue: ServerIssue): Promise<void> {
  try {
    const dsnRaw = process.env["SENTRY_DSN"];
    if (!dsnRaw) return;
    const dsn = parseDsn(dsnRaw);
    if (!dsn) return;

    const message = errorMessageOf(issue.error);
    const stack = stacktraceOf(issue.error);
    const priority = priorityForArea(issue.area);

    if (priority !== "critical" && isIgnoredError(message, stack)) return;
    if (!shouldSend(issue.area)) return;

    const environment = serverEnvironment();
    const eventId = crypto.randomUUID().replace(/-/g, "");
    const timestamp = new Date().toISOString();

    const event = {
      event_id: eventId,
      timestamp,
      platform: "javascript",
      logger: "server",
      level: priority === "critical" ? "fatal" : priority === "high" ? "error" : "warning",
      release: appRelease(),
      environment,
      server_name: undefined,
      transaction: issue.route ? scrubUrl(issue.route) : undefined,
      message: { formatted: `${issue.area}: ${scrubText(message)}` },
      exception: {
        values: [
          {
            type: issue.error instanceof Error ? issue.error.name : "Error",
            value: scrubText(message).slice(0, 500),
            stacktrace: stack ? { frames: [{ filename: "server", function: issue.action, context_line: stack.split("\n")[1] ?? "" }] } : undefined,
          },
        ],
      },
      tags: {
        area: issue.area,
        alert_priority: priority,
        runtime: "edge",
        action: issue.action,
      },
      user: issue.userId ? { id: issue.userId } : undefined,
      extra: {
        action: issue.action,
        route: issue.route ? scrubUrl(issue.route) : undefined,
        stack,
        ...(issue.extra ? (scrubValue(issue.extra) as Record<string, unknown>) : {}),
      },
      fingerprint: [issue.area, issue.action, scrubText(message).slice(0, 120)],
    };

    const envelope =
      JSON.stringify({ event_id: eventId, sent_at: timestamp, dsn: dsnRaw }) +
      "\n" +
      JSON.stringify({ type: "event" }) +
      "\n" +
      JSON.stringify(event) +
      "\n";

    const url = `${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/envelope/?sentry_key=${dsn.publicKey}&sentry_version=7`;
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-sentry-envelope" },
      body: envelope,
    });
  } catch (e) {
    console.error("Sentry report failed:", e);
  }
}

/** Fire-and-forget helper for hot paths. */
export function reportServerIssue(issue: ServerIssue): void {
  void captureServerIssue(issue);
}
