import { z } from "zod";

import { healthRecordKindSchema } from "./components/health-record.ts";

export const healthSearchFiltersSchema = z
  .object({
    record_kind: healthRecordKindSchema.optional(),
    profile_key: z.string().min(1).optional(),
    client_op_id: z.string().min(1).optional(),
  })
  .strict();

export type HealthSearchFilters = z.infer<typeof healthSearchFiltersSchema>;

export function parseHealthSearchFilters(
  raw: Record<string, unknown> | undefined,
): HealthSearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = healthSearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid health_record filters: ${parsed.error.message}`);
  }
  return parsed.data;
}
