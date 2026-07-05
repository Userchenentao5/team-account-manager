import { formatMinor } from "./money";

export type CurrencyMeta = {
  code: string;
  name: string;
  minorUnit: number;
  symbol: string;
  countryCode: string;
  countryName: string;
};

/**
 * Frankfurter-supported currency metadata used by the "add currency" picker.
 * Minor-unit exponents are the local money authority once a currency is added.
 */
export const RATE_SUPPORTED_CURRENCIES = [
  { code: "AUD", name: "澳大利亚元", minorUnit: 2, symbol: "A$", countryCode: "AU", countryName: "澳大利亚" },
  { code: "BRL", name: "巴西雷亚尔", minorUnit: 2, symbol: "R$", countryCode: "BR", countryName: "巴西" },
  { code: "CAD", name: "加拿大元", minorUnit: 2, symbol: "CA$", countryCode: "CA", countryName: "加拿大" },
  { code: "CHF", name: "瑞士法郎", minorUnit: 2, symbol: "CHF", countryCode: "CH", countryName: "瑞士" },
  { code: "CNY", name: "人民币", minorUnit: 2, symbol: "￥", countryCode: "CN", countryName: "中国" },
  { code: "CZK", name: "捷克克朗", minorUnit: 2, symbol: "Kč", countryCode: "CZ", countryName: "捷克" },
  { code: "DKK", name: "丹麦克朗", minorUnit: 2, symbol: "kr", countryCode: "DK", countryName: "丹麦" },
  { code: "EUR", name: "欧元", minorUnit: 2, symbol: "€", countryCode: "FR", countryName: "法国" },
  { code: "GBP", name: "英镑", minorUnit: 2, symbol: "£", countryCode: "GB", countryName: "英国" },
  { code: "HKD", name: "港元", minorUnit: 2, symbol: "HK$", countryCode: "HK", countryName: "中国香港" },
  { code: "HUF", name: "匈牙利福林", minorUnit: 2, symbol: "Ft", countryCode: "HU", countryName: "匈牙利" },
  { code: "IDR", name: "印尼盾", minorUnit: 2, symbol: "Rp", countryCode: "ID", countryName: "印度尼西亚" },
  { code: "ILS", name: "以色列新谢克尔", minorUnit: 2, symbol: "₪", countryCode: "IL", countryName: "以色列" },
  { code: "INR", name: "印度卢比", minorUnit: 2, symbol: "₹", countryCode: "IN", countryName: "印度" },
  { code: "ISK", name: "冰岛克朗", minorUnit: 0, symbol: "kr", countryCode: "IS", countryName: "冰岛" },
  { code: "JPY", name: "日元", minorUnit: 0, symbol: "￥", countryCode: "JP", countryName: "日本" },
  { code: "KRW", name: "韩元", minorUnit: 0, symbol: "₩", countryCode: "KR", countryName: "韩国" },
  { code: "MXN", name: "墨西哥比索", minorUnit: 2, symbol: "Mex$", countryCode: "MX", countryName: "墨西哥" },
  { code: "MYR", name: "马来西亚林吉特", minorUnit: 2, symbol: "RM", countryCode: "MY", countryName: "马来西亚" },
  { code: "NOK", name: "挪威克朗", minorUnit: 2, symbol: "kr", countryCode: "NO", countryName: "挪威" },
  { code: "NZD", name: "新西兰元", minorUnit: 2, symbol: "NZ$", countryCode: "NZ", countryName: "新西兰" },
  { code: "PHP", name: "菲律宾比索", minorUnit: 2, symbol: "₱", countryCode: "PH", countryName: "菲律宾" },
  { code: "PLN", name: "波兰兹罗提", minorUnit: 2, symbol: "zł", countryCode: "PL", countryName: "波兰" },
  { code: "RON", name: "罗马尼亚列伊", minorUnit: 2, symbol: "lei", countryCode: "RO", countryName: "罗马尼亚" },
  { code: "SEK", name: "瑞典克朗", minorUnit: 2, symbol: "kr", countryCode: "SE", countryName: "瑞典" },
  { code: "SGD", name: "新加坡元", minorUnit: 2, symbol: "S$", countryCode: "SG", countryName: "新加坡" },
  { code: "THB", name: "泰铢", minorUnit: 2, symbol: "฿", countryCode: "TH", countryName: "泰国" },
  { code: "TRY", name: "土耳其里拉", minorUnit: 2, symbol: "₺", countryCode: "TR", countryName: "土耳其" },
  { code: "USD", name: "美元", minorUnit: 2, symbol: "$", countryCode: "US", countryName: "美国" },
  { code: "ZAR", name: "南非兰特", minorUnit: 2, symbol: "R", countryCode: "ZA", countryName: "南非" },
] as const satisfies readonly CurrencyMeta[];

/** Default seeded currency list with authoritative minor-unit exponents. */
export const CURRENCIES = RATE_SUPPORTED_CURRENCIES;

export function findRateSupportedCurrency(
  code: string,
): CurrencyMeta | undefined {
  return RATE_SUPPORTED_CURRENCIES.find(
    (currency) => currency.code === code.toUpperCase(),
  );
}

export function findRateSupportedCurrencyByCountry(
  countryCode: string,
): CurrencyMeta | undefined {
  return RATE_SUPPORTED_CURRENCIES.find(
    (currency) => currency.countryCode === countryCode.toUpperCase(),
  );
}

export type CurrencyDisplayMeta = {
  code: string;
  minorUnit: number;
  symbol: string;
};

export function formatCurrencyMinor(
  amountMinor: number,
  currency: CurrencyDisplayMeta,
): string {
  const amount = formatMinor(amountMinor, currency.minorUnit);
  return `${currency.symbol}${amount} ${currency.code}`;
}
