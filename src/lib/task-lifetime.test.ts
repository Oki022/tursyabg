import { describe, expect, it } from "vitest";
import { taskLifetimeNotice } from "./task-lifetime";

const NOW = Date.parse("2026-11-05T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

describe("taskLifetimeNotice", () => {
  it("asks to confirm when the 14-day question is open, deadline 7 days after it", () => {
    const n = taskLifetimeNotice(
      { status: "active", freshnessPromptAt: iso(NOW - 2 * DAY), expiresAtIso: iso(NOW + 14 * DAY) },
      NOW,
    );
    expect(n).toEqual({ kind: "confirm", until: NOW + 5 * DAY });
  });

  it("warns less than 3 days before the end", () => {
    const n = taskLifetimeNotice({ status: "active", expiresAtIso: iso(NOW + 2 * DAY) }, NOW);
    expect(n).toEqual({ kind: "expiring", until: NOW + 2 * DAY });
  });

  it("says nothing for a fresh active task", () => {
    expect(taskLifetimeNotice({ status: "active", expiresAtIso: iso(NOW + 20 * DAY) }, NOW)).toBeNull();
  });

  it("says nothing for inactive, assigned, pending or admin-hidden tasks", () => {
    const asked = { freshnessPromptAt: iso(NOW - DAY), expiresAtIso: iso(NOW + DAY) };
    expect(taskLifetimeNotice({ status: "inactive", ...asked }, NOW)).toBeNull();
    expect(taskLifetimeNotice({ status: "assigned", ...asked }, NOW)).toBeNull();
    expect(taskLifetimeNotice({ status: "pending", ...asked }, NOW)).toBeNull();
    expect(taskLifetimeNotice({ status: "active", adminHiddenAt: iso(NOW), ...asked }, NOW)).toBeNull();
  });
});
