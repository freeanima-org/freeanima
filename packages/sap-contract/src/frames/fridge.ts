import { z } from "zod";

export const fridgeListInputSchema = z.object({}).default({});

export type FridgeListInput = z.infer<typeof fridgeListInputSchema>;

export const fridgeMagnetItemSchema = z.object({
  key: z.string(),
  value: z.string(),
  module: z.enum(["session", "tasks", "other"]),
  session_id: z.string().optional(),
  label: z.string().optional(),
  ttl_seconds: z.number().nullable(),
});

export type FridgeMagnetItem = z.infer<typeof fridgeMagnetItemSchema>;

export const fridgeListOutputSchema = z.object({
  redis_configured: z.boolean(),
  magnets: z.array(fridgeMagnetItemSchema),
  inject_text: z.string(),
});

export type FridgeListOutput = z.infer<typeof fridgeListOutputSchema>;
