import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function logPath(): string {
  return join(homedir(), ".anima", "companion", "shell.log");
}

export function logLine(msg: string): void {
  const line = `[${new Date().toISOString().replace("T", " ").slice(0, 19)}] ${msg}`;
  console.error(line);
  try {
    const path = logPath();
    mkdirSync(join(path, ".."), { recursive: true });
    appendFileSync(path, `${line}\n`);
  } catch {
    // ignore log write failures
  }
}
