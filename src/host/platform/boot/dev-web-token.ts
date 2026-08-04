import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { PATHS } from "@freeanima/host/core/config";
import { resolveAndBindWorldContext } from "@freeanima/host/core/config/world-context-pg";
import {
  createServiceApiTokenWithSecret,
  listServiceApiTokensBySubject,
  revokeServiceApiToken,
  verifyServiceApiToken,
} from "@freeanima/host/core/db/pg/service-api-token";
import type { RuntimeConfigStore } from "@freeanima/host/platform/config";
import { logComponent } from "@freeanima/host/platform/logging";

import { startupLog } from "./status.ts";

export const DEV_WEB_TOKEN_NAME = "dev-web";
export const FREEANIMA_DEV_HABITAT_ENV = "FREEANIMA_DEV_HABITAT";

export function isDevHabitatProcess(): boolean {
  return process.env[FREEANIMA_DEV_HABITAT_ENV] === "1";
}

export function readDevWebTokenFile(): string | null {
  const fromEnv = process.env.FREEANIMA_DEV_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    if (!existsSync(PATHS.devWebTokenFile)) return null;
    const raw = readFileSync(PATHS.devWebTokenFile, "utf-8").trim();
    return raw || null;
  } catch {
    return null;
  }
}

function writeDevWebTokenFile(plaintext: string): void {
  mkdirSync(dirname(PATHS.devWebTokenFile), { recursive: true });
  writeFileSync(PATHS.devWebTokenFile, `${plaintext}\n`, { encoding: "utf-8", mode: 0o600 });
  try {
    chmodSync(PATHS.devWebTokenFile, 0o600);
  } catch {
    /* ignore */
  }
}

/**
 * 确保 `dev-web` token 明文在 PATHS.devWebTokenFile（仅 FREEANIMA_DEV_HABITAT=1）。
 * 文件已有内容且能通过 DB 校验则复用；否则 revoke 旧同名 token 后新建并覆写文件
 * （避免 integration 清库后文件残留导致 Web「认证失败」）。
 */
export async function ensureDevWebTokenFile(config: RuntimeConfigStore): Promise<void> {
  if (!isDevHabitatProcess()) return;

  const existingFile = readDevWebTokenFile();
  if (existingFile) {
    const verified = await verifyServiceApiToken(existingFile);
    if (verified) {
      if (process.env.FREEANIMA_DEV_TOKEN?.trim()) {
        writeDevWebTokenFile(existingFile);
      }
      startupLog(`dev-web token ready (${PATHS.devWebTokenFile})`);
      return;
    }
    startupLog("dev-web token file stale (not in DB); recreating…");
  }

  const ctx = await resolveAndBindWorldContext(config.data);
  const existing = await listServiceApiTokensBySubject(ctx.user_subject_id);
  for (const row of existing) {
    if (row.name === DEV_WEB_TOKEN_NAME && !row.revoked_at) {
      await revokeServiceApiToken(row.id);
    }
  }

  const result = await createServiceApiTokenWithSecret({
    subject_id: ctx.user_subject_id,
    name: DEV_WEB_TOKEN_NAME,
  });
  writeDevWebTokenFile(result.plaintext);
  startupLog(`Wrote dev-web token → ${PATHS.devWebTokenFile}`);
  logComponent("startup").info(
    "dev:habitat 已写入 Web 自动填充 token（仅本机文件；Vite serve 会注入 config.json）",
  );
}
