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
  if (!tunnel.credentials?.tunnel_credentials) {
    warnings.push("tunnel.credentials.tunnel_credentials 未配置");
  }

  for (const msg of warnings) {
    console.warn(`[tunnel] ${msg}`);
  }
}

function validateHttpConfig(cfg: AnimaConfig): void {
  if (cfg.tunnel?.web_hostname?.trim()) {
    console.warn(
      "[tunnel] tunnel.web_hostname 已废弃 — Web UI 改由 Hub /web 托管，请使用单域名 + https://<hostname>/web",
    );
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
  validateHttpConfig(parsed.data);

  const token = parsed.data.remote_auth?.token?.trim();
  if (parsed.data.tunnel?.enabled && (!token || token.length < 16)) {
    console.warn(
      "[tunnel] remote_auth.token 未配置 — 非本地连接将一律返回 401，远程客户端无法接入",
    );
  }
}
