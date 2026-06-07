import { z } from "zod";

export const capabilityMaskSchema = z.object({
  presets: z.array(z.string()),
});

export type CapabilityMaskJson = z.infer<typeof capabilityMaskSchema>;
