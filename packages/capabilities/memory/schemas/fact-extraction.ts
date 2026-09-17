import { z } from "zod";

export const factExtractionItemSchema = z.object({
  content: z.string(),
  type: z.string().optional(),
});

export const factExtractionSchema = z.object({
  facts: z.array(factExtractionItemSchema).default([]),
  summary: z.string().default(""),
});
