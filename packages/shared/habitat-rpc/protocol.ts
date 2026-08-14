import { z } from "zod";

export const HABITAT_RPC_VERSION = "HabitatRPC/1.0";

export const habitatRpcErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type HabitatRpcError = z.infer<typeof habitatRpcErrorSchema>;

export const habitatRpcEnvelopeSchema = z.union([
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
    error: habitatRpcErrorSchema,
  }),
  z.object({
    kind: z.literal("evt"),
    method: z.string().min(1),
    payload: z.unknown(),
  }),
]);

export type HabitatRpcEnvelope = z.infer<typeof habitatRpcEnvelopeSchema>;

export function parseHabitatRpcEnvelope(raw: string): HabitatRpcEnvelope {
  const parsed = JSON.parse(raw) as unknown;
  return habitatRpcEnvelopeSchema.parse(parsed);
}

export function serializeHabitatRpcEnvelope(envelope: HabitatRpcEnvelope): string {
  return JSON.stringify(envelope);
}
