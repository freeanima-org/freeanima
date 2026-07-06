import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function logFile(): string {
  const home = process.env.FREEANIMA_HOME ?? join(homedir(), ".anima");
  return join(home, "desktop-shell", "shell.log");
}

export function logLine(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    const file = logFile();
    mkdirSync(join(file, ".."), { recursive: true });
    appendFileSync(file, line, "utf-8");
  } catch {
    // ignore
  }
  console.log(message);
}
