import { toolError } from "@freeanima/core/tool";
import { createTempDir, removeManagedAnimaTmpPath } from "@freeanima/core/util/temp-dir";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const MAX_OUTPUT = 50 * 1024;
const MAX_TIMEOUT = 600;

const BUN_PREAMBLE = `
import { readFileSync, writeFileSync } from "node:fs";
// anima-tools minimal preamble for execute_code
`;

const NODEJS_PREAMBLE = `
import { readFileSync, writeFileSync } from "node:fs";
// anima-tools minimal preamble for execute_code
`;

export type RuntimeId = "bun" | "nodejs";

export function parseRuntime(raw: unknown): RuntimeId {
  const value = String(raw ?? "bun").toLowerCase();
  return value === "nodejs" ? "nodejs" : "bun";
}

export function listEnabledRuntimes(): RuntimeId[] {
  return ["bun", "nodejs"];
}

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT) return output;
  return `${output.slice(0, MAX_OUTPUT)}\n... (truncated at ${MAX_OUTPUT} chars)`;
}

function formatProcessOutput(stdout: string, stderr: string, exitCode: number | null): string {
  const parts: string[] = [];
  if (stdout) parts.push(stdout);
  if (stderr) parts.push(`--- stderr ---\n${stderr}`);
  if (exitCode !== 0 && exitCode != null) {
    parts.push(`--- exit code: ${exitCode} ---`);
  }
  const output = parts.join("");
  return truncateOutput(output) || "(no output)";
}

function formatSpawnResult(result: ReturnType<typeof spawnSync>): string {
  const parts: string[] = [];
  if (result.stdout) parts.push(String(result.stdout));
  if (result.stderr) parts.push(`--- stderr ---\n${result.stderr}`);
  if (result.status !== 0 && result.status != null) {
    parts.push(`--- exit code: ${result.status} ---`);
  }
  let output = parts.join("");
  if (output.length > MAX_OUTPUT) {
    output = `${output.slice(0, MAX_OUTPUT)}\n... (truncated at ${MAX_OUTPUT} chars)`;
  }
  return output || "(no output)";
}

async function runBun(code: string, timeoutSec: number): Promise<string> {
  const dir = createTempDir("anima-exec-");
  const file = join(dir, "snippet.ts");
  writeFileSync(file, `${BUN_PREAMBLE}\n${code}`, "utf-8");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);
  try {
    const proc = Bun.spawn(["bun", file], {
      cwd: dir,
      stdout: "pipe",
      stderr: "pipe",
      signal: controller.signal,
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return formatProcessOutput(stdout, stderr, exitCode);
  } catch (e) {
    return toolError(String(e));
  } finally {
    clearTimeout(timer);
    removeManagedAnimaTmpPath(dir);
  }
}

function runNodejs(code: string, timeoutSec: number): string {
  const dir = createTempDir("anima-exec-");
  const file = join(dir, "snippet.mts");
  writeFileSync(file, `${NODEJS_PREAMBLE}\n${code}`, "utf-8");
  try {
    const result = spawnSync("node", ["--experimental-strip-types", file], {
      encoding: "utf-8",
      timeout: timeoutSec * 1000,
      maxBuffer: MAX_OUTPUT,
    });
    return formatSpawnResult(result);
  } catch (e) {
    return toolError(String(e));
  } finally {
    removeManagedAnimaTmpPath(dir);
  }
}

export async function runExecuteCode(
  code: string,
  runtime: RuntimeId,
  timeoutSec: number,
): Promise<string> {
  switch (runtime) {
    case "bun":
      return runBun(code, timeoutSec);
    case "nodejs":
      return runNodejs(code, timeoutSec);
    default:
      return toolError(`runtime '${runtime}' is not supported`);
  }
}

export function clampTimeout(raw: unknown): number {
  return Math.min(Math.max(1, Number(raw ?? 300)), MAX_TIMEOUT);
}
