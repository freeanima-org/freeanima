import { runtimeConfigSchema, type RuntimeConfig } from "@freeanima/host/core/config";

import { readBootstrapConfig } from "./bootstrap.ts";

/** 旧版 Cloudflare Tunnel 配置段已移除；检测到则提示清理 */
function warnDeprecatedTunnelConfig(cfg: RuntimeConfig): void {
  if (!("tunnel" in cfg) || (cfg as Record<string, unknown>).tunnel == null) return;
  console.warn(
    "[config] tunnel 配置段已废弃并忽略：可从配置中删除，并可移除 ~/.anima/cloudflared 与 ~/.anima/bin/cloudflared；远程暴露请改用局域网、本地 HTTPS 或自建反向代理（见 docs/ops/remote-access.md）",
  );
}

/** Phase 1：连 PG 前仅校验 bootstrap 段 */
export async function validateBootstrapOnStartup(): Promise<void> {
  try {
    const { record } = readBootstrapConfig();
    if ("tunnel" in record && record.tunnel != null) {
      console.warn(
        "[config] tunnel 配置段已废弃并忽略：可从 config.yaml 删除，并可移除 ~/.anima/cloudflared 与 ~/.anima/bin/cloudflared；远程暴露请改用局域网、本地 HTTPS 或自建反向代理（见 docs/ops/remote-access.md）",
      );
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

/** Phase 2：PG 加载后校验运行时配置 */
export function validateRuntimeConfigOnStartup(cfg: RuntimeConfig): void {
  const parsed = runtimeConfigSchema.safeParse(cfg);
  if (!parsed.success) {
    console.error("runtime config validation failed:");
    for (const issue of parsed.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      console.error(`  - ${path}: ${issue.message}`);
    }
    process.exit(1);
  }

  warnDeprecatedTunnelConfig(parsed.data);
}
