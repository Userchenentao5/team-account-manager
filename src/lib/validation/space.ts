import { z } from "zod";

/**
 * SPACE-01 — shared space form validation (T-03-INPUT / T-03-MASS).
 *
 * Used by BOTH the client form and Server Actions, which re-parse server-side
 * because Server Actions are public endpoints — the client validation is
 * convenience only, never a trust boundary (ASVS V5). Parsing only known fields
 * also blocks mass-assignment.
 */
export const spaceFormSchema = z.object({
  name: z.string().trim().min(1, "请输入空间名称。"),
  country: z.string().length(2),
  paymentChannelId: z.number().int().positive(),
  currencyCode: z.string().length(3),
  amountMinor: z.number().int().positive(),
  openingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currentPeriodStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodUnit: z.enum(["month", "quarter", "year"]),
  periodCount: z.number().int().positive(),
  motherEmail: z.string().trim().min(1, "请输入母账号邮箱/登录名。"),
});

export type SpaceFormInput = z.infer<typeof spaceFormSchema>;

/** Surrogate-id schema for space detail / edit paths. */
export const spaceIdSchema = z.object({
  id: z.number().int().positive(),
});
