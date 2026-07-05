import { z } from "zod";
import { RATE_BASES } from "@/lib/fx/base";

/**
 * FX-01 / FX-03 — Frankfurter response validation (T-02-01, ASVS V5).
 *
 * This is the anti-corruption boundary for the ONE external dependency. Unlike
 * `validation/channel.ts` (which guards user *form* input), this schema guards
 * an untrusted *external API response* before it is ever written to the
 * `fx_rate` cache. Parsing fails closed: any malformed shape, or a rate that is
 * 0, negative, NaN, or Infinity, throws — so the service falls back to the last
 * good cache and never persists a 0/NULL/poisoned rate (Pitfall 1). Validating
 * only the known fields also blocks anything unexpected from reaching the DB.
 */
const positiveRate = z.number().finite().positive(); // rejects 0, negative, NaN, Infinity

export const frankfurterResponseSchema = z.object({
  amount: z.literal(1).or(z.number().positive()),
  base: z.enum(RATE_BASES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rates: z.record(z.string().length(3), positiveRate),
});

export type FrankfurterResponse = z.infer<typeof frankfurterResponseSchema>;
