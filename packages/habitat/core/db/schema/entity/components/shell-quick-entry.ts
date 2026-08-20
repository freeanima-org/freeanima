import { SHELL_QUICK_ENTRY_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { SHELL_QUICK_ENTRY_COMPONENT };

import { z } from "zod";

/** 壳快捷附属体：扁平 merge，键名避开领域字段 */
export const shellQuickEntryBodySchema = z.object({
  quick_sort_order: z.number().int(),
});

export type ShellQuickEntryBody = z.infer<typeof shellQuickEntryBodySchema>;
