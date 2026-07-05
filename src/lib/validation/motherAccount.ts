import { z } from "zod";
import { seatTypeSchema } from "./childAccount";

export const motherSeatFormSchema = z.object({
  seatType: seatTypeSchema,
  canChangeSeatType: z.boolean(),
});

export type MotherSeatFormInput = z.infer<typeof motherSeatFormSchema>;
