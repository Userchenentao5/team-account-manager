/**
 * Static ISO-3166 alpha-2 country list (D-10/D-11).
 *
 * Country is a fixed picker backed by this constant — NOT a user-maintained
 * reference table. The space row stores the alpha-2 `code` (e.g. "US", "CN")
 * so the future dashboard's by-country grouping stays clean (Phase 3+).
 */
export interface Country {
  /** ISO-3166 alpha-2 code, stored on the space row. */
  code: string;
  /** Human-readable display label for the picker. */
  label: string;
}

export const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "CN", label: "China" },
  { code: "GB", label: "United Kingdom" },
  { code: "JP", label: "Japan" },
  { code: "HK", label: "Hong Kong" },
  { code: "DE", label: "Germany" },
  { code: "SG", label: "Singapore" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "FR", label: "France" },
] as const satisfies readonly Country[];

export type CountryCode = (typeof COUNTRIES)[number]["code"];
