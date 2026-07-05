import { describe, expect, it } from "vitest";
import { countryOptionsFromCurrencies } from "./countries";

describe("country options", () => {
  it("derives selectable countries from currency metadata", () => {
    const currencyCountries = countryOptionsFromCurrencies([
      { countryCode: "FR", countryName: "法国" },
    ]);

    expect(currencyCountries).toEqual([{ code: "FR", label: "法国" }]);
  });

  it("deduplicates repeated country metadata", () => {
    expect(
      countryOptionsFromCurrencies([
        { countryCode: "FR", countryName: "法国" },
        { countryCode: "FR", countryName: "法国" },
      ]),
    ).toEqual([{ code: "FR", label: "法国" }]);
  });
});
