import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { PATHS } from "@freeanima/host/core/config";
import { logComponent } from "@freeanima/host/platform/logging";

import { certSanCoversRequired, readCertSanNames } from "./cert-san.ts";
import { buildOpenSslSubjectAltName, collectTlsSanNames, expandConfigPath } from "./tls-paths.ts";

export type HabitatTlsMaterialSource = "existing" | "mkcert" | "self-signed";

export type HabitatTlsMaterial = {
  certPath: string;
  keyPath: string;
  source: HabitatTlsMaterialSource;
  passphrase?: string;
};

export type EnsureHabitatTlsMaterialOptions = {
  certPath: string;
  keyPath: string;
  auto: boolean;
  bindHosts: string[];
  allowedHosts?: string[];
  passphrase?: string;
};

function commandAvailable(name: string): boolean {
  const r = spawnSync("command", ["-v", name], { encoding: "utf-8", shell: true });
  return r.status === 0;
}

function tlsFilesReadable(certPath: string, keyPath: string): boolean {
  try {
    return existsSync(certPath) && existsSync(keyPath);
  } catch {
    return false;
  }
}

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
    /* ignore on platforms without chmod */
  }
}

function mkcertCaReady(): boolean {
  if (!commandAvailable("mkcert")) return false;
  const r = spawnSync("mkcert", ["-CAROOT"], { encoding: "utf-8" });
  if (r.status !== 0) return false;
  const caroot = r.stdout.trim();
  if (!caroot) return false;
  return existsSync(`${caroot}/rootCA.pem`);
}

function tryGenerateWithMkcert(certPath: string, keyPath: string, sanNames: string[]): boolean {
  if (!mkcertCaReady()) return false;
  ensureTlsDirForFile(certPath);
  const args = ["-cert-file", certPath, "-key-file", keyPath, ...sanNames];
  const r = spawnSync("mkcert", args, { encoding: "utf-8" });
  if (r.status !== 0) {
    logComponent("startup").warn("mkcert 生成 TLS 证书失败，将尝试 openssl 自签", {
      stderr: r.stderr?.trim() || r.stdout?.trim(),
    });
    return false;
  }
  secureKeyFile(keyPath);
  return tlsFilesReadable(certPath, keyPath);
}

function tryGenerateWithOpenSsl(certPath: string, keyPath: string, sanNames: string[]): boolean {
  if (!commandAvailable("openssl")) return false;
  ensureTlsDirForFile(certPath);
  const san = buildOpenSslSubjectAltName(sanNames);
  const r = spawnSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-days",
      "825",
      "-nodes",
      "-subj",
      "/CN=localhost",
      "-addext",
      `subjectAltName=${san}`,
    ],
    { encoding: "utf-8" },
  );
  if (r.status !== 0) {
    logComponent("startup").warn("openssl 自签 TLS 证书失败", {
      stderr: r.stderr?.trim() || r.stdout?.trim(),
    });
    return false;
  }
  secureKeyFile(keyPath);
  return tlsFilesReadable(certPath, keyPath);
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

function existingMaterialCoversSan(
  certPath: string,
  keyPath: string,
  requiredSan: string[],
): boolean {
  if (!tlsFilesReadable(certPath, keyPath)) return false;
  const certSan = readCertSanNames(certPath);
  if (!certSan) return false;
  return certSanCoversRequired(certSan, requiredSan);
}

/**
 * 确保 Habitat TLS cert/key 存在；auto 时优先 mkcert，fallback openssl 自签。
 */
export function ensureHabitatTlsMaterial(
  options: EnsureHabitatTlsMaterialOptions,
): HabitatTlsMaterial {
  const certPath = expandConfigPath(options.certPath);
  const keyPath = expandConfigPath(options.keyPath);
  const passphrase = options.passphrase?.trim() || undefined;
  const allowedHosts = options.allowedHosts ?? [];
  const requiredSan = collectTlsSanNames(options.bindHosts, allowedHosts);

  if (existingMaterialCoversSan(certPath, keyPath, requiredSan)) {
    return { certPath, keyPath, source: "existing", ...(passphrase ? { passphrase } : {}) };
  }

  if (tlsFilesReadable(certPath, keyPath) && !options.auto) {
    logComponent("startup").warn("Habitat TLS 证书 SAN 未覆盖当前配置，auto=false 不会自动重签", {
      cert: certPath,
      requiredSan,
    });
    return { certPath, keyPath, source: "existing", ...(passphrase ? { passphrase } : {}) };
  }

  if (tlsFilesReadable(certPath, keyPath)) {
    logComponent("startup").info("Habitat TLS 证书 SAN 已过期，将重新生成", {
      cert: certPath,
      requiredSan,
    });
    removeTlsFiles(certPath, keyPath);
  }

  if (!options.auto) {
    throw new Error(`TLS 证书或私钥不存在（auto=false）：cert=${certPath} key=${keyPath}`);
  }

  const sanNames = requiredSan;

  if (tryGenerateWithMkcert(certPath, keyPath, sanNames)) {
    logComponent("startup").info("Habitat TLS 证书已生成（mkcert）", { cert: certPath });
    return { certPath, keyPath, source: "mkcert", ...(passphrase ? { passphrase } : {}) };
  }

  if (tryGenerateWithOpenSsl(certPath, keyPath, sanNames)) {
    logComponent("startup").info("Habitat TLS 证书已生成（openssl 自签）", { cert: certPath });
    return { certPath, keyPath, source: "self-signed", ...(passphrase ? { passphrase } : {}) };
  }

  throw new Error(
    "无法自动生成 Habitat TLS 证书：请安装 mkcert（mkcert -install）或 openssl，或在 config.yaml 指定 cert/key",
  );
}

export function defaultHabitatTlsCertPath(): string {
  return PATHS.tlsCertFile;
}

export function defaultHabitatTlsKeyPath(): string {
  return PATHS.tlsKeyFile;
}
