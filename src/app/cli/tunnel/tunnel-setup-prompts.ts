import * as p from "@clack/prompts";
import { omitUndefined } from "@freeanima/core/util";
import { TUNNEL_CREDENTIAL_REFS, type TunnelConfigFields } from "@freeanima/core/config";
import { resolveValue, resolveCredentialRef } from "@freeanima/platform/config";
import {
  CLOUDFLARE_API_TOKEN_GUIDE,
  normalizeApiToken,
  validateApiTokenShape,
  runSetupWizard,
  verifyApiToken,
} from "@freeanima/platform/connectors/tunnel";
import { installCloudflared, manualDownloadHint } from "./tunnel-install.ts";
import { checkServerAlive, resolveProbeHost } from "../service-common.ts";
import { resolveHubPort } from "./tunnel-hub-port.ts";
import { loadTunnelDraft, patchTunnelConfig } from "./tunnel-config-patch.ts";

export type SetupPromptsOptions = {
  nonInteractive?: boolean;
  skipInstall?: boolean;
  hostname?: string;
  apiToken?: string;
  port?: number;
  yes?: boolean;
};

function isValidHostname(host: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host);
}

function draftHasApiToken(draft: TunnelConfigFields | undefined): boolean {
  const ref = draft?.credentials?.api_token;
  return Boolean(ref?.trim());
}

async function loadSavedApiToken(
  draft: TunnelConfigFields | undefined,
): Promise<string | undefined> {
  const ref = draft?.credentials?.api_token;
  if (!ref?.trim()) return undefined;
  try {
    const raw = await resolveValue(ref.trim());
    return normalizeApiToken(raw) || undefined;
  } catch {
    return undefined;
  }
}

function resolveApiTokenFromRef(ref: string): string | undefined {
  try {
    const raw = resolveCredentialRef(ref, "token");
    return normalizeApiToken(raw) || undefined;
  } catch {
    return undefined;
  }
}

async function acceptAndVerifyApiToken(raw: string): Promise<string> {
  const token = normalizeApiToken(raw);
  const shape = validateApiTokenShape(token);
  if (!shape.ok) {
    throw new Error(shape.reason);
  }
  const s = p.spinner();
  s.start("验证 Cloudflare API Token…");
  try {
    await verifyApiToken(token);
    s.stop("API Token 有效");
    return token;
  } catch (err) {
    s.stop("API Token 无效");
    throw err;
  }
}

async function hubReachable(port: number): Promise<boolean> {
  const host = resolveProbeHost("127.0.0.1");
  try {
    const res = await fetch(`http://${host}:${port}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string; authed?: boolean };
    return body.status === "ok" && body.authed !== false;
  } catch {
    return false;
  }
}

async function runInteractivePrompts(): Promise<{
  hostname: string;
  apiToken?: string;
  hubPort: number;
}> {
  const draft = await loadTunnelDraft();
  if (draft?.hostname) {
    p.log.info("检测到已保存的 tunnel 配置，将预填未完成项");
  }

  p.intro("FreeAnima Cloudflare Tunnel 设置");

  const hostname = await p.text({
    message: "公网 hostname（如 anima.example.com）",
    initialValue: draft?.hostname ?? "",
    validate: (v) => {
      if (!v?.trim()) return "必填";
      if (!isValidHostname(v.trim())) return "无效的域名格式";
      return;
    },
  });
  if (p.isCancel(hostname)) process.exit(0);
  const hostnameValue = String(hostname).trim();
  await patchTunnelConfig({ hostname: hostnameValue, enabled: false });

  const tokenOptions: Array<{ value: string; label: string }> = [];
  if (draftHasApiToken(draft)) {
    tokenOptions.push({ value: "saved", label: "使用 config 中已配置的 API Token 引用" });
  }
  tokenOptions.push(
    { value: "new", label: "粘贴新的 Cloudflare API Token" },
    { value: "none", label: "没有 — Dashboard 手动完成 Tunnel / DNS" },
  );

  const tokenChoice = await p.select({
    message: "Cloudflare API Token（用于自动创建 Tunnel，不是 cloudflared 隧道令牌）",
    options: tokenOptions,
    initialValue: draftHasApiToken(draft) ? "saved" : undefined,
  });
  if (p.isCancel(tokenChoice)) process.exit(0);

  let apiToken: string | undefined;

  if (tokenChoice === "saved") {
    apiToken = await loadSavedApiToken(draft);
    if (!apiToken) {
      p.log.warn("config 中未能解析 API Token，请重新粘贴或设置 env");
    }
  }

  if (tokenChoice === "new" || (tokenChoice === "saved" && !apiToken)) {
    for (const line of CLOUDFLARE_API_TOKEN_GUIDE) {
      p.log.info(line);
    }
    const tokenInput = await p.password({
      message: "粘贴 Cloudflare API Token（Dashboard 创建，不回显）",
      validate: (v) => (!v?.trim() ? "必填" : undefined),
    });
    if (p.isCancel(tokenInput)) process.exit(0);
    try {
      apiToken = await acceptAndVerifyApiToken(String(tokenInput));
      await patchTunnelConfig({
        credentials: { api_token: TUNNEL_CREDENTIAL_REFS.apiToken },
        enabled: false,
      });
      p.log.success(
        "config 已写入 env 引用；请将 Token 导出到 CLOUDFLARE_API_TOKEN（或改用 vault() 引用 Agent 库条目）",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      for (const line of msg.split("\n")) {
        if (line.trim()) p.log.error(line);
      }
      process.exit(1);
    }
  } else if (tokenChoice === "saved" && apiToken) {
    try {
      apiToken = await acceptAndVerifyApiToken(apiToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      for (const line of msg.split("\n")) {
        if (line.trim()) p.log.error(line);
      }
      p.log.info("请选「粘贴新的 Cloudflare API Token」重新创建并粘贴");
      process.exit(1);
    }
    await patchTunnelConfig({
      credentials: { api_token: TUNNEL_CREDENTIAL_REFS.apiToken },
      enabled: false,
    });
  }

  const hubPort = resolveHubPort();

  const summary = [
    `hostname: ${hostnameValue}`,
    `hub: 127.0.0.1:${hubPort}`,
    apiToken ? "API: 自动 provisioning" : "API: 手动 Dashboard",
    "认证: Service API Token（anima token create；客户端 Hub 设置填写 fa_at_...）",
  ].join("\n");

  const confirmed = await p.confirm({
    message: `确认以下配置？\n${summary}`,
    initialValue: true,
  });
  if (p.isCancel(confirmed) || !confirmed) {
    p.log.info("已保存项保留在 config.yaml，可随时重新运行 anima tunnel setup 继续");
    p.cancel("已取消");
    process.exit(0);
  }

  return omitUndefined({
    hostname: hostnameValue,
    apiToken,
    hubPort,
  });
}

export async function runTunnelSetup(opts: SetupPromptsOptions = {}): Promise<void> {
  if (!opts.skipInstall) {
    const s = p.spinner();
    s.start("安装 cloudflared…");
    try {
      await installCloudflared({
        onProgress: (msg) => s.message(msg),
      });
      s.stop("cloudflared 就绪");
    } catch (err) {
      s.stop("安装失败");
      p.log.error(err instanceof Error ? err.message : String(err));
      p.log.info(`手动下载: ${manualDownloadHint()}`);
      process.exit(1);
    }
  }

  const hubPort = resolveHubPort(opts.port);
  if (!(await hubReachable(hubPort)) && checkServerAlive() == null) {
    p.log.warn(`Hub 未在 127.0.0.1:${hubPort} 运行 — setup 可先完成，之后 anima service start`);
  }

  let input: Awaited<ReturnType<typeof runInteractivePrompts>>;
  if (opts.nonInteractive) {
    if (!opts.hostname) {
      p.log.error("非交互模式需要 --hostname");
      process.exit(1);
    }
    const draft = await loadTunnelDraft();
    const draftApiToken = draft?.credentials?.api_token;
    const savedToken = await loadSavedApiToken(draft);
    input = omitUndefined({
      hostname: opts.hostname,
      apiToken:
        (opts.apiToken ? resolveApiTokenFromRef(opts.apiToken) : undefined) ??
        savedToken ??
        (draftApiToken ? resolveApiTokenFromRef(draftApiToken) : undefined),
      hubPort,
    });
    await patchTunnelConfig({
      hostname: input.hostname,
      enabled: false,
    });
  } else {
    input = await runInteractivePrompts();
  }

  const s = p.spinner();
  s.start("配置 Tunnel…");

  try {
    const result = await runSetupWizard({
      hostname: input.hostname,
      hubPort: input.hubPort,
      ...omitUndefined({ apiToken: input.apiToken }),
      saveApiToken: (_token: string) => {
        void patchTunnelConfig({
          credentials: { api_token: TUNNEL_CREDENTIAL_REFS.apiToken },
        });
      },
      saveTunnelCredentials: (_json: string) => {
        void patchTunnelConfig({
          credentials: { tunnel_credentials: TUNNEL_CREDENTIAL_REFS.tunnelCredentials },
        });
      },
      patchConfig: (patch: Partial<TunnelConfigFields>) => {
        void patchTunnelConfig(patch);
      },
      onProgress: (msg: string) => s.message(msg),
    });
    s.stop("Tunnel 配置完成");

    p.log.success(`公网 URL: ${result.publicUrl}`);
    p.log.info("Console: " + result.publicUrl + "/console/dashboard");
    p.log.info("请运行 anima token create --subject-id <id> 创建 token，并在客户端 Hub 设置中填写");

    if (result.manualDnsSteps) {
      p.log.warn("公网 DNS 未就绪 — 手机/外网无法访问，请完成以下步骤：");
      for (const step of result.manualDnsSteps) {
        p.log.info(step);
      }
      p.log.info("Token 权限修复后可运行: anima tunnel dns");
    } else if (result.dnsConfigured) {
      p.log.success("DNS CNAME 已配置");
    }

    p.outro("运行 anima service start 启动 Hub 与 Tunnel");
  } catch (err) {
    s.stop("配置失败");
    const msg = err instanceof Error ? err.message : String(err);
    for (const line of msg.split("\n")) {
      if (line.trim()) p.log.error(line);
    }
    p.log.info("已填项已保存到 ~/.anima/config.yaml，修复后重新运行 anima tunnel setup 可续填");
    process.exit(1);
  }
}
