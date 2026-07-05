/**
 * Static country labels for display and older rows.
 *
 * Space form/filter options are derived from the DB-backed currency list via
 * `countryOptionsFromCurrencies`, because the country -> currency mapping is
 * maintained on currency metadata.
 */
export interface Country {
  /** ISO-3166 alpha-2 code, stored on the space row. */
  code: string;
  /** Human-readable display label for the picker. */
  label: string;
}

export const COUNTRIES = [
  { code: "US", label: "美国" },
  { code: "CN", label: "中国" },
  { code: "EU", label: "欧元区" },
  { code: "GB", label: "英国" },
  { code: "JP", label: "日本" },
  { code: "HK", label: "中国香港" },
  { code: "TH", label: "泰国" },
  { code: "SG", label: "新加坡" },
  { code: "CH", label: "瑞士" },
  { code: "AU", label: "澳大利亚" },
  { code: "CA", label: "加拿大" },
  { code: "BR", label: "巴西" },
  { code: "CZ", label: "捷克" },
  { code: "DK", label: "丹麦" },
  { code: "DE", label: "德国" },
  { code: "FR", label: "法国" },
  { code: "HU", label: "匈牙利" },
  { code: "ID", label: "印度尼西亚" },
  { code: "IL", label: "以色列" },
  { code: "IN", label: "印度" },
  { code: "IS", label: "冰岛" },
  { code: "KR", label: "韩国" },
  { code: "MX", label: "墨西哥" },
  { code: "MY", label: "马来西亚" },
  { code: "NO", label: "挪威" },
  { code: "NZ", label: "新西兰" },
  { code: "PH", label: "菲律宾" },
  { code: "PL", label: "波兰" },
  { code: "RO", label: "罗马尼亚" },
  { code: "SE", label: "瑞典" },
  { code: "TR", label: "土耳其" },
  { code: "ZA", label: "南非" },
] as const satisfies readonly Country[];

export type CountryCode = (typeof COUNTRIES)[number]["code"];

const COUNTRY_LABELS = new Map<string, string>(
  COUNTRIES.map((country) => [country.code, country.label]),
);

export function formatCountryLabel(code: string): string {
  return COUNTRY_LABELS.get(code) ?? code;
}

export function countryOptionsFromCurrencies<
  T extends { countryCode: string; countryName: string },
>(currencies: readonly T[]): Country[] {
  const options = new Map<string, string>();
  for (const currency of currencies) {
    if (!currency.countryCode || !currency.countryName) continue;
    options.set(currency.countryCode, currency.countryName);
  }

  return Array.from(options, ([code, label]) => ({ code, label })).sort(
    (left, right) => left.label.localeCompare(right.label, "zh-Hans-CN"),
  );
}
