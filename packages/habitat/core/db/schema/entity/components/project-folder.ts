import { PROJECT_FOLDER_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { PROJECT_FOLDER_COMPONENT };

import { z } from "zod";

export const projectFolderBodySchema = z.object({
  parent_id: z.number().int().positive().nullable().optional(),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).nullable().default(null),
});

export type ProjectFolderBody = z.infer<typeof projectFolderBodySchema>;
