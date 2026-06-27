import { z } from "zod";

/**
 * REF-01 — shared channel-name validation (T-03-INPUT / T-03-MASS).
 *
 * Used by BOTH the client form (RHF `zodResolver`) and the Server Actions,
 * which re-parse server-side because Server Actions are public endpoints — the
 * client validation is convenience only, never a trust boundary (ASVS V5).
 * Parsing only the known `name` field also blocks mass-assignment.
 */
export const channelSchema = z.object({
  name: z.string().trim().min(1, "请输入渠道名称。"),
});

export type ChannelInput = z.infer<typeof channelSchema>;

/** Surrogate-id schema for rename / archive / reactivate (D-05). */
export const channelIdSchema = z.object({
  id: z.number().int().positive(),
});
