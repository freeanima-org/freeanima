import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { PATHS } from "@freeanima/service-config";

export const SCRIPTS_DIR = () => join(PATHS.cronDir, "scripts");
export const OUTPUT_DIR = () => join(PATHS.cronDir, "output");

export function ensureDirs(): void {
  mkdirSync(PATHS.cronDir, { recursive: true });
  mkdirSync(SCRIPTS_DIR(), { recursive: true });
  mkdirSync(OUTPUT_DIR(), { recursive: true });
}

export function resolveScriptPath(script: string): string {
  if (isAbsolute(script)) return script;
  return join(SCRIPTS_DIR(), script);
}

export function outputPath(jobId: string, runNumber: number): string {
  ensureDirs();
  return join(OUTPUT_DIR(), `${jobId}-${String(runNumber).padStart(4, "0")}.txt`);
}

/** Absolute path → path relative to FREEANIMA_HOME (POSIX slashes) */
export function toOutputRef(absPath: string): string {
  return relative(PATHS.home, absPath).replace(/\\/g, "/");
}

/** Path relative to FREEANIMA_HOME → absolute path */
export function fromOutputRef(ref: string): string {
  if (!ref) return "";
  if (isAbsolute(ref)) return ref;
  return join(PATHS.home, ref);
}

export function readOutputRef(ref: string | null | undefined): string {
  if (!ref) return "";
  const path = fromOutputRef(ref);
  if (!existsSync(path)) return "";
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}
