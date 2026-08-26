import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { asRecord } from "@freeanima/shared/util";

export type ClientConfig = {
  habitat_url: string;
  token: string;
};

export function configPath(): string {
  return join(homedir(), ".anima", "client", "config.json");
}

export function loadConfig(): ClientConfig | null {
  const p = configPath();
  if (!existsSync(p)) return null;
  try {
    const raw: unknown = JSON.parse(readFileSync(p, "utf-8"));
    const r = asRecord(raw);
    const habitat_url = typeof r?.habitat_url === "string" ? r.habitat_url.trim() : "";
    const token = typeof r?.token === "string" ? r.token.trim() : "";
    if (!habitat_url || !token) return null;
    return { habitat_url, token };
  } catch {
    return null;
  }
}

export function saveConfig(cfg: ClientConfig): void {
  const p = configPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(cfg, null, 2)}\n`, "utf-8");
}

export function maskToken(token: string): string {
  if (token.length <= 8) return "***";
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}
