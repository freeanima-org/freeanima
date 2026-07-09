import { mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync } from "node:fs";
import { dirname } from "node:path";

import { PATHS } from "@freeanima/core/config/paths";
import { importRawAesKey, randomSalt } from "@freeanima/shared/vault-crypto";

let cachedMachineKey: CryptoKey | null = null;

function ensureVaultDir(): void {
  mkdirSync(dirname(PATHS.vaultAgentMachineKey), { recursive: true });
}

export function resetAgentMachineKeyCacheForTest(): void {
  cachedMachineKey = null;
}

export async function getAgentMachineKey(): Promise<CryptoKey> {
  if (cachedMachineKey) return cachedMachineKey;
  ensureVaultDir();
  const path = PATHS.vaultAgentMachineKey;
  if (!existsSync(path)) {
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    writeFileSync(path, Buffer.from(raw));
    chmodSync(path, 0o600);
  }
  const raw = new Uint8Array(readFileSync(path));
  if (raw.length !== 32) {
    throw new Error("agent machine key invalid length");
  }
  cachedMachineKey = await importRawAesKey(raw);
  return cachedMachineKey;
}

export { randomSalt };
