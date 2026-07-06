/** Cloudflare Dashboard 创建的 API Token（非 cloudflared 隧道令牌） */
export const CLOUDFLARE_API_TOKEN_GUIDE = [
  "使用 Cloudflare Dashboard 创建的「API 令牌」，不是 Zero Trust 里隧道的连接器令牌。",
  "路径：我的个人资料 → API 令牌 → 创建令牌 → 自定义令牌",
  "建议权限：Account · Cloudflare Tunnel · Edit；Zone · DNS · Edit（自动 CNAME，必填）；",
  "文档：https://developers.cloudflare.com/fundamentals/api/get-started/create-token/",
] as const;

export const INVALID_API_TOKEN_HINTS = [
  "确认粘贴的是「API 令牌」(API Token)，不是「全局 API 密钥」(Global API Key)。",
  "不是 Zero Trust → 网络 → 连接器 / 隧道 里复制的隧道安装令牌。",
  "创建后只显示一次 — 若丢失需在 Dashboard 重新创建，无法查看旧令牌。",
  "检查首尾无空格、无引号；不要粘贴整段 JSON。",
  "令牌需包含 Account · Cloudflare Tunnel · Edit 与 Zone · DNS · Edit 权限。",
] as const;

/** Cloudflare 错误码 10000「Authentication error」（非 verify 成功时的提示消息） */
export const AUTHENTICATION_ERROR_HINTS = [
  "表示 Bearer Token 未被 Cloudflare 认可（在权限检查之前即失败）。",
  "常见原因：config 中 token 与 curl 测试的不一致；粘贴了隧道连接器令牌或 Global API Key。",
  "config 中 env() 被引号包裹是正常的 YAML 写法，读回后会正确解析。",
  "用同一 token 做 curl 验证（应与 setup 读取的一致）：",
  '  curl -s "https://api.cloudflare.com/client/v4/user/tokens/verify" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"',
  "若 verify 通过但后续步骤失败，检查 Token 的 Account / Zone 资源范围是否包含目标账号与域名。",
] as const;

/** 清理粘贴内容：去空白、去包裹引号 */
export function normalizeApiToken(raw: string): string {
  let t = raw.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  return t.replace(/\s+/g, "");
}

export type ApiTokenShapeError = { ok: false; reason: string };

/** 粘贴物是否像 API Token（非隧道 JSON / 非 Global Key 说明） */
export function validateApiTokenShape(token: string): { ok: true } | ApiTokenShapeError {
  if (!token) return { ok: false, reason: "Token 为空" };
  if (token.startsWith("{") || token.includes("AccountTag") || token.includes("TunnelSecret")) {
    return {
      ok: false,
      reason:
        "这像是 cloudflared 隧道凭证 JSON，不是 API Token。请在「我的个人资料 → API 令牌」创建。",
    };
  }
  if (token.length < 20) {
    return { ok: false, reason: "Token 过短，请确认完整粘贴" };
  }
  if (token.length === 37 && /^[a-f0-9]+$/i.test(token)) {
    return {
      ok: false,
      reason:
        "这像是「全局 API 密钥」(Global API Key)。请创建「API 令牌」(API Token)，本工具不支持 Global Key。",
    };
  }
  return { ok: true };
}
