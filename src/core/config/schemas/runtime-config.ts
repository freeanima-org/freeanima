import { animaConfigSchema } from "./config.ts";

/** Hub 运行时配置（PG hub_runtime_config）；不含 bootstrap 段 */
export const runtimeConfigSchema = animaConfigSchema
  .omit({
    database: true,
    http: true,
    redis: true,
  })
  .partial()
  .passthrough();

export type RuntimeConfig = import("zod").z.infer<typeof runtimeConfigSchema>;

export function parseRuntimeConfig(document: Record<string, unknown>): RuntimeConfig {
  const parsed = runtimeConfigSchema.safeParse(document);
  if (!parsed.success) {
    throw new Error(`Invalid runtime config: ${parsed.error.message}`);
  }
  return parsed.data;
}
