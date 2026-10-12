import { describe, expect, it } from "vitest";
import { creditsLabel, formatEur, unlockCostForBudget } from "./credits";

describe("unlockCostForBudget", () => {
  it("взима 5 кредита за най-малките бюджети", () => {
    expect(unlockCostForBudget(1)).toBe(5);
    expect(unlockCostForBudget(50)).toBe(5);
    expect(unlockCostForBudget(100)).toBe(5);
  });

  it("сменя тарифата точно на границата", () => {
    expect(unlockCostForBudget(100)).toBe(5);
    expect(unlockCostForBudget(101)).toBe(10);
    expect(unlockCostForBudget(300)).toBe(10);
    expect(unlockCostForBudget(301)).toBe(20);
    expect(unlockCostForBudget(800)).toBe(20);
    expect(unlockCostForBudget(801)).toBe(35);
    expect(unlockCostForBudget(2000)).toBe(35);
    expect(unlockCostForBudget(2001)).toBe(55);
    expect(unlockCostForBudget(5000)).toBe(55);
    expect(unlockCostForBudget(5001)).toBe(80);
  });

  it("не надхвърля най-високата тарифа", () => {
    expect(unlockCostForBudget(10_000)).toBe(80);
    expect(unlockCostForBudget(1_000_000)).toBe(80);
  });

  it("никога не връща отрицателна или нулева цена", () => {
    for (const budget of [0, 1, 99, 100, 500, 3000, 99_999]) {
      expect(unlockCostForBudget(budget)).toBeGreaterThan(0);
    }
  });

  it("цената расте заедно с бюджета", () => {
    const budgets = [50, 200, 500, 1500, 3000, 9000];
    const costs = budgets.map(unlockCostForBudget);
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]).toBeGreaterThan(costs[i - 1]);
    }
  });
});

describe("formatEur", () => {
  it("ползва запетая за десетичен знак", () => {
    expect(formatEur(6.99)).toContain("6,99");
    expect(formatEur(12)).toContain("12,00");
  });

  it("закръгля до два знака", () => {
    expect(formatEur(1.2345)).toContain("1,23");
    expect(formatEur(0.1)).toContain("0,10");
    expect(formatEur(6.999)).toContain("7,00");
  });
});

describe("creditsLabel", () => {
  it("използва единствено число само за 1", () => {
    expect(creditsLabel(1)).toMatch(/^1 точка$/);
  });

  it("използва множествено число за всичко останало", () => {
    expect(creditsLabel(0)).toMatch(/точки$/);
    expect(creditsLabel(2)).toMatch(/точки$/);
    expect(creditsLabel(80)).toMatch(/точки$/);
  });
});