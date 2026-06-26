import { z } from "zod";

export const WORLD_CONFIG_COMPONENT = "world_config" as const;

export const worldConfigBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

export type WorldConfigBody = z.infer<typeof worldConfigBodySchema>;
