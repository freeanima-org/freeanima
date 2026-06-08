import { join } from "node:path";
import { PATHS } from "./paths.ts";

/**
 * 历史 JSONL 对话归档路径（`~/.anima/sessions/*.jsonl`，运行时不再读写）。
 *
 * @deprecated 运行时对话存档在 PostgreSQL；请用 engine `load` / `sessionExists` 等 API。
 */
export function sessionPath(sessionId: string): string {
  return join(PATHS.sessions, `${sessionId}.jsonl`);
}

export function isDebugSession(sessionId: string): boolean {
  return sessionId.startsWith("debug-");
}
