import { z } from "zod";

import { taskItemSearchFiltersSchema } from "../task-item-search-filters.ts";

export const SMART_LIST_COMPONENT = "smart_list" as const;

export const smartListBodySchema = z.object({
  sort_order: z.number().int().optional(),
  filters: taskItemSearchFiltersSchema,
});

export type SmartListBody = z.infer<typeof smartListBodySchema>;
