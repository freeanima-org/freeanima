import { AUTHENTICATION_ERROR_HINTS, INVALID_API_TOKEN_HINTS } from "./token-guide.ts";

export type CloudflareApiOptions = {
  apiToken: string;
  accountId?: string;
};

export type CloudflareApiErrorBody = {
  code?: number;
  message: string;
};

export type CfRequestMeta = {
  /** 用户可见操作名 */
  operation: string;
  method: string;
  path: string;
};

/** 日志用：不输出完整 token */
export function describeApiTokenForLog(token: string): string {
  const t = token.trim();
  if (!t) return "Token: （空）";
  if (/^credential\s*\(/i.test(t) || /^pass:/i.test(t)) {
    return `Token: 疑似未解析的 config 引用 → ${t.slice(0, 48)}${t.length > 48 ? "…" : ""}`;
  }
  if (t.length < 12) return `Token: 过短（${t.length} 字符）`;
  return `Token: ${t.length} 字符，${t.slice(0, 4)}…${t.slice(-4)}`;
}

const OPERATION_HINTS: Record<string, readonly string[]> = {
  "验证 API Token": [
    "若 curl verify 成功但此处失败，pass 中保存的 token 可能与 curl 测试的不是同一个。",
  ],
  "获取 Cloudflare 账号列表": [
    "需要 Token 能访问 Account 资源（建议 Account Resources 选「All accounts」）。",
  ],
  "创建 Cloudflare Tunnel": [
    "需要权限：Account · Cloudflare Tunnel · Edit。",
    "Token 的 Account Resources 须包含目标账号（与 config tunnel.cloudflare.account_id 一致）。",
  ],
  "获取 Tunnel 连接器令牌": ["需要权限：Account · Cloudflare Tunnel · Read 或 Edit。"],
  "配置 Tunnel ingress": ["需要权限：Account · Cloudflare Tunnel · Edit。"],
  "列出 DNS Zone": ["需要权限：Zone · Zone · Read（或 All zones）。"],
  "创建 DNS CNAME 记录": ["需要权限：Zone · DNS · Edit，且 Zone 范围包含目标域名。"],
  "创建 Access Application": ["需要权限：Account · Access: Apps and Policies · Edit。"],
  "创建 Access Allow Policy": ["需要权限：Account · Access: Apps and Policies · Edit。"],
};

function isAuthenticationError(errors: CloudflareApiErrorBody[]): boolean {
  return errors.some(
    (e) =>
      e.code === 10000 &&
      /authentication error/i.test(e.message) &&
      !/valid and active/i.test(e.message),
  );
}

function isInvalidApiToken(errors: CloudflareApiErrorBody[], summary: string): boolean {
  return (
    /invalid api token/i.test(summary) || errors.some((e) => /invalid api token/i.test(e.message))
  );
}

export function formatCloudflareApiFailure(
  meta: CfRequestMeta,
  httpStatus: number,
  errors: CloudflareApiErrorBody[] | undefined,
  apiToken: string,
  cfRay?: string | null,
): string {
  const errList = errors ?? [];
  const summary =
    errList
      .map((e) => (e.code !== undefined ? `[${e.code}] ${e.message}` : e.message))
      .join("; ") || `HTTP ${httpStatus}`;

  const lines = [
    `Cloudflare API 失败：${meta.operation}`,
    `  请求: ${meta.method} ${meta.path}`,
    `  错误: ${summary}`,
    `  ${describeApiTokenForLog(apiToken)}`,
  ];
  if (cfRay) lines.push(`  CF-Ray: ${cfRay}`);

  if (isInvalidApiToken(errList, summary)) {
    lines.push("", "排查建议：");
    for (const h of INVALID_API_TOKEN_HINTS) lines.push(`  · ${h}`);
  } else if (isAuthenticationError(errList)) {
    lines.push("", "排查建议：");
    for (const h of AUTHENTICATION_ERROR_HINTS) lines.push(`  · ${h}`);
    const opHints = OPERATION_HINTS[meta.operation];
    if (opHints) {
      for (const h of opHints) lines.push(`  · ${h}`);
    }
  } else if (/forbidden|not authorized|permission/i.test(summary)) {
    lines.push("", "排查建议：");
    lines.push("  · Token 有效但权限或资源范围不足，请在 Dashboard 编辑令牌权限后重试。");
    const opHints = OPERATION_HINTS[meta.operation];
    if (opHints) {
      for (const h of opHints) lines.push(`  · ${h}`);
    }
  }

  return lines.join("\n");
}

export async function cfFetch<T>(
  meta: CfRequestMeta,
  options: CloudflareApiOptions,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`https://api.cloudflare.com/client/v4${meta.path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${options.apiToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json()) as {
    success: boolean;
    errors?: CloudflareApiErrorBody[];
    result?: T;
  };
  if (!body.success) {
    throw new Error(
      formatCloudflareApiFailure(
        meta,
        res.status,
        body.errors,
        options.apiToken,
        res.headers.get("cf-ray"),
      ),
    );
  }
  return body.result as T;
}
