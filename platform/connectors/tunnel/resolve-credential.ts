import { TUNNEL_CREDENTIAL_REFS, TUNNEL_PASS_PATHS } from "@freeanima/core/config";
import { resolveCredentialRef } from "@freeanima/platform/config/resolve";
import { normalizeApiToken } from "./token-guide.ts";

/** 从 config credential() 引用或明文解析 API Token */
export function resolveTunnelApiToken(ref: string): string {
  const raw = resolveCredentialRef(ref, "token");
  return normalizeApiToken(raw);
}

/** 从 config 引用解析 cloudflared 隧道凭证 JSON */
export function resolveTunnelCredentials(ref: string): string {
  return resolveCredentialRef(ref, "json");
}

export function tunnelApiTokenConfigRef(): string {
  return TUNNEL_CREDENTIAL_REFS.apiToken;
}

export function tunnelCredentialsConfigRef(): string {
  return TUNNEL_CREDENTIAL_REFS.tunnelCredentials;
}

export { TUNNEL_PASS_PATHS };
