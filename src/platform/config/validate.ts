import { readFileSync, existsSync } from "node:fs";
import {
  animaConfigSchema,
  bootstrapConfigSchema,
  pickBootstrapRecord,
  type AnimaConfig,
} from "@freeanima/core/config";
import { expandConfigEnv } from "./env-expand.ts";
import { parseYaml } from "./yaml.ts";
import { PATHS } from "./paths.ts";
import { loadConfigYamlRecord } from "./yaml-io.ts";

function validateTunnelConfig(cfg: AnimaConfig): void {
  const tunnel = cfg.tunnel;
  if (!tunnel?.enabled) return;

  const warnings: string[] = [];
  if (!tunnel.hostname) warnings.push("tunnel.hostname 未配置");
  if (!tunnel.credentials?.tunnel_credentials) {
    warnings.push("tunnel.credentials.tunnel_credentials 未配置");
  }

  for (const msg of warnings) {
    console.warn(`[tunnel] ${msg}`);
  }
}

/** Phase 1：连 PG 前仅校验 bootstrap 段 */
export async function validateBootstrapOnStartup(): Promise<void> {
  if (!existsSync(PATHS.configYaml)) {
    console.error(`config.yaml does not exist: ${PATHS.configYaml}`);
    process.exit(1);
  }

  let data: unknown;
  try {
    const raw = expandConfigEnv(readFileSync(PATHS.configYaml, "utf-8"));
    data = parseYaml(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`config.yaml parse failed: ${msg}`);
    process.exit(1);
  }

  const record =
    typeof data === "object" && data != null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const bootstrap = pickBootstrapRecord(record);
  const parsed = bootstrapConfigSchema.safeParse(bootstrap);
  if (!parsed.success) {
    console.error("config.yaml bootstrap validation failed:");
    for (const issue of parsed.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      console.error(`  - ${path}: ${issue.message}`);
    }
    process.exit(1);
  }
}

/** Phase 2：PG 加载后校验完整配置 */
export function validateFullConfigOnStartup(cfg: AnimaConfig): void {
  const parsed = animaConfigSchema.safeParse(cfg);
  if (!parsed.success) {
    console.error("runtime config validation failed:");
    for (const issue of parsed.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      console.error(`  - ${path}: ${issue.message}`);
    }
    process.exit(1);
  }

  validateTunnelConfig(parsed.data);

  if (parsed.data.tunnel?.enabled) {
    console.warn(
      "[tunnel] 远程访问需要 Service API Token（anima token create --subject-id <id>）；请在客户端 Hub 设置中配置 fa_at_...",
    );
  }
}

/** @deprecated 使用 validateBootstrapOnStartup + validateFullConfigOnStartup */
export async function validateConfigOnStartup(): Promise<void> {
  await validateBootstrapOnStartup();
  const merged = loadConfigYamlRecord();
  const parsed = animaConfigSchema.safeParse(merged);
  if (!parsed.success) {
    console.error("config.yaml validation failed:");
    for (const issue of parsed.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      console.error(`  - ${path}: ${issue.message}`);
    }
    process.exit(1);
  }
  validateTunnelConfig(parsed.data);
}
