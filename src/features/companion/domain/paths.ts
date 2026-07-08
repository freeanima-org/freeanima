import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** FREEANIMA_HOME ?? ~/.anima */
export function animaHomeDir(): string {
  return process.env.FREEANIMA_HOME ?? join(homedir(), ".anima");
}

export function companionHome(): string {
  return join(animaHomeDir(), "companion");
}

export function companionModelsDir(): string {
  return join(companionHome(), "models");
}

export function companionMotionsDir(): string {
  return join(companionHome(), "motions");
}

export function companionCacheDir(): string {
  return join(companionHome(), "cache");
}

export function companionConfigPath(): string {
  return join(companionHome(), "config.json");
}

function migrateLegacyConfig(): void {
  const nextPath = companionConfigPath();
  if (existsSync(nextPath)) return;
  const legacyPath = join(companionHome(), "companion-config.json");
  if (!existsSync(legacyPath)) return;
  try {
    const raw = readFileSync(legacyPath, "utf-8");
    mkdirSync(dirname(nextPath), { recursive: true });
    writeFileSync(nextPath, raw, "utf-8");
  } catch {
    /* 迁移失败时沿用默认配置 */
  }
}

/** 创建用户数据目录 */
export function ensureCompanionDataDir(): void {
  mkdirSync(companionModelsDir(), { recursive: true });
  mkdirSync(companionMotionsDir(), { recursive: true });
  mkdirSync(companionCacheDir(), { recursive: true });
  migrateLegacyConfig();
}
