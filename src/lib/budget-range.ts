/**
 * "По договаряне" budgets. The client picks an approximate range instead of an
 * exact amount; the database stores the range in tasks.budget_range and sets
 * tasks.budget to a representative value, so unlock costs keep working.
 * Keep these numbers in sync with public.budget_for_range() in SQL.
 */
export type BudgetRange =
  | "up_to_100"
  | "100_300"
  | "300_800"
  | "800_2000"
  | "2000_5000"
  | "over_5000"
  | "unknown";

export const BUDGET_RANGES: { id: BudgetRange; label: string; value: number }[] = [
  { id: "up_to_100", label: "до 100 €", value: 100 },
  { id: "100_300", label: "100–300 €", value: 300 },
  { id: "300_800", label: "300–800 €", value: 800 },
  { id: "800_2000", label: "800–2000 €", value: 2000 },
  { id: "2000_5000", label: "2000–5000 €", value: 5000 },
  { id: "over_5000", label: "над 5000 €", value: 5001 },
  { id: "unknown", label: "Не знам", value: 300 },
];

export function asBudgetRange(value: unknown): BudgetRange | null {
  return BUDGET_RANGES.some((r) => r.id === value) ? (value as BudgetRange) : null;
}

/** Representative budget for a range (same numbers as the database). */
export function budgetForRange(range: BudgetRange): number {
  return BUDGET_RANGES.find((r) => r.id === range)?.value ?? 300;
}

/** "500 €", "По договаряне" or "По договаряне · ~300–800 €". */
export function formatTaskBudget(budget: number, range?: BudgetRange | null): string {
  if (!range) return `${budget} €`;
  if (range === "unknown") return "По договаряне";
  const label = BUDGET_RANGES.find((r) => r.id === range)?.label;
  return label ? `По договаряне · ~${label}` : "По договаряне";
}

/** Main line + optional hint, for places with room for two lines (cards, task page). */
export function budgetParts(budget: number, range?: BudgetRange | null): { main: string; hint?: string } {
  if (!range) return { main: `${budget} €` };
  if (range === "unknown") return { main: "По договаряне" };
  const label = BUDGET_RANGES.find((r) => r.id === range)?.label;
  return label ? { main: "По договаряне", hint: `ориентировъчно ${label}` } : { main: "По договаряне" };
}
