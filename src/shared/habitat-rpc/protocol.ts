import { z } from "zod";

export const HABITAT_RPC_VERSION = "HabitatRPC/1.0";

/** @deprecated 0.9.3 后删除 */
export const HABITAT_RPC_VERSION_LEGACY = "HubRPC/1.0";

export const habitatRpcErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

/** @deprecated 使用 {@link habitatRpcErrorSchema} */
export const hubRpcErrorSchema = habitatRpcErrorSchema;

export type HabitatRpcError = z.infer<typeof habitatRpcErrorSchema>;

/** @deprecated 使用 {@link HabitatRpcError} */
export type HubRpcError = HabitatRpcError;

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

/** @deprecated 使用 {@link habitatRpcEnvelopeSchema} */
export const hubRpcEnvelopeSchema = habitatRpcEnvelopeSchema;

export type HabitatRpcEnvelope = z.infer<typeof habitatRpcEnvelopeSchema>;

/** @deprecated 使用 {@link HabitatRpcEnvelope} */
export type HubRpcEnvelope = HabitatRpcEnvelope;

export function parseHabitatRpcEnvelope(raw: string): HabitatRpcEnvelope {
  const parsed = JSON.parse(raw) as unknown;
  return habitatRpcEnvelopeSchema.parse(parsed);
}

/** @deprecated 使用 {@link parseHabitatRpcEnvelope} */
export const parseHubRpcEnvelope = parseHabitatRpcEnvelope;

export function serializeHabitatRpcEnvelope(envelope: HabitatRpcEnvelope): string {
  return JSON.stringify(envelope);
}

/** @deprecated 使用 {@link serializeHabitatRpcEnvelope} */
export const serializeHubRpcEnvelope = serializeHabitatRpcEnvelope;
