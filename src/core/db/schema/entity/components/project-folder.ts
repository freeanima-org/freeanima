import { z } from "zod";

export const PROJECT_FOLDER_COMPONENT = "project_folder" as const;

export const projectFolderBodySchema = z.object({
  parent_id: z.number().int().positive().nullable().optional(),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).nullable().default(null),
});

export type ProjectFolderBody = z.infer<typeof projectFolderBodySchema>;
