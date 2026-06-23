import { readFileSync, existsSync } from "node:fs";
import { expandConfigEnv } from "./env-expand.ts";
import { parseYaml } from "./yaml.ts";
import { PATHS } from "./paths.ts";
import { animaConfigSchema, type AnimaConfig } from "@freeanima/core/config";

function validateTunnelConfig(cfg: AnimaConfig): void {
  const tunnel = cfg.tunnel;
  if (!tunnel?.enabled) return;

  const warnings: string[] = [];
  if (!tunnel.hostname) warnings.push("tunnel.hostname 未配置");
  if (!tunnel.team_name) warnings.push("tunnel.team_name 未配置");

  const access = tunnel.access;
  if (access?.enabled !== false) {
    if (!access?.audience) {
      warnings.push("tunnel.access.audience 未配置 — 请完成 Access App 或运行 anima tunnel setup");
    }
    if (!access?.allowed_emails?.length) {
      warnings.push("tunnel.access.allowed_emails 为空");
    }
  } else {
    warnings.push("tunnel.access.enabled=false — 公网暴露无 Access 保护，仅限测试");
  }

  if (!tunnel.credentials?.tunnel_credentials) {
    warnings.push("tunnel.credentials.tunnel_credentials 未配置");
  }

  for (const msg of warnings) {
    console.warn(`[tunnel] ${msg}`);
  }
}

/** Validate config.yaml structure at startup (does not expand env/credential references) */
export async function validateConfigOnStartup(): Promise<void> {
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

  const parsed = animaConfigSchema.safeParse(data);
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
