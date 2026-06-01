import { z } from "zod";

export const factSourceSchema = z
  .object({
    session_id: z.string().optional(),
    message_id: z.number().optional(),
  })
  .passthrough();

export const factDataSchema = z.object({
  id: z.string(),
  type: z.string(),
  confidence: z.number(),
  importance: z.number(),
  recall: z.number(),
  domains: z.array(z.string()).default([]),
  threads: z.array(z.string()).default([]),
  entities: z.array(z.string()).default([]),
  sources: z.array(factSourceSchema).default([]),
  created: z.string(),
  updated: z.string(),
  content: z.string(),
});

export type FactSource = z.infer<typeof factSourceSchema>;
export type FactData = z.infer<typeof factDataSchema>;
export type FactType = FactData["type"];
