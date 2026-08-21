import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { PATHS } from "@freeanima/habitat/core/config/paths";
import { asRecord } from "@freeanima/shared/util";
import { expandConfigPath } from "../tls-paths.ts";

export type AcmeAccountStore = {
  accountUrl: string;
  accountKeyPem: string;
  directoryUrl: string;
  email: string;
};

function ensureTlsDir(): void {
  mkdirSync(PATHS.tlsDir, { recursive: true, mode: 0o700 });
}

export function defaultAcmeAccountPath(): string {
  return PATHS.tlsAcmeAccountFile;
}

export function readAcmeAccount(accountPath = defaultAcmeAccountPath()): AcmeAccountStore | null {
  const path = expandConfigPath(accountPath);
  if (!existsSync(path)) return null;
  try {
    const raw = asRecord(JSON.parse(readFileSync(path, "utf-8")));
    if (
      !raw ||
      typeof raw.accountUrl !== "string" ||
      typeof raw.accountKeyPem !== "string" ||
      typeof raw.directoryUrl !== "string" ||
      typeof raw.email !== "string"
    ) {
      return null;
    }
    return {
      accountUrl: raw.accountUrl,
      accountKeyPem: raw.accountKeyPem,
      directoryUrl: raw.directoryUrl,
      email: raw.email,
    };
  } catch {
    return null;
  }
}

export function writeAcmeAccount(
  account: AcmeAccountStore,
  accountPath = defaultAcmeAccountPath(),
): void {
  ensureTlsDir();
  const path = expandConfigPath(accountPath);
  writeFileSync(path, `${JSON.stringify(account, null, 2)}\n`, { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* ignore */
  }
}
