import { z } from "zod";

export const OBJECT_FOLDER_COMPONENT = "object_folder" as const;

export const objectFolderBodySchema = z.object({
  parent_id: z.number().int().positive().nullable().optional(),
  /** object_file entity id 列表；folder 主导 */
  file_ids: z.array(z.number().int().positive()).default([]),
});

export type ObjectFolderBody = z.infer<typeof objectFolderBodySchema>;
