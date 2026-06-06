import { z } from "zod";

export const factExtractionItemSchema = z.object({
  content: z.string(),
  type: z.string().optional(),
});

export const factExtractionSchema = z.object({
  facts: z.array(factExtractionItemSchema).default([]),
  summary: z.string().default(""),
});

export const reflectStateEntrySchema = z.object({
  last_reflected_t: z.string().optional(),
});

export const reflectStateSchema = z.record(z.string(), reflectStateEntrySchema);
