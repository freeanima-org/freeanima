import { cfFetch, type CloudflareApiOptions } from "./cloudflare-fetch.ts";

export type AccessAppResult = {
  id: string;
  aud: string;
  domain: string;
};

export type AccessPolicyResult = {
  id: string;
  name: string;
};

export async function createAccessApplication(
  options: CloudflareApiOptions,
  params: {
    hostname: string;
    sessionDuration: string;
  },
): Promise<AccessAppResult> {
  if (!options.accountId) throw new Error("accountId 必填");
  const result = await cfFetch<AccessAppResult>(
    {
      operation: "创建 Access Application",
      method: "POST",
      path: `/accounts/${options.accountId}/access/apps`,
    },
    options,
    {
      method: "POST",
      body: JSON.stringify({
        type: "self_hosted",
        name: `FreeAnima ${params.hostname}`,
        domain: params.hostname,
        session_duration: params.sessionDuration,
        auto_redirect_to_identity: true,
        allowed_idps: [],
      }),
    },
  );
  return result;
}

export async function createEmailAllowPolicy(
  options: CloudflareApiOptions,
  appId: string,
  email: string,
): Promise<AccessPolicyResult> {
  if (!options.accountId) throw new Error("accountId 必填");
  return cfFetch(
    {
      operation: "创建 Access Allow Policy",
      method: "POST",
      path: `/accounts/${options.accountId}/access/apps/${appId}/policies`,
    },
    options,
    {
      method: "POST",
      body: JSON.stringify({
        name: `Allow ${email}`,
        decision: "allow",
        include: [{ email: { email } }],
        precedence: 1,
      }),
    },
  );
}

export function manualAccessDashboardSteps(params: {
  hostname: string;
  teamName: string;
  email: string;
}): string[] {
  return [
    `1. 打开 Zero Trust Dashboard → Access → Applications → Add an application → Self-hosted`,
    `2. 域名填写: ${params.hostname}`,
    `3. 添加 Allow Policy: Email equals ${params.email}`,
    `4. Identity providers: 启用 Google（或其他 IdP）`,
    `5. 创建后在 Application 详情复制 AUD (Application Audience) TAG`,
    `6. Tunnel 路由中开启 Protect with Access，关联此 Application`,
    `7. 将 AUD 写入 config.yaml tunnel.access.audience，或重新运行 anima tunnel setup`,
  ];
}
