import { animaConfigSchema } from "./config.ts";
import { BOOTSTRAP_CONFIG_KEYS } from "../bootstrap-config.ts";

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
