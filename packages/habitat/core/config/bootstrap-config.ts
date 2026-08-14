import { z } from "zod";

import { databaseConfigSchema } from "./schemas/config.ts";
import { httpConfigSchema } from "./schemas/http.ts";
import {
  BOOTSTRAP_CONFIG_KEYS,
  type BootstrapConfigKey,
  isBootstrapConfigKey,
  pickBootstrapRecord,
  pickRuntimeDocument,
  hasRuntimeSectionsInYaml,
  isEmptyRuntimeDocument,
} from "@freeanima/habitat/kernel/config-mechanism";

export {
  BOOTSTRAP_CONFIG_KEYS,
  type BootstrapConfigKey,
  isBootstrapConfigKey,
  pickBootstrapRecord,
  pickRuntimeDocument,
  hasRuntimeSectionsInYaml,
  isEmptyRuntimeDocument,
};

const redisBootstrapSchema = z
  .object({
    url: z.string().optional(),
    host: z.string().optional(),
    port: z.number().int().positive().optional(),
    password: z.string().optional(),
    db: z.number().int().nonnegative().optional(),
  })
  .optional();

/** 冷启动引导段 Zod（键集合在 kernel） */
export const bootstrapConfigSchema = z.object({
  database: databaseConfigSchema,
  http: httpConfigSchema.optional(),
  redis: redisBootstrapSchema,
});

export type BootstrapConfig = z.infer<typeof bootstrapConfigSchema>;
