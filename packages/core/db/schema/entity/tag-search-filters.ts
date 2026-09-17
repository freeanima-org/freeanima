import { z } from "zod";

export const tagSearchFiltersSchema = z
  .object({
    client_op_id: z.string().min(1).optional(),
  })
  .strict();

export type TagSearchFilters = z.infer<typeof tagSearchFiltersSchema>;

export function parseTagSearchFilters(raw: Record<string, unknown> | undefined): TagSearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = tagSearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid tag filters: ${parsed.error.message}`);
  }
  return parsed.data;
}
