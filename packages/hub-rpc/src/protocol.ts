import { z } from "zod";

export const HUB_RPC_VERSION = "HubRPC/1.0";

export const hubRpcErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type HubRpcError = z.infer<typeof hubRpcErrorSchema>;

export const hubRpcEnvelopeSchema = z.union([
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
    error: hubRpcErrorSchema,
  }),
  z.object({
    kind: z.literal("evt"),
    method: z.string().min(1),
    payload: z.unknown(),
  }),
]);

export type HubRpcEnvelope = z.infer<typeof hubRpcEnvelopeSchema>;

export function parseHubRpcEnvelope(raw: string): HubRpcEnvelope {
  const parsed = JSON.parse(raw) as unknown;
  return hubRpcEnvelopeSchema.parse(parsed);
}

export function serializeHubRpcEnvelope(envelope: HubRpcEnvelope): string {
  return JSON.stringify(envelope);
}
