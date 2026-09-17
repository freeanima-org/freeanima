import { z } from "zod";

import { bookmarkKindSchema } from "./components/bookmark.ts";

export const bookmarkSearchFiltersSchema = z
  .object({
    kind: bookmarkKindSchema.optional(),
    browser_id: z.string().min(1).optional(),
    parent_id: z.number().int().positive().nullable().optional(),
    client_op_id: z.string().min(1).optional(),
  })
  .strict();

export type BookmarkSearchFilters = z.infer<typeof bookmarkSearchFiltersSchema>;

export function parseBookmarkSearchFilters(
  raw: Record<string, unknown> | undefined,
): BookmarkSearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = bookmarkSearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid bookmark filters: ${parsed.error.message}`);
  }
  return parsed.data;
}
