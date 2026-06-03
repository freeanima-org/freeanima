import type { LogLevel } from "./types.js";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function shouldLog(configured: LogLevel, message: LogLevel): boolean {
  return LEVEL_RANK[message] >= LEVEL_RANK[configured];
}
