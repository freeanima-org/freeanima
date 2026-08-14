import { SMART_LIST_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { SMART_LIST_COMPONENT };

import { z } from "zod";

import { taskItemSearchFiltersSchema } from "../task-item-search-filters.ts";

export const smartListBodySchema = z.object({
  sort_order: z.number().int().optional(),
  filters: taskItemSearchFiltersSchema,
});

export type SmartListBody = z.infer<typeof smartListBodySchema>;
