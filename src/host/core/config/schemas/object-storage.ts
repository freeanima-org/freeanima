import { z } from "zod";

/** Habitat runtime：S3 兼容远端（权威字节）；未配置时上传/下载能力报错 */
export const objectStorageConfigSchema = z.object({
  endpoint: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  bucket: z.string().min(1).optional(),
  access_key_id: z.string().min(1).optional(),
  secret_access_key: z.string().min(1).optional(),
  force_path_style: z.boolean().optional(),
});

export type ObjectStorageConfigInput = z.infer<typeof objectStorageConfigSchema>;
