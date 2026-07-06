import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { homePath } from "./paths.ts";

/** Hub 托管 Web UI 的 loopback bootstrap token（明文，仅本机可读） */
export const LOOPBACK_WEB_AUTH_TOKEN_REL = "web/loopback-auth.token";

export function loopbackWebAuthTokenPath(): string {
  return homePath(LOOPBACK_WEB_AUTH_TOKEN_REL);
}

/** 进程 env 或 ~/.anima/web/loopback-auth.token */
export function readLoopbackWebAuthTokenFromEnvOrFile(): string | null {
  const fromEnv = process.env.FREEANIMA_REMOTE_AUTH_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const path = loopbackWebAuthTokenPath();
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf-8").trim();
  return raw || null;
}

export function writeLoopbackWebAuthTokenFile(plaintext: string): void {
  const trimmed = plaintext.trim();
  if (!trimmed) throw new Error("loopback web auth token 不能为空");
  const path = loopbackWebAuthTokenPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${trimmed}\n`, { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    // Windows 等环境可能不支持 chmod
  }
}
