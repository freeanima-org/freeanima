import { z } from "zod";

export const LIMBIC_COMPONENT = "limbic" as const;

export const limbicBodySchema = z.object({
  valence: z.number().min(-1).max(1),
  arousal: z.number().min(0).max(1),
  intensity: z.number().min(0).max(1),
});

export type LimbicBody = z.infer<typeof limbicBodySchema>;
