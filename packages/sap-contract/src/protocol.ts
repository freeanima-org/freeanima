import { z } from "zod";

export const SAP_VERSION = "SAP/1.0";

export const sapErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type SapError = z.infer<typeof sapErrorSchema>;

export const sapEnvelopeSchema = z.union([
  z.object({ kind: z.literal("connect"), payload: z.record(z.string(), z.unknown()) }),
  z.object({ kind: z.literal("connected"), payload: z.record(z.string(), z.unknown()) }),
  z.object({
    kind: z.literal("req"),
    id: z.string().min(1),
    method: z.string().min(1),
    payload: z.unknown(),
  }),
  z.object({
    kind: z.literal("res"),
    id: z.string().min(1),
    ok: z.literal(true),
    payload: z.unknown(),
  }),
  z.object({
    kind: z.literal("res"),
    id: z.string().min(1),
    ok: z.literal(false),
    error: sapErrorSchema,
  }),
  z.object({
    kind: z.literal("evt"),
    method: z.string().min(1),
    payload: z.unknown(),
  }),
]);

export type SapEnvelope = z.infer<typeof sapEnvelopeSchema>;

export function parseSapEnvelope(raw: string): SapEnvelope {
  const parsed = JSON.parse(raw) as unknown;
  return sapEnvelopeSchema.parse(parsed);
}

export function serializeSapEnvelope(envelope: SapEnvelope): string {
  return JSON.stringify(envelope);
}
