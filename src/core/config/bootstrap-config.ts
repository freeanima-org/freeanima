import { z } from "zod";

import { databaseConfigSchema } from "./schemas/config.ts";
import { httpConfigSchema } from "./schemas/http.ts";

const redisBootstrapSchema = z
  .object({
    url: z.string().optional(),
    host: z.string().optional(),
    port: z.number().int().positive().optional(),
    password: z.string().optional(),
    db: z.number().int().nonnegative().optional(),
  })
  .optional();

/** 冷启动引导段：必须在 config.yaml，不写入 hub_runtime_config */
export const BOOTSTRAP_CONFIG_KEYS = ["database", "http", "redis"] as const;

export type BootstrapConfigKey = (typeof BOOTSTRAP_CONFIG_KEYS)[number];

export const bootstrapConfigSchema = z.object({
  database: databaseConfigSchema,
  http: httpConfigSchema.optional(),
  redis: redisBootstrapSchema,
});

export type BootstrapConfig = z.infer<typeof bootstrapConfigSchema>;

export function isBootstrapConfigKey(key: string): key is BootstrapConfigKey {
  return (BOOTSTRAP_CONFIG_KEYS as readonly string[]).includes(key);
}

export function pickBootstrapRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of BOOTSTRAP_CONFIG_KEYS) {
    if (raw[key] !== undefined) out[key] = raw[key];
  }
  return out;
}

export function pickRuntimeDocument(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  for (const key of BOOTSTRAP_CONFIG_KEYS) {
    delete out[key];
  }
  return out;
}

export function hasRuntimeSectionsInYaml(raw: Record<string, unknown>): boolean {
  return Object.keys(pickRuntimeDocument(raw)).length > 0;
}

export function isEmptyRuntimeDocument(document: Record<string, unknown>): boolean {
  return Object.keys(document).length === 0;
}
