import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";

import { PATHS } from "@freeanima/habitat/core/config/paths";
import { logComponent } from "@freeanima/habitat/platform/logging";

import { certSanCoversRequired, normalizeSanName, readCertSanNames } from "../cert-san.ts";
import { expandConfigPath } from "../tls-paths.ts";
import { issueAcmeCertificate } from "./acme-client.ts";

/** 剩余有效期大于此天数则复用证书 */
export const ACME_RENEW_BEFORE_DAYS = 30;

export type EnsureAcmeMaterialOptions = {
  certPath: string;
  keyPath: string;
  email: string;
  domains: string[];
  staging?: boolean;
  accountPath?: string;
  /** 注入签发函数（单测 mock） */
  issueFn?: typeof issueAcmeCertificate;
  /** 注入「现在」时间（单测） */
  now?: Date;
};

export type AcmeHabitatTlsMaterial = {
  certPath: string;
  keyPath: string;
  source: "acme";
};

export type EnsureAcmeMaterialResult = {
  material: AcmeHabitatTlsMaterial;
  renewed: boolean;
};

function ensureTlsDirForFile(filePath: string): void {
  mkdirSync(PATHS.tlsDir, { recursive: true, mode: 0o700 });
  const slash = filePath.lastIndexOf("/");
  const keyDir = slash >= 0 ? filePath.slice(0, slash) : PATHS.tlsDir;
  if (keyDir && keyDir !== filePath) {
    mkdirSync(keyDir, { recursive: true, mode: 0o700 });
  }
}

function secureKeyFile(keyPath: string): void {
  try {
    chmodSync(keyPath, 0o600);
  } catch {
    /* ignore */
  }
}

function tlsFilesReadable(certPath: string, keyPath: string): boolean {
  try {
    return existsSync(certPath) && existsSync(keyPath);
  } catch {
    return false;
  }
}

function removeTlsFiles(certPath: string, keyPath: string): void {
  for (const filePath of [certPath, keyPath]) {
    try {
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }
}

function daysUntilExpiry(certPath: string, now: Date): number | null {
  try {
    const pem = readFileSync(certPath, "utf-8");
    const cert = new X509Certificate(pem);
    const ms = new Date(cert.validTo).getTime() - now.getTime();
    return ms / (24 * 60 * 60 * 1000);
  } catch {
    return null;
  }
}

function normalizeDomains(domains: string[]): string[] {
  return [...new Set(domains.map((d) => normalizeSanName(d)).filter(Boolean))];
}

/** 现有证书是否覆盖域名且剩余有效期充足 */
export function existingAcmeCertReusable(
  certPath: string,
  keyPath: string,
  domains: string[],
  now: Date,
  renewBeforeDays = ACME_RENEW_BEFORE_DAYS,
): boolean {
  if (!tlsFilesReadable(certPath, keyPath)) return false;
  const certSan = readCertSanNames(certPath);
  if (!certSan) return false;
  if (!certSanCoversRequired(certSan, domains)) return false;
  const days = daysUntilExpiry(certPath, now);
  if (days === null) return false;
  return days > renewBeforeDays;
}

function writePemPair(certPath: string, keyPath: string, certPem: string, keyPem: string): void {
  ensureTlsDirForFile(certPath);
  ensureTlsDirForFile(keyPath);
  writeFileSync(certPath, certPem.endsWith("\n") ? certPem : `${certPem}\n`, { mode: 0o644 });
  writeFileSync(keyPath, keyPem.endsWith("\n") ? keyPem : `${keyPem}\n`, { mode: 0o600 });
  secureKeyFile(keyPath);
}

/**
 * 确保 ACME 证书存在：覆盖 domains 且有效期 > 30 天则复用，否则签发/续期。
 * 调用前须已启动 HTTP-01 challenge server。
 */
export async function ensureAcmeMaterialWithMeta(
  options: EnsureAcmeMaterialOptions,
): Promise<EnsureAcmeMaterialResult> {
  const certPath = expandConfigPath(options.certPath);
  const keyPath = expandConfigPath(options.keyPath);
  const domains = normalizeDomains(options.domains);
  const now = options.now ?? new Date();

  if (existingAcmeCertReusable(certPath, keyPath, domains, now)) {
    logComponent("startup").info("复用现有 ACME 证书", { cert: certPath, domains });
    return { material: { certPath, keyPath, source: "acme" }, renewed: false };
  }

  if (tlsFilesReadable(certPath, keyPath)) {
    logComponent("startup").info("ACME 证书将重新签发（域名不匹配或即将过期）", {
      cert: certPath,
      domains,
    });
    removeTlsFiles(certPath, keyPath);
  }

  const issueFn = options.issueFn ?? issueAcmeCertificate;
  const issued = await issueFn({
    email: options.email,
    domains,
    ...(options.staging !== undefined ? { staging: options.staging } : {}),
    ...(options.accountPath ? { accountPath: options.accountPath } : {}),
  });

  writePemPair(certPath, keyPath, issued.certPem, issued.keyPem);
  logComponent("startup").info("ACME 证书已写入", { cert: certPath, domains });
  return { material: { certPath, keyPath, source: "acme" }, renewed: true };
}

export async function ensureAcmeMaterial(
  options: EnsureAcmeMaterialOptions,
): Promise<AcmeHabitatTlsMaterial> {
  const result = await ensureAcmeMaterialWithMeta(options);
  return result.material;
}
