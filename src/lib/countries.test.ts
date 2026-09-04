import { describe, expect, it } from "vitest";
import { countryOptionsFromCurrencies } from "./countries";

describe("country options", () => {
  it("merges static countries with currency metadata", () => {
    const currencyCountries = countryOptionsFromCurrencies([
      { countryCode: "XX", countryName: "测试地区" },
    ]);

    expect(currencyCountries).toContainEqual({ code: "XX", label: "测试地区" });
    expect(currencyCountries).toContainEqual({ code: "EG", label: "埃及" });
  });

  it("deduplicates repeated country metadata", () => {
    const options = countryOptionsFromCurrencies([
      { countryCode: "XX", countryName: "测试地区" },
      { countryCode: "XX", countryName: "测试地区" },
    ]);

    expect(options.filter((country) => country.code === "XX")).toHaveLength(1);
  });
});
