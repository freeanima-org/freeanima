import { z } from "zod";

/** Habitat runtime：可选 S3 兼容远端；省略则仅本地 objects/ */
export const objectStorageConfigSchema = z.object({
  endpoint: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  bucket: z.string().min(1).optional(),
  access_key_id: z.string().min(1).optional(),
  secret_access_key: z.string().min(1).optional(),
  force_path_style: z.boolean().optional(),
});

export type ObjectStorageConfigInput = z.infer<typeof objectStorageConfigSchema>;
