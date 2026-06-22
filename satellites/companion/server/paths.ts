import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { companionPackageRoot } from "./companion-root.ts";

const LEGACY_CONFIG_PATH = join(companionPackageRoot(), "companion-config.json");

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

export function companionConfigPath(): string {
  return join(companionHome(), "config.json");
}

export function legacyCompanionConfigPath(): string {
  return LEGACY_CONFIG_PATH;
}

export function publicModelsDir(): string {
  return join(companionPackageRoot(), "public", "models");
}

function migrateLegacyConfig(): void {
  const nextPath = companionConfigPath();
  if (existsSync(nextPath)) return;
  if (!existsSync(LEGACY_CONFIG_PATH)) return;

  try {
    const raw = readFileSync(LEGACY_CONFIG_PATH, "utf-8");
    mkdirSync(dirname(nextPath), { recursive: true });
    writeFileSync(nextPath, raw, "utf-8");
  } catch {
    /* 迁移失败时沿用默认配置 */
  }
}

/** 创建用户数据目录，并从旧 companion-config.json 一次性迁移配置 */
export function ensureCompanionDataDir(): void {
  mkdirSync(companionModelsDir(), { recursive: true });
  mkdirSync(companionMotionsDir(), { recursive: true });
  migrateLegacyConfig();
}
