import { homedir } from "node:os";
import { join } from "node:path";

import { PATHS } from "@freeanima/core/config";

/** 展开 leading ~ 与 $FREEANIMA_HOME 前缀 */
export function expandConfigPath(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("~/")) {
    return join(homedir(), trimmed.slice(2));
  }
  const homePrefix = "$FREEANIMA_HOME/";
  if (trimmed.startsWith(homePrefix)) {
    return join(PATHS.home, trimmed.slice(homePrefix.length));
  }
  return trimmed;
}

export function isIpv4Host(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

export function isIpv6Host(host: string): boolean {
  return host.includes(":");
}

/** mkcert / openssl SAN：localhost、loopback、bind hosts */
export function collectTlsSanNames(bindHosts: string[]): string[] {
  const names = new Set<string>(["localhost", "127.0.0.1", "::1"]);
  for (const raw of bindHosts) {
    const host = raw.trim();
    if (!host || host === "0.0.0.0") continue;
    names.add(host);
  }
  return [...names];
}

export function buildOpenSslSubjectAltName(sanNames: string[]): string {
  const parts: string[] = [];
  for (const name of sanNames) {
    if (isIpv4Host(name) || isIpv6Host(name)) {
      parts.push(`IP:${name}`);
    } else {
      parts.push(`DNS:${name}`);
    }
  }
  return parts.join(",");
}
