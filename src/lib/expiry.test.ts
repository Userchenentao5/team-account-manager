import { describe, expect, it } from "vitest";
import {
  addPeriod,
  expiryStatus,
  monthlyPaymentDueDate,
  nextMonthlyPaymentDueDate,
  renewMonthlyPaymentDueDate,
} from "@/lib/expiry";

describe("expiry helpers", () => {
  it.each([
    ["2025-01-31", { unit: "month" as const, count: 1 }, "2025-02-28"],
    ["2024-01-31", { unit: "month" as const, count: 1 }, "2024-02-29"],
    ["2025-01-31", { unit: "month" as const, count: 3 }, "2025-04-30"],
    ["2025-08-31", { unit: "month" as const, count: 6 }, "2026-02-28"],
    ["2025-03-15", { unit: "month" as const, count: 1 }, "2025-04-15"],
    ["2025-11-30", { unit: "quarter" as const, count: 1 }, "2026-02-28"],
    ["2024-02-29", { unit: "year" as const, count: 1 }, "2025-02-28"],
    ["2024-02-29", { unit: "year" as const, count: 4 }, "2028-02-29"],
    ["2025-12-31", { unit: "month" as const, count: 1 }, "2026-01-31"],
  ])("adds %j to %s as %s", (openingDate, period, expected) => {
    expect(addPeriod(openingDate, period)).toBe(expected);
  });

  it.each([
    ["2026-06-27", "expired"],
    ["2026-06-28", "soon"],
    ["2026-07-05", "soon"],
    ["2026-07-06", "normal"],
  ] as const)("classifies %s as %s", (expiry, expected) => {
    expect(expiryStatus(expiry, new Date(2026, 5, 28))).toBe(expected);
  });

  it("uses the configured soon threshold", () => {
    expect(expiryStatus("2026-07-06", new Date(2026, 5, 28), 8)).toBe("soon");
    expect(expiryStatus("2026-07-06", new Date(2026, 5, 28), 7)).toBe(
      "normal",
    );
  });

  it("turns a monthly payment day into this month's due date", () => {
    expect(monthlyPaymentDueDate(29, new Date(2026, 5, 28))).toBe("2026-06-29");
    expect(monthlyPaymentDueDate(31, new Date(2026, 1, 1))).toBe("2026-02-28");
  });

  it("treats the start date as already paid for that day", () => {
    expect(nextMonthlyPaymentDueDate(5, "2026-07-05")).toBe("2026-08-05");
    expect(nextMonthlyPaymentDueDate(10, "2026-07-05")).toBe("2026-07-10");
  });

  it("renews to the next billing cycle", () => {
    expect(renewMonthlyPaymentDueDate(10, "2026-07-10", new Date(2026, 6, 5))).toBe(
      "2026-08-10",
    );
    expect(renewMonthlyPaymentDueDate(1, "2026-07-01", new Date(2026, 6, 5))).toBe(
      "2026-08-01",
    );
  });
});
