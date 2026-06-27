import { describe, it, expect } from "vitest";
import { formatMinor, parseToMinor } from "@/lib/money";

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
});
