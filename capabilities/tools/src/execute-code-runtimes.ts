import { toolError } from "@freeanima/engine-tool";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAX_OUTPUT = 50 * 1024;
const MAX_TIMEOUT = 600;

const NODEJS_PREAMBLE = `
import { readFileSync, writeFileSync } from "node:fs";
// anima-tools minimal preamble for execute_code
`;

export type RuntimeId = "nodejs" | "python" | "deno";

const ALL_RUNTIMES: RuntimeId[] = ["nodejs", "python", "deno"];

/** 当前已启用的运行时；P1 起扩展 python，P3 起 deno */
const ENABLED_RUNTIMES = new Set<RuntimeId>(["nodejs"]);

export function parseRuntime(raw: unknown): RuntimeId {
  const value = String(raw ?? "nodejs").toLowerCase();
  if (ALL_RUNTIMES.includes(value as RuntimeId)) return value as RuntimeId;
  return "nodejs";
}

export function listEnabledRuntimes(): RuntimeId[] {
  return ALL_RUNTIMES.filter((id) => ENABLED_RUNTIMES.has(id));
}

function formatSpawnResult(result: ReturnType<typeof spawnSync>): string {
  const parts: string[] = [];
  if (result.stdout) parts.push(String(result.stdout));
  if (result.stderr) parts.push(`--- stderr ---\n${result.stderr}`);
  if (result.status !== 0 && result.status !== null) {
    parts.push(`--- exit code: ${result.status} ---`);
  }
  let output = parts.join("");
  if (output.length > MAX_OUTPUT) {
    output = `${output.slice(0, MAX_OUTPUT)}\n... (truncated at ${MAX_OUTPUT} chars)`;
  }
  return output || "(no output)";
}

function runNodejs(code: string, timeoutSec: number): string {
  const dir = mkdtempSync(join(tmpdir(), "anima-exec-"));
  const file = join(dir, "snippet.mts");
  writeFileSync(file, `${NODEJS_PREAMBLE}\n${code}`, "utf-8");
  try {
    const result = spawnSync(process.execPath, ["--experimental-strip-types", file], {
      encoding: "utf-8",
      timeout: timeoutSec * 1000,
      maxBuffer: MAX_OUTPUT,
    });
    return formatSpawnResult(result);
  } catch (e) {
    return toolError(String(e));
  } finally {
    try {
      unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

export function runExecuteCode(code: string, runtime: RuntimeId, timeoutSec: number): string {
  if (!ENABLED_RUNTIMES.has(runtime)) {
    return toolError(
      `runtime '${runtime}' 尚未启用；当前可用: ${listEnabledRuntimes().join(", ")}`,
    );
  }

  switch (runtime) {
    case "nodejs":
      return runNodejs(code, timeoutSec);
    default:
      return toolError(`runtime '${runtime}' 未实现`);
  }
}

export function clampTimeout(raw: unknown): number {
  return Math.min(Math.max(1, Number(raw ?? 300)), MAX_TIMEOUT);
}
