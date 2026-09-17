import { readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";

/** 统一 SAN 条目比较（DNS 小写；IPv6 loopback 归一） */
export function normalizeSanName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "0:0:0:0:0:0:0:1") return "::1";
  if (isIpv4Host(trimmed) || isIpv6Host(trimmed)) return trimmed;
  return trimmed.toLowerCase();
}

function isIpv4Host(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isIpv6Host(host: string): boolean {
  return host.includes(":");
}

/** 解析 Node `X509Certificate.subjectAltName`（如 `DNS:localhost, IP Address:127.0.0.1`） */
export function parseSubjectAltNameField(san: string | undefined): Set<string> {
  const names = new Set<string>();
  if (!san) return names;
  for (const part of san.split(",")) {
    const trimmed = part.trim();
    const dnsMatch = /^DNS:(.+)$/i.exec(trimmed);
    if (dnsMatch?.[1]) {
      names.add(normalizeSanName(dnsMatch[1]));
      continue;
    }
    const ipMatch = /^IP(?: Address)?:(.+)$/i.exec(trimmed);
    if (ipMatch?.[1]) {
      names.add(normalizeSanName(ipMatch[1].trim()));
    }
  }
  return names;
}

export function readCertSanNames(certPath: string): Set<string> | null {
  try {
    const pem = readFileSync(certPath, "utf-8");
    const cert = new X509Certificate(pem);
    return parseSubjectAltNameField(cert.subjectAltName);
  } catch {
    return null;
  }
}

export function certSanCoversRequired(certSan: Set<string>, required: string[]): boolean {
  if (required.length === 0) return certSan.size > 0;
  const normalizedCert = new Set([...certSan].map(normalizeSanName));
  return required.every((name) => normalizedCert.has(normalizeSanName(name)));
}
