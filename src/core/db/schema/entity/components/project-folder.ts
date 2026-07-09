import { z } from "zod";

export const PROJECT_FOLDER_COMPONENT = "project_folder" as const;

export const projectFolderBodySchema = z.object({
  parent_id: z.number().int().positive().nullable().optional(),
  sort_order: z.number().int().optional(),
});

export type ProjectFolderBody = z.infer<typeof projectFolderBodySchema>;
