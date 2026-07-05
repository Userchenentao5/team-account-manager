import { describe, it, expect } from "vitest";
import { formatCurrencyMinor } from "@/lib/currencies";
import {
  convertUsdMinorToCurrencyMinor,
  formatMinor,
  freezeUsdMinor,
  parseToMinor,
} from "@/lib/money";

describe("money helpers (integer minor units, currency-aware exponent)", () => {
  it("parses a 2-decimal currency to integer minor units", () => {
    expect(parseToMinor("19.99", 2)).toBe(1999);
  });

  it("formats integer minor units back to a 2-decimal string", () => {
    expect(formatMinor(1999, 2)).toBe("19.99");
  });

  it("parses a 0-decimal currency (JPY) with no fractional part", () => {
    expect(parseToMinor("500", 0)).toBe(500);
  });

  it("formats a 0-decimal currency (JPY) with no decimal point", () => {
    expect(formatMinor(500, 0)).toBe("500");
  });

  it("round-trips format(parse(x)) stably for exponent 2", () => {
    for (const x of ["0.00", "1.00", "19.99", "1234.56"]) {
      expect(formatMinor(parseToMinor(x, 2), 2)).toBe(x);
    }
  });

  it("round-trips format(parse(x)) stably for exponent 0 (JPY)", () => {
    for (const x of ["0", "1", "500", "123456"]) {
      expect(formatMinor(parseToMinor(x, 0), 0)).toBe(x);
    }
  });

  it("freezes USD self-rate without changing minor units", () => {
    expect(freezeUsdMinor(1999, 2, "1")).toBe(1999);
  });

  it("freezes a 2-decimal source with round-half-up", () => {
    expect(freezeUsdMinor(1000, 2, "0.1234")).toBe(123);
    expect(freezeUsdMinor(1000, 2, "0.1235")).toBe(124);
  });

  it("freezes JPY using exponent 0 without 100x corruption", () => {
    expect(freezeUsdMinor(1000, 0, "0.0064")).toBe(640);
  });

  it("preserves sign when freezing refunds or credits", () => {
    expect(freezeUsdMinor(-1000, 2, "0.1235")).toBe(-124);
  });

  it("converts frozen USD minor to CNY minor by inverting the CNY-to-USD rate", () => {
    expect(convertUsdMinorToCurrencyMinor(1000, 2, "0.14")).toBe(7143);
  });

  it("rounds USD-to-target display conversion half up", () => {
    expect(convertUsdMinorToCurrencyMinor(100, 2, "0.3333")).toBe(300);
  });

  it("rejects invalid target conversion rates", () => {
    expect(() => convertUsdMinorToCurrencyMinor(1000, 2, "0")).toThrow();
    expect(() => convertUsdMinorToCurrencyMinor(1000, 2, "-0.14")).toThrow();
    expect(() => convertUsdMinorToCurrencyMinor(1000, 2, "")).toThrow();
  });
});

describe("formatCurrencyMinor", () => {
  it("shows familiar symbols alongside currency codes", () => {
    expect(
      formatCurrencyMinor(1999, { code: "USD", minorUnit: 2, symbol: "$" }),
    ).toBe("$19.99 USD");
    expect(
      formatCurrencyMinor(1999, { code: "EUR", minorUnit: 2, symbol: "€" }),
    ).toBe("€19.99 EUR");
    expect(
      formatCurrencyMinor(1999, { code: "CNY", minorUnit: 2, symbol: "￥" }),
    ).toBe("￥19.99 CNY");
    expect(
      formatCurrencyMinor(500, { code: "JPY", minorUnit: 0, symbol: "￥" }),
    ).toBe("￥500 JPY");
  });
});
