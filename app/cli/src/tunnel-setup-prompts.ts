import * as p from "@clack/prompts";
import {
  TUNNEL_CREDENTIAL_REFS,
  TUNNEL_PASS_PATHS,
  type TunnelConfigFields,
} from "@freeanima/core/config";
import { credential, insertCredential, resolveCredentialRef } from "@freeanima/platform/config";
import {
  CLOUDFLARE_API_TOKEN_GUIDE,
  normalizeApiToken,
  validateApiTokenShape,
  runSetupWizard,
  verifyApiToken,
} from "@freeanima/platform/connectors/tunnel";
import { installCloudflared, manualDownloadHint } from "./tunnel-install.ts";
import { checkServerAlive, resolveProbeHost } from "./service-common.ts";
import { resolveHubPort } from "./tunnel-hub-port.ts";
import { loadTunnelDraft, patchTunnelConfig } from "./tunnel-config-patch.ts";

export type SetupPromptsOptions = {
  nonInteractive?: boolean;
  skipInstall?: boolean;
  hostname?: string;
  team?: string;
  email?: string;
  apiToken?: string;
  accessApi?: boolean;
  sessionDuration?: string;
  port?: number;
  yes?: boolean;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidHostname(host: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host);
}

function draftHasApiToken(draft: TunnelConfigFields | undefined): boolean {
  const ref = draft?.credentials?.api_token;
  if (!ref) return false;
  return ref.includes(TUNNEL_PASS_PATHS.apiToken) || ref === TUNNEL_CREDENTIAL_REFS.apiToken;
}

function resolveApiTokenFromRef(ref: string): string | undefined {
  try {
    const raw = resolveCredentialRef(ref, "token");
    return normalizeApiToken(raw) || undefined;
  } catch {
    return undefined;
  }
}

function loadSavedApiToken(): string | undefined {
  try {
    const token = normalizeApiToken(credential(TUNNEL_PASS_PATHS.apiToken, "token"));
    return token || undefined;
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
    const body = (await res.json()) as { status?: string };
    return body.status === "ok";
  } catch {
    return false;
  }
}

async function runInteractivePrompts(): Promise<{
  hostname: string;
  teamName: string;
  email: string;
  apiToken?: string;
  createAccessViaApi: boolean;
  sessionDuration: string;
  hubPort: number;
}> {
  const draft = loadTunnelDraft();
  if (draft?.hostname || draft?.team_name || draft?.access?.allowed_emails?.length) {
    p.log.info("检测到已保存的 tunnel 配置，将预填未完成项");
  }

  p.intro("FreeAnima Cloudflare Tunnel 设置");

  const hostname = await p.text({
    message: "公网 hostname（如 anima.example.com）",
    initialValue: draft?.hostname ?? "",
    validate: (v) => {
      if (!v?.trim()) return "必填";
      if (!isValidHostname(v.trim())) return "无效的域名格式";
      return undefined;
    },
  });
  if (p.isCancel(hostname)) process.exit(0);
  const hostnameValue = String(hostname).trim();
  patchTunnelConfig({ hostname: hostnameValue, enabled: false });

  const teamName = await p.text({
    message: "Zero Trust team 名称（如 myteam → myteam.cloudflareaccess.com）",
    initialValue: draft?.team_name ?? "",
    validate: (v) => (!v?.trim() ? "必填" : undefined),
  });
  if (p.isCancel(teamName)) process.exit(0);
  const teamNameValue = String(teamName).trim();
  patchTunnelConfig({ team_name: teamNameValue, enabled: false });

  const email = await p.text({
    message: "允许访问的邮箱（Google 登录账号）",
    initialValue: draft?.access?.allowed_emails?.[0] ?? "",
    validate: (v) => {
      if (!v?.trim()) return "必填";
      if (!isValidEmail(v.trim())) return "无效邮箱";
      return undefined;
    },
  });
  if (p.isCancel(email)) process.exit(0);
  const emailValue = String(email).trim();
  patchTunnelConfig({
    access: { enabled: true, allowed_emails: [emailValue] },
    enabled: false,
  });

  const tokenOptions: Array<{ value: string; label: string }> = [];
  if (draftHasApiToken(draft)) {
    tokenOptions.push({ value: "saved", label: "使用 pass 中已保存的 API Token" });
  }
  tokenOptions.push(
    { value: "new", label: "粘贴新的 Cloudflare API Token" },
    { value: "none", label: "没有 — Dashboard 手动完成 Tunnel / Access" },
  );

  const tokenChoice = await p.select({
    message: "Cloudflare API Token（用于自动创建 Tunnel，不是 cloudflared 隧道令牌）",
    options: tokenOptions,
    initialValue: draftHasApiToken(draft) ? "saved" : undefined,
  });
  if (p.isCancel(tokenChoice)) process.exit(0);

  let apiToken: string | undefined;
  let createAccessViaApi = false;

  if (tokenChoice === "saved") {
    apiToken = loadSavedApiToken();
    if (!apiToken) {
      p.log.warn("pass 中未读到 API Token，请重新粘贴");
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
      insertCredential(TUNNEL_PASS_PATHS.apiToken, { token: apiToken });
      patchTunnelConfig({
        credentials: { api_token: TUNNEL_CREDENTIAL_REFS.apiToken },
        enabled: false,
      });
      p.log.success("API Token 已写入 pass");
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
    patchTunnelConfig({
      credentials: { api_token: TUNNEL_CREDENTIAL_REFS.apiToken },
      enabled: false,
    });
  }

  if (apiToken) {
    const accessConfirm = await p.confirm({
      message: "是否用 API 自动创建 Access Application + Allow Policy？",
      initialValue: true,
    });
    if (p.isCancel(accessConfirm)) process.exit(0);
    createAccessViaApi = accessConfirm;
  }

  const sessionChoice = await p.select({
    message: "Access Session 时长",
    options: [
      { value: "24h", label: "24 小时" },
      { value: "168h", label: "7 天（推荐）" },
      { value: "720h", label: "30 天" },
    ],
    initialValue: draft?.access?.session_duration ?? "168h",
  });
  if (p.isCancel(sessionChoice)) process.exit(0);
  const sessionDuration = String(sessionChoice);
  patchTunnelConfig({ access: { session_duration: sessionDuration }, enabled: false });

  const hubPort = resolveHubPort();

  const summary = [
    `hostname: ${hostnameValue}`,
    `team: ${teamNameValue}`,
    `email: ${emailValue}`,
    `hub: 127.0.0.1:${hubPort}`,
    apiToken ? "API: 自动 provisioning" : "API: 手动 Dashboard",
    createAccessViaApi ? "Access: API 创建" : "Access: 手动 Dashboard",
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

  return {
    hostname: hostnameValue,
    teamName: teamNameValue,
    email: emailValue,
    apiToken,
    createAccessViaApi,
    sessionDuration,
    hubPort,
  };
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
    if (!opts.hostname || !opts.team || !opts.email) {
      p.log.error("非交互模式需要 --hostname --team --email");
      process.exit(1);
    }
    input = {
      hostname: opts.hostname,
      teamName: opts.team,
      email: opts.email,
      apiToken:
        (opts.apiToken ? resolveApiTokenFromRef(opts.apiToken) : undefined) ??
        loadSavedApiToken() ??
        (loadTunnelDraft()?.credentials?.api_token
          ? resolveApiTokenFromRef(loadTunnelDraft()!.credentials!.api_token!)
          : undefined),
      createAccessViaApi: opts.accessApi ?? false,
      sessionDuration: opts.sessionDuration ?? "168h",
      hubPort,
    };
    patchTunnelConfig({
      hostname: input.hostname,
      team_name: input.teamName,
      access: {
        enabled: true,
        allowed_emails: [input.email],
        session_duration: input.sessionDuration,
      },
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
      teamName: input.teamName,
      email: input.email,
      hubPort: input.hubPort,
      sessionDuration: input.sessionDuration,
      apiToken: input.apiToken,
      createAccessViaApi: input.createAccessViaApi,
      saveApiToken: (token) => {
        insertCredential(TUNNEL_PASS_PATHS.apiToken, { token });
      },
      saveTunnelCredentials: (json) => {
        insertCredential(TUNNEL_PASS_PATHS.tunnelCredentials, { json });
      },
      patchConfig: (patch) => {
        patchTunnelConfig(patch);
      },
      onProgress: (msg) => s.message(msg),
    });
    s.stop("Tunnel 配置完成");

    p.log.success(`公网 URL: ${result.publicUrl}`);
    p.log.info("Admin: " + result.publicUrl + "/admin/dashboard");

    if (result.manualDnsSteps) {
      p.log.warn("公网 DNS 未就绪 — 手机/外网无法访问，请完成以下步骤：");
      for (const step of result.manualDnsSteps) {
        p.log.info(step);
      }
      p.log.info("Token 权限修复后可运行: anima tunnel dns");
    } else if (result.dnsConfigured) {
      p.log.success("DNS CNAME 已配置");
    }

    if (result.manualAccessSteps) {
      p.log.warn("请在 Cloudflare Dashboard 完成 Access 配置：");
      for (const step of result.manualAccessSteps) {
        p.log.info(step);
      }
    }

    if (!result.tunnel?.access?.audience) {
      p.log.warn("tunnel.access.audience 未设置 — JWT 校验在配置 AUD 后生效");
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
