import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { X509Certificate } from "node:crypto";

import { expandConfigPath } from "./tls-paths.ts";
import { defaultHubTlsCertPath } from "./hub-tls-material.ts";

export type HubTlsIssuerKind = "mkcert" | "self-signed" | "missing";

function commandAvailable(name: string): boolean {
  const r = spawnSync("command", ["-v", name], { encoding: "utf-8", shell: true });
  return r.status === 0;
}

export function resolveMkcertCarootDir(): string | null {
  if (!commandAvailable("mkcert")) return null;
  const r = spawnSync("mkcert", ["-CAROOT"], { encoding: "utf-8" });
  if (r.status !== 0) return null;
  const caroot = r.stdout.trim();
  if (!caroot) return null;
  return caroot;
}

export function resolveMkcertRootCaPath(): string | null {
  const caroot = resolveMkcertCarootDir();
  if (!caroot) return null;
  const rootCaPath = `${caroot}/rootCA.pem`;
  return existsSync(rootCaPath) ? rootCaPath : null;
}

export function readMkcertRootCaPem(): string | null {
  const path = resolveMkcertRootCaPath();
  if (!path) return null;
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

export function detectHubTlsIssuerKind(
  certPath = expandConfigPath(defaultHubTlsCertPath()),
): HubTlsIssuerKind {
  try {
    if (!existsSync(certPath)) return "missing";
    const pem = readFileSync(certPath, "utf-8");
    const cert = new X509Certificate(pem);
    const issuer = cert.issuer.toLowerCase();
    if (issuer.includes("mkcert")) return "mkcert";
    return "self-signed";
  } catch {
    return "missing";
  }
}
