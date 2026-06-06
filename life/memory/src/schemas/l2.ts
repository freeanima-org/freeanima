import { z } from "zod";

export const l2LineSchema = z
  .object({
    type: z.string().optional(),
    t: z.string().optional(),
    role: z.string().optional(),
    content: z.string().optional(),
  })
  .passthrough();

export type L2Line = z.infer<typeof l2LineSchema>;

export const l3DomainsSchema = z.array(z.string());
export const l3EntitiesSchema = z.array(z.string());
export const l3SourcesSchema = z.array(z.record(z.string(), z.unknown()));

export const factExtractionItemSchema = z.object({
  content: z.string(),
  type: z.string().optional(),
  domains: z.array(z.string()).optional(),
  entities: z.array(z.string()).optional(),
  confidence: z.number().optional(),
  importance: z.number().optional(),
  recall: z.number().optional(),
});

export const factExtractionSchema = z.object({
  facts: z.array(factExtractionItemSchema).default([]),
  summary: z.string().default(""),
});

export const reflectStateEntrySchema = z.object({
  last_reflected_t: z.string().optional(),
});

export const reflectStateSchema = z.record(z.string(), reflectStateEntrySchema);
