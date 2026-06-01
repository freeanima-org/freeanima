import { join } from "node:path";
import { PATHS } from "./paths.js";

/**
 * 历史 L1 JSONL 路径（`migrate:jsonl` 等离线工具仍可读该目录）。
 *
 * @deprecated 运行时 L1 在 PostgreSQL；勿用于读写 session。请用 engine `load` / `sessionExists` 等 API。
 */
export function sessionPath(sessionId: string): string {
  return join(PATHS.sessions, `${sessionId}.jsonl`);
}

export function isDebugSession(sessionId: string): boolean {
  return sessionId.startsWith("debug-");
}
