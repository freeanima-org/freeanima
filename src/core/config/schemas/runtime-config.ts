import { animaConfigSchema } from "./config.ts";
import {
  BOOTSTRAP_CONFIG_KEYS,
  isBootstrapConfigKey,
  type BootstrapConfigKey,
} from "../bootstrap-config.ts";

/** Hub 运行时配置（PG hub_runtime_config）；不含 bootstrap 段 */
export const runtimeConfigSchema = animaConfigSchema
  .omit({
    database: true,
    http: true,
    redis: true,
    web: true,
  })
  .partial()
  .passthrough();

export type RuntimeConfig = import("zod").z.infer<typeof runtimeConfigSchema>;

type AnimaConfigKey = keyof typeof animaConfigSchema.shape;

/** 已知运行时段（schema 定义，不含 bootstrap）；未写入 PG 时 getSection 应返回 {} */
export const RUNTIME_CONFIG_SECTION_KEYS = (
  Object.keys(animaConfigSchema.shape) as AnimaConfigKey[]
).filter((key): key is Exclude<AnimaConfigKey, BootstrapConfigKey> => !isBootstrapConfigKey(key));

export type RuntimeConfigSectionKey = (typeof RUNTIME_CONFIG_SECTION_KEYS)[number];

export function isRuntimeConfigSectionKey(key: string): key is RuntimeConfigSectionKey {
  return (RUNTIME_CONFIG_SECTION_KEYS as readonly string[]).includes(key);
}

export function parseRuntimeConfig(document: Record<string, unknown>): RuntimeConfig {
  const cleaned: Record<string, unknown> = { ...document };
  for (const key of BOOTSTRAP_CONFIG_KEYS) {
    delete cleaned[key];
  }
  const parsed = runtimeConfigSchema.safeParse(cleaned);
  if (!parsed.success) {
    throw new Error(`Invalid runtime config: ${parsed.error.message}`);
  }
  return parsed.data;
}
