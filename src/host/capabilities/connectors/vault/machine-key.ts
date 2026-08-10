import { mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";

import { PATHS } from "@freeanima/host/core/config/paths";
import { importRawAesKey, randomSalt } from "@freeanima/shared/vault-crypto";

export const AGENT_VAULT_LOCKED = "AGENT_VAULT_LOCKED";
export const AGENT_MACHINE_KEY_BYTES = 32;

let cachedMachineKey: CryptoKey | null = null;

function ensureVaultDir(): void {
  mkdirSync(dirname(PATHS.vaultAgentMachineKey), { recursive: true });
}

function bytesToB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function b64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function readCacheFileRaw(): Uint8Array | null {
  const path = PATHS.vaultAgentMachineKey;
  if (!existsSync(path)) return null;
  const raw = new Uint8Array(readFileSync(path));
  if (raw.length !== AGENT_MACHINE_KEY_BYTES) {
    throw new Error("agent machine key invalid length");
  }
  return raw;
}

function writeCacheFile(raw: Uint8Array): void {
  if (raw.length !== AGENT_MACHINE_KEY_BYTES) {
    throw new Error("agent machine key invalid length");
  }
  ensureVaultDir();
  const path = PATHS.vaultAgentMachineKey;
  writeFileSync(path, Buffer.from(raw));
  chmodSync(path, 0o600);
}

export function resetAgentMachineKeyCacheForTest(): void {
  cachedMachineKey = null;
}

/** Habitat 本地是否已解锁（内存或有效缓存文件）。 */
export function isAgentVaultUnlocked(): boolean {
  if (cachedMachineKey) return true;
  try {
    return readCacheFileRaw() !== null;
  } catch {
    return false;
  }
}

/**
 * 读取磁盘缓存 raw（供迁入 User 库 SSOT）。
 * 无缓存时返回 null；不自动生成。provision 总会落盘，故与 unlocked 对齐。
 */
export function peekAgentMachineKeyRaw(): Uint8Array | null {
  return readCacheFileRaw();
}

export function peekAgentMachineKeyB64(): string | null {
  const raw = peekAgentMachineKeyRaw();
  return raw ? bytesToB64(raw) : null;
}

/** 将根密钥写入可重建缓存（内存 + 文件）。 */
export async function provisionAgentMachineKey(raw: Uint8Array): Promise<void> {
  writeCacheFile(raw);
  cachedMachineKey = await importRawAesKey(raw);
}

export async function provisionAgentMachineKeyB64(keyB64: string): Promise<void> {
  await provisionAgentMachineKey(b64ToBytes(keyB64));
}

/** 清除内存与磁盘缓存（锁定 Agent 库）。 */
export function lockAgentMachineKey(): void {
  cachedMachineKey = null;
  const path = PATHS.vaultAgentMachineKey;
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

/**
 * 获取 Agent vault 解密用 CryptoKey。
 * 仅从缓存加载；缺失时抛 `AGENT_VAULT_LOCKED`（不再静默生成真相源文件）。
 */
export async function getAgentMachineKey(): Promise<CryptoKey> {
  if (cachedMachineKey) return cachedMachineKey;
  const raw = readCacheFileRaw();
  if (!raw) {
    throw new Error(AGENT_VAULT_LOCKED);
  }
  cachedMachineKey = await importRawAesKey(raw);
  return cachedMachineKey;
}

export function generateAgentMachineKeyRaw(): Uint8Array {
  const raw = new Uint8Array(AGENT_MACHINE_KEY_BYTES);
  crypto.getRandomValues(raw);
  return raw;
}

export function generateAgentMachineKeyB64(): string {
  return bytesToB64(generateAgentMachineKeyRaw());
}

export { randomSalt, bytesToB64, b64ToBytes };
